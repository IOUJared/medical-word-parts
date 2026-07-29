import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const repositoryRoot = process.cwd();
const qualityCommands = [
  "npm run data:validate",
  "npm run data:test",
  "npm run browser:validate",
  "npm run lint",
  "npm run typecheck",
  "npx playwright install --with-deps chromium",
  "npm test",
  "npm run test:e2e:dev",
  "npm run build",
  "npm run static:validate",
  "npm run test:e2e",
  "npm run audit:production",
] as const;

const stepSchema = z.looseObject({
    name: z.string().optional(),
    id: z.string().optional(),
    uses: z.string().optional(),
    run: z.string().optional(),
    if: z.string().optional(),
    with: z.record(z.string(), z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    "continue-on-error": z.boolean().optional(),
    "timeout-minutes": z.number().int().positive().optional(),
  });

const jobSchema = z.looseObject({
    steps: z.array(stepSchema),
    needs: z.union([z.string(), z.array(z.string())]).optional(),
    permissions: z.record(z.string(), z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    concurrency: z.unknown().optional(),
    environment: z
      .union([z.string(), z.record(z.string(), z.string())])
      .optional(),
  });

const workflowSchema = z.looseObject({
    on: z.record(z.string(), z.unknown()),
    permissions: z.record(z.string(), z.string()).optional(),
    concurrency: z.unknown().optional(),
    jobs: z.record(z.string(), jobSchema),
  });

type Job = z.infer<typeof jobSchema>;
type Step = z.infer<typeof stepSchema>;
type Workflow = z.infer<typeof workflowSchema>;

function loadWorkflow(fileName: string): Workflow {
  const source = readFileSync(
    join(repositoryRoot, ".github", "workflows", fileName),
    "utf8",
  );
  return workflowSchema.parse(parseDocument(source).toJS());
}

function getJob(workflow: Workflow, jobName: string): Job {
  const job = workflow.jobs[jobName];
  if (job === undefined) {
    throw new Error(`Missing workflow job: ${jobName}`);
  }
  return job;
}

function getStep(job: Job, action: string): Step {
  const step = job.steps.find((candidate) => candidate.uses === action);
  if (step === undefined) {
    throw new Error(`Missing workflow action: ${action}`);
  }
  return step;
}

function allRunCommands(job: Job): readonly string[] {
  return job.steps.flatMap((step) =>
    step.run === undefined ? [] : [step.run],
  );
}

function qualityRunCommands(job: Job): readonly string[] {
  return job.steps.flatMap((step) =>
    step.run !== undefined &&
    qualityCommands.some((command) => step.run === command)
      ? [step.run]
      : [],
  );
}

function runCommandsBefore(job: Job, endIndex: number): readonly string[] {
  return job.steps.slice(0, endIndex).flatMap((step) =>
    step.run === undefined ? [] : [step.run],
  );
}

function expectNoContinueOnError(job: Job): void {
  expect(job.steps.some((step) => step["continue-on-error"] === true)).toBe(
    false,
  );
}

function expectFailureArtifactUpload(job: Job): void {
  const upload = getStep(job, "actions/upload-artifact@v4");

  expect(upload.if).toBe("failure()");
  expect(upload.with).toEqual({
    name: "validation-artifacts",
    path: ".artifacts",
    "if-no-files-found": "ignore",
  });
}

describe("GitHub workflow contracts", () => {
  it("runs CI on pull requests, main pushes, and manual dispatch", () => {
    const workflow = loadWorkflow("ci.yml");

    expect(Object.keys(workflow.on).sort()).toEqual([
      "pull_request",
      "push",
      "workflow_dispatch",
    ]);
    expect(workflow.on["push"]).toEqual({ branches: ["main"] });
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("keeps CI commands in fail-fast validation order on Node 22", () => {
    const workflow = loadWorkflow("ci.yml");
    const job = getJob(workflow, "ci");

    expect(allRunCommands(job)).toEqual(["npm ci", ...qualityCommands]);
    expect(getStep(job, "actions/checkout@v6")).toBeDefined();
    expect(getStep(job, "actions/setup-node@v6").with).toEqual({
      "node-version": "22",
      cache: "npm",
    });
    expectFailureArtifactUpload(job);
    expectNoContinueOnError(job);
  });

  it("deploys GitHub Pages from main with least permissions", () => {
    const workflow = loadWorkflow("deploy-github-pages.yml");
    const job = getJob(workflow, "deploy");

    expect(Object.keys(workflow.on).sort()).toEqual([
      "push",
      "workflow_dispatch",
    ]);
    expect(workflow.on["push"]).toEqual({ branches: ["main"] });
    expect(workflow.permissions).toEqual({
      contents: "read",
      pages: "write",
      "id-token": "write",
    });
    expect(workflow.concurrency).toEqual({
      group: "pages-${{ github.ref }}",
      "cancel-in-progress": true,
    });
    expect(job.steps.find((step) => step.name === "Install Chromium")?.["timeout-minutes"]).toBe(10);
    expect(job.environment).toEqual({
      name: "github-pages",
      url: "${{ steps.deployment.outputs.page_url }}",
    });
    expect(qualityRunCommands(job)).toEqual(qualityCommands);
    expectNoContinueOnError(job);

    const upload = getStep(job, "actions/upload-pages-artifact@v4");
    const uploadIndex = job.steps.indexOf(upload);
    const configure = getStep(job, "actions/configure-pages@v5");
    const deploy = getStep(job, "actions/deploy-pages@v4");
    expect(upload.with).toEqual({ path: "out" });
    expect(job.steps.indexOf(configure)).toBeLessThan(uploadIndex);
    expect(runCommandsBefore(job, uploadIndex)).toEqual([
      "npm ci",
      ...qualityCommands,
    ]);
    expectFailureArtifactUpload(job);
    expect(job.steps.indexOf(deploy)).toBeGreaterThan(uploadIndex);
  });

  it("keeps Cloudflare deployment manual and gated on both secrets", () => {
    const workflow = loadWorkflow("deploy-cloudflare.yml");
    const job = getJob(workflow, "deploy");
    const credentialCheck = job.steps.find((step) =>
      step.name?.toLowerCase().includes("cloudflare") && step.run !== undefined,
    );
    const deploy = getStep(job, "cloudflare/wrangler-action@v4");

    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(job.env).toEqual({
      NEXT_PUBLIC_BASE_PATH: "/medical-word-parts",
      NEXT_PUBLIC_SITE_URL: "https://medical-word-parts.pages.dev/medical-word-parts",
    });
    expect(qualityRunCommands(job)).toEqual(qualityCommands);
    expect(credentialCheck).toBeDefined();
    expect(credentialCheck?.env).toEqual({
      CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
      CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    });
    expect(credentialCheck?.run).toContain('-z "$CLOUDFLARE_API_TOKEN"');
    expect(credentialCheck?.run).toContain('-z "$CLOUDFLARE_ACCOUNT_ID"');
    expect(credentialCheck?.run).toContain("Missing required Cloudflare secret: CLOUDFLARE_API_TOKEN");
    expect(credentialCheck?.run).toContain("Missing required Cloudflare secret: CLOUDFLARE_ACCOUNT_ID");
    expect(credentialCheck?.run).toContain("exit 1");
    expect(credentialCheck?.run).not.toContain(
      'echo "$CLOUDFLARE_API_TOKEN"',
    );
    expect(credentialCheck?.run).not.toContain("GITHUB_OUTPUT");
    expect(deploy.if).toBeUndefined();
    expect(deploy.with).toEqual({
      apiToken: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
      accountId: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
      command: "pages deploy out --project-name medical-word-parts",
    });
    expectFailureArtifactUpload(job);
    expectNoContinueOnError(job);
  });
});
