import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let workspace = "";
let bundlePath = "";

function run(script: "analyzer:build" | "analyzer:validate", basePath?: string): ReturnType<typeof spawnSync> {
  return spawnSync(npmCommand, ["run", script, "--", "--output", bundlePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
  });
}

function runParts(script: "parts:build" | "parts:validate"): ReturnType<typeof spawnSync> {
  return spawnSync(npmCommand, ["run", script, "--", "--output", bundlePath], { cwd: repositoryRoot, encoding: "utf8" });
}

function runSite(script: "site:build" | "site:validate"): ReturnType<typeof spawnSync> {
  return spawnSync(npmCommand, ["run", script, "--", "--output", bundlePath], { cwd: repositoryRoot, encoding: "utf8" });
}

function runTheme(script: "theme:build" | "theme:validate"): ReturnType<typeof spawnSync> {
  return spawnSync(npmCommand, ["run", script, "--", "--output", bundlePath], { cwd: repositoryRoot, encoding: "utf8" });
}

function digest(): string {
  return createHash("sha256").update(readFileSync(bundlePath)).digest("hex");
}

describe("deterministic analyzer browser bundle", () => {
  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "openword-analyzer-"));
    bundlePath = join(workspace, "analyzer.js");
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it("Given analyzer source, when bundled twice, then output is stable, local, and production-only", () => {
    expect(run("analyzer:build").status).toBe(0);
    const firstDigest = digest();
    expect(run("analyzer:build").status).toBe(0);
    const bundle = readFileSync(bundlePath, "utf8");

    expect(digest()).toBe(firstDigest);
    expect(bundle).toMatch(/^\/\/ GENERATED FILE/);
    expect(Buffer.byteLength(bundle)).toBeLessThanOrEqual(139_750);
    expect(bundle).not.toContain("sourceMappingURL");
    expect(bundle).not.toContain("react-dom");
    expect(bundle).not.toContain("innerHTML");
    expect(bundle).not.toContain("insertAdjacentHTML");
    expect(run("analyzer:validate").status).toBe(0);
  });

  it("Given root and production build environments, when the analyzer is bundled, then both emit the same environment-neutral JavaScript", () => {
    expect(run("analyzer:build", "").status).toBe(0);
    const rootBundle = readFileSync(bundlePath, "utf8");

    expect(run("analyzer:build", "/medical-word-parts").status).toBe(0);
    const productionBundle = readFileSync(bundlePath, "utf8");

    expect(productionBundle).toBe(rootBundle);
    for (const localPath of ["/medical-word-parts/analyze/", "/medical-word-parts/generated/", "/medical-word-parts/parts/", "/medical-word-parts/term/"] as const) {
      expect(productionBundle).not.toContain(localPath);
    }
  });

  it("Given stale generated JavaScript, when validation runs, then it fails without rewriting", () => {
    expect(run("analyzer:build").status).toBe(0);
    const original = readFileSync(bundlePath, "utf8");
    try {
      writeFileSync(bundlePath, `${original}\n// stale probe\n`);
      const validation = run("analyzer:validate");

      expect(validation.status).not.toBe(0);
      expect(`${validation.stdout}${validation.stderr}`).toContain("public/generated/analyzer.js is stale");
      expect(readFileSync(bundlePath, "utf8")).toContain("stale probe");
    } finally {
      writeFileSync(bundlePath, original);
    }
  });

  it("Given the parts enhancer source, when bundled twice, then output is stable, local, strict, and production-only", () => {
    expect(runParts("parts:build").status).toBe(0);
    const firstDigest = digest();
    expect(runParts("parts:build").status).toBe(0);
    const bundle = readFileSync(bundlePath, "utf8");

    expect(digest()).toBe(firstDigest);
    expect(bundle).toMatch(/^\/\/ GENERATED FILE/);
    expect(Buffer.byteLength(bundle)).toBeLessThanOrEqual(6_000);
    expect(bundle).not.toContain("sourceMappingURL");
    expect(bundle).not.toContain("react-dom");
    expect(bundle).not.toContain("innerHTML");
    expect(bundle).not.toContain("insertAdjacentHTML");
    expect(runParts("parts:validate").status).toBe(0);
  });

  it("Given a stale parts bundle, when validation runs, then it fails without rewriting", () => {
    expect(runParts("parts:build").status).toBe(0);
    const original = readFileSync(bundlePath, "utf8");
    try {
      writeFileSync(bundlePath, `${original}\n// stale probe\n`);
      const validation = runParts("parts:validate");

      expect(validation.status).not.toBe(0);
      expect(`${validation.stdout}${validation.stderr}`).toContain("public/generated/parts.js is stale");
      expect(readFileSync(bundlePath, "utf8")).toContain("stale probe");
    } finally {
      writeFileSync(bundlePath, original);
    }
  });

  it("Given the site enhancer source, when bundled twice, then output is stable, local, strict, and production-only", () => {
    expect(runSite("site:build").status).toBe(0);
    const firstDigest = digest();
    expect(runSite("site:build").status).toBe(0);
    const bundle = readFileSync(bundlePath, "utf8");

    expect(digest()).toBe(firstDigest);
    expect(Buffer.byteLength(bundle)).toBeLessThanOrEqual(60_000);
    expect(bundle).not.toContain("sourceMappingURL");
    expect(bundle).not.toContain("react-dom");
    expect(bundle).not.toContain("innerHTML");
    expect(runSite("site:validate").status).toBe(0);
  });

  it("Given a stale site bundle, when validation runs, then it fails without rewriting", () => {
    expect(runSite("site:build").status).toBe(0);
    const original = readFileSync(bundlePath, "utf8");
    try {
      writeFileSync(bundlePath, `${original}\n// stale probe\n`);
      const validation = runSite("site:validate");

      expect(validation.status).not.toBe(0);
      expect(`${validation.stdout}${validation.stderr}`).toContain("public/generated/site.js is stale");
      expect(readFileSync(bundlePath, "utf8")).toContain("stale probe");
    } finally {
      writeFileSync(bundlePath, original);
    }
  });

  it("Given the pre-paint theme source, when bundled twice, then output is stable, local, classic, and at most 2KB", () => {
    expect(runTheme("theme:build").status).toBe(0);
    const firstDigest = digest();
    expect(runTheme("theme:build").status).toBe(0);
    const bundle = readFileSync(bundlePath, "utf8");

    expect(digest()).toBe(firstDigest);
    expect(bundle).toMatch(/^\/\/ GENERATED FILE/);
    expect(Buffer.byteLength(bundle)).toBeLessThanOrEqual(2_000);
    expect(bundle).not.toContain("sourceMappingURL");
    expect(bundle).not.toContain("react-dom");
    expect(bundle).not.toMatch(/\bexport\b/);
    expect(runTheme("theme:validate").status).toBe(0);
  });

  it("Given a stale theme bundle, when validation runs, then it fails without rewriting", () => {
    expect(runTheme("theme:build").status).toBe(0);
    const original = readFileSync(bundlePath, "utf8");
    try {
      writeFileSync(bundlePath, `${original}\n// stale probe\n`);
      const validation = runTheme("theme:validate");

      expect(validation.status).not.toBe(0);
      expect(`${validation.stdout}${validation.stderr}`).toContain("public/generated/theme.js is stale");
      expect(readFileSync(bundlePath, "utf8")).toContain("stale probe");
    } finally {
      writeFileSync(bundlePath, original);
    }
  });
});
