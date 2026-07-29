import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { corpus } from "../../src/generated/corpus";

describe("static discovery metadata", () => {
  it("Given generated corpus routes, when the sitemap is built, then every public term and part is canonical", () => {
    const entries = sitemap();

    expect(entries.some((entry) => entry.url.endsWith("/term/hypoglycemia/"))).toBe(true);
    expect(entries.filter((entry) => entry.url.includes("/term/"))).toHaveLength(corpus.terms.length);
    expect(entries.every((entry) => entry.url.startsWith("https://ioujared.github.io/medical-word-parts/"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("component-showcase"))).toBe(false);
  });

  it("Given crawler policy, when robots metadata is built, then all exported routes are allowed and sitemap is absolute", () => {
    const policy = robots();

    expect(policy.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(policy.sitemap).toBe("https://ioujared.github.io/medical-word-parts/sitemap.xml");
  });

  it("Given the public route inventory, when source and documentation are inspected, then no production showcase route exists", () => {
    const repositoryRoot = process.cwd();
    const readme = readFileSync(join(repositoryRoot, "README.md"), "utf8");

    expect(existsSync(join(repositoryRoot, "src", "app", "component-showcase"))).toBe(false);
    expect(readme).not.toContain("/component-showcase/");
  });
});
