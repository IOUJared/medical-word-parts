import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import lighthouse from "lighthouse";
import { chromium } from "playwright";
import { z } from "zod";

import {
  assertAuditSummary,
  categoryNames,
  median,
  type AuditScores,
  type AuditSummary,
} from "./audit-policy";
import { startAuditServer } from "./audit-server";

const auditPort = 9223;
const auditRuns = 3;
const auditPresets = ["mobile", "desktop"] as const;
const artifactsDirectory = join(process.cwd(), ".artifacts");
export const productionBrowserChannel = "chrome";

type AuditPreset = (typeof auditPresets)[number];
type AuditRoute = { readonly slug: string; readonly url: string };
type ColdAudit = {
  readonly cls: number;
  readonly failedResources: readonly { readonly statusCode: number; readonly url: string }[];
  readonly fcp: number;
  readonly lcp: number;
  readonly nextRuntimeResources: readonly string[];
  readonly scores: AuditScores;
  readonly tbt: number;
};

class ProductionAuditError extends Error {
  override readonly name = "ProductionAuditError";
}

const lighthouseResultSchema = z.object({
  audits: z.object({
    "cumulative-layout-shift": z.object({ numericValue: z.number() }),
    "first-contentful-paint": z.object({ numericValue: z.number() }),
    "largest-contentful-paint": z.object({ numericValue: z.number() }),
    "network-requests": z.object({
      details: z.object({
        items: z.array(z.object({ statusCode: z.number(), url: z.string() })),
      }),
    }),
    "total-blocking-time": z.object({ numericValue: z.number() }),
  }),
  categories: z.object({
    accessibility: z.object({ score: z.number() }),
    "best-practices": z.object({ score: z.number() }),
    performance: z.object({ score: z.number() }),
    seo: z.object({ score: z.number() }),
  }),
});

function score(value: number): number {
  return Math.round(value * 100);
}

function scores(result: z.infer<typeof lighthouseResultSchema>): AuditScores {
  return {
    accessibility: score(result.categories.accessibility.score),
    "best-practices": score(result.categories["best-practices"].score),
    performance: score(result.categories.performance.score),
    seo: score(result.categories.seo.score),
  };
}

function isNextRuntimeResource(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.includes("/_next/static/") && pathname.endsWith(".js");
  } catch (error) {
    if (error instanceof TypeError) throw new ProductionAuditError(`Lighthouse returned malformed network URL ${url}`);
    throw error;
  }
}

async function coldRun(route: AuditRoute, preset: AuditPreset, run: number): Promise<ColdAudit> {
  const desktop = preset === "desktop";
  const settings = desktop
    ? {
        formFactor: preset,
        onlyCategories: [...categoryNames],
        screenEmulation: { deviceScaleFactor: 1, disabled: false, height: 940, mobile: false, width: 1350 },
        throttling: {
          cpuSlowdownMultiplier: 1,
          downloadThroughputKbps: 0,
          requestLatencyMs: 0,
          rttMs: 40,
          throughputKbps: 10240,
          uploadThroughputKbps: 0,
        },
      }
    : {
        formFactor: preset,
        onlyCategories: [...categoryNames],
        screenEmulation: { deviceScaleFactor: 1.75, disabled: false, height: 823, mobile: true, width: 412 },
      };
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${auditPort}`, "--ignore-certificate-errors"],
    channel: productionBrowserChannel,
    headless: true,
  });
  try {
    const result = await lighthouse(
      route.url,
      { logLevel: "error", output: "json", port: auditPort },
      {
        extends: "lighthouse:default",
        settings,
      },
    );
    if (result === undefined || typeof result.report !== "string") {
      throw new ProductionAuditError(`Lighthouse returned no ${route.slug} ${preset} result`);
    }
    const parsed = lighthouseResultSchema.parse(result.lhr);
    await writeFile(join(artifactsDirectory, `lighthouse-${route.slug}-${preset}-run-${run + 1}.json`), result.report);
    return {
      cls: parsed.audits["cumulative-layout-shift"].numericValue,
      failedResources: parsed.audits["network-requests"].details.items
        .filter((request) => request.statusCode >= 400)
        .map((request) => ({ statusCode: request.statusCode, url: request.url })),
      fcp: parsed.audits["first-contentful-paint"].numericValue,
      lcp: parsed.audits["largest-contentful-paint"].numericValue,
      nextRuntimeResources: parsed.audits["network-requests"].details.items
        .filter((request) => isNextRuntimeResource(request.url))
        .map((request) => request.url),
      scores: scores(parsed),
      tbt: parsed.audits["total-blocking-time"].numericValue,
    };
  } finally {
    await browser.close();
  }
}

async function auditRoute(route: AuditRoute, preset: AuditPreset): Promise<AuditSummary> {
  const runs: ColdAudit[] = [];
  for (let run = 0; run < auditRuns; run += 1) runs.push(await coldRun(route, preset, run));
  const scoresByCategory: AuditScores = {
    accessibility: median(runs.map((result) => result.scores.accessibility)),
    "best-practices": median(runs.map((result) => result.scores["best-practices"])),
    performance: median(runs.map((result) => result.scores.performance)),
    seo: median(runs.map((result) => result.scores.seo)),
  };
  const summary: AuditSummary = {
    cls: runs.map((result) => result.cls),
    preset,
    route: route.slug,
    runs,
    scores: scoresByCategory,
  };
  await writeFile(join(artifactsDirectory, `lighthouse-${route.slug}-${preset}.json`), `${JSON.stringify(summary, null, 2)}\n`);
  assertAuditSummary(summary);
  return summary;
}

function routes(origin: string, auditUrl: string | undefined): readonly AuditRoute[] {
  if (auditUrl !== undefined) {
    const url = new URL(auditUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new ProductionAuditError("AUDIT_URL must use HTTP or HTTPS");
    return [{ slug: "custom", url: url.toString() }];
  }
  const baseUrl = `${origin}/medical-word-parts`;
  return [
    { slug: "home", url: `${baseUrl}/` },
    { slug: "analyze-partial", url: `${baseUrl}/analyze/?term=hypoxnephritis` },
    { slug: "parts-prefix", url: `${baseUrl}/parts/?kind=prefix` },
    { slug: "term-hypoglycemia", url: `${baseUrl}/term/hypoglycemia/` },
  ];
}

export async function runProductionAudit(): Promise<void> {
  await mkdir(artifactsDirectory, { recursive: true });
  const server = await startAuditServer(join(process.cwd(), "out"), 4173);
  try {
    const summaries: AuditSummary[] = [];
    for (const route of routes(server.origin, process.env["AUDIT_URL"])) {
      for (const preset of auditPresets) summaries.push(await auditRoute(route, preset));
    }
    await writeFile(join(artifactsDirectory, "lighthouse-summary.json"), `${JSON.stringify(summaries, null, 2)}\n`);
    console.log(JSON.stringify(summaries.map(({ cls, preset, route, scores }) => ({ cls, preset, route, scores })), null, 2));
  } finally {
    await server.close();
  }
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) await runProductionAudit();
