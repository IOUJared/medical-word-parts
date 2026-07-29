import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import nextConfig from "../../next.config";

const repositoryRoot = process.cwd();
const packageJson = z.object({ scripts: z.record(z.string(), z.string()) }).parse(JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")));

describe("static hosting path contract", () => {
  it("redirects the root to the production base path and rewrites its files", () => {
    const redirects = readFileSync(
      join(repositoryRoot, "public", "_redirects"),
      "utf8",
    )
      .trim()
      .split("\n");

    expect(redirects).toEqual([
      "/ /medical-word-parts/ 301",
      "/medical-word-parts /medical-word-parts/ 301",
      "/medical-word-parts/* /:splat 200",
    ]);
  });

  it("ships the GitHub Pages marker in public assets", () => {
    const noJekyllPath = join(repositoryRoot, "public", ".nojekyll");

    expect(existsSync(noJekyllPath)).toBe(true);
    expect(readFileSync(noJekyllPath, "utf8").trim()).toBe("");
  });

  it("keeps production styles external so static HTML does not serialize the stylesheet into Flight data", () => {
    expect(nextConfig.experimental?.inlineCss ?? false).toBe(false);
  });

  it("keeps development on Next while production automatically finalizes and validates the export", () => {
    expect(packageJson.scripts["dev"]).toBe("next dev");
    expect(packageJson.scripts["build"]).toBe("npm run browser:build && next build && npm run static:finalize");
    expect(packageJson.scripts["browser:build"]).toBe("npm run theme:build && npm run analyzer:build && npm run parts:build && npm run site:build");
    expect(packageJson.scripts["static:validate"]).toBe("tsx scripts/static-export-finalize.ts --check");
  });

  it("runs browser acceptance tests through Playwright after a finalized static build", () => {
    expect(packageJson.scripts["test:e2e"]).toBe("playwright test");
    expect(packageJson.scripts["test:e2e:dev"]).toBe(
      "playwright test --config tests/browser/playwright.root-dev.config.ts",
    );
  });

  it("documents the supported React development-tool opt-out", () => {
    const example = readFileSync(join(repositoryRoot, ".env.example"), "utf8");

    expect(example).toContain("NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS=");
  });
});
