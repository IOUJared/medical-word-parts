import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const authoredDataCommands = [
  "npm run data:build",
  "npm run data:validate",
  "npm run data:test",
] as const;
const committedArtifactCommands = [
  "npm run data:validate",
  "npm run data:test",
  "npm run browser:validate",
  "npm run lint",
] as const;

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

function expectOrderedCommands(document: string, commands: readonly string[]): void {
  const indexes = commands.map((command) => document.indexOf(command));
  expect(indexes.every((index) => index >= 0)).toBe(true);
  expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
}

function section(document: string, heading: string): string {
  return document.split(heading)[1] ?? "";
}

describe("pre-commit contracts", () => {
  it.each(["README.md", "CONTRIBUTING.md", "docs/data-sources.md"])("Given %s, when authored-data instructions are read, then build, validation, and data tests stay ordered", (path) => {
    const document = source(path);
    const heading = path === "README.md" ? "## Data editing flow" : path === "CONTRIBUTING.md" ? "## Edit sequence" : "## Rebuild audit";

    expectOrderedCommands(section(document, heading), authoredDataCommands);
  });

  it("Given the README validation command list, when generated files are current, then it validates and tests without claiming a conflicting rebuild order", () => {
    const validation = section(source("README.md"), "## Validation").split("## Data editing flow")[0] ?? "";

    expectOrderedCommands(validation, authoredDataCommands.slice(1));
    expect(validation).not.toContain("npm run data:build");
  });

  it.each([
    "docs/deployment-github-pages.md",
    "docs/deployment-cloudflare.md",
  ])("Given %s, when deployment verification is read, then it includes data tests after validation", (path) => {
    expectOrderedCommands(source(path), authoredDataCommands.slice(1));
  });

  it.each([
    "README.md",
    "CONTRIBUTING.md",
    "docs/deployment-github-pages.md",
    "docs/deployment-cloudflare.md",
  ])("Given %s, when canonical validation gates are read, then committed browser bundles are checked after data tests and before lint", (path) => {
    expectOrderedCommands(source(path), committedArtifactCommands);
  });

  it("Given the status panel layout, when its design tokens are read, then the large icon size is defined without a fallback", () => {
    expect(source("src/app/styles/tokens.css")).toContain("--size-icon-lg: 1.5rem;");
    expect(source("src/app/styles/morphology.css")).toContain("var(--size-icon-lg) minmax(0, 1fr)");
  });

  it("Given repository-local Playwright MCP artifacts, when ignore rules are checked, then the artifacts stay excluded", () => {
    expect(source(".gitignore").split(/\r?\n/)).toContain("/.playwright-mcp/");
  });
});
