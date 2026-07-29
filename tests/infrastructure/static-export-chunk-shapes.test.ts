import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { finalizeExportDirectory } from "../../scripts/static-export-finalize";

const workspaces: string[] = [];
const webpackChunk =
  "(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{},()=>{}]);";
const turbopackChunk =
  "(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([[1],{},()=>{}]);";

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("Next runtime chunk envelopes", () => {
  it.each([
    ["webpack", webpackChunk],
    ["Turbopack", turbopackChunk],
  ])("Given an exact %s registration chunk, when finalizing, then it is removed", async (_name, source) => {
    const workspace = createWorkspace(source);

    await finalizeExportDirectory(workspace);

    expect(existsSync(join(workspace, "_next", "static", "chunks", "runtime.js"))).toBe(false);
  });

  it.each([
    ["leading", `window.before=true;${webpackChunk}`],
    ["trailing", `${webpackChunk}window.after=true;`],
    ["marker-only", 'const marker = "webpackChunk_N_E";'],
  ])("Given %s code around a Next marker, when finalizing, then it fails without mutation", async (_name, source) => {
    const workspace = createWorkspace(source);
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /unknown Next chunk artifact/,
    );

    expect(snapshot(workspace)).toEqual(before);
  });
});

function createWorkspace(runtime: string): string {
  const workspace = mkdtempSync(join(tmpdir(), "openword-chunk-shape-"));
  workspaces.push(workspace);
  mkdirSync(join(workspace, "generated"));
  mkdirSync(join(workspace, "_next", "static", "chunks"), { recursive: true });
  writeFileSync(
    join(workspace, "index.html"),
    '<!doctype html><html><head><script src="/generated/theme.js"></script><script src="/generated/site.js" type="module"></script><script src="/_next/static/chunks/runtime.js"></script></head><body>Fixture</body></html>',
  );
  writeFileSync(join(workspace, "generated", "site.js"), "export {};");
  writeFileSync(join(workspace, "generated", "theme.js"), "void 0;");
  writeFileSync(join(workspace, "_next", "static", "chunks", "runtime.js"), runtime);
  return workspace;
}

function snapshot(root: string): Readonly<Record<string, string>> {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => ({ path: join(entry.parentPath, entry.name), file: entry.isFile() }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return Object.fromEntries(entries.map((entry) => [
    entry.path.slice(root.length + 1),
    entry.file ? readFileSync(entry.path, "base64") : "<directory>",
  ]));
}
