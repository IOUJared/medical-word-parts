import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { finalizeExportDirectory } from "../../scripts/static-export-finalize";

const workspaces: string[] = [];
const nextChunk =
  "(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{},()=>{}]);";

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("prospective static export validation", () => {
  it("Given a transformed document with a broken link, when finalization fails, then every original byte remains unchanged", async () => {
    const workspace = createWorkspace('<a href="/missing/">Missing</a>');
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /broken local reference/,
    );

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given a form action that resolves nowhere, when finalizing, then it is rejected", async () => {
    const workspace = createWorkspace('<form action="/missing/"></form>');

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /broken local reference \/missing\//,
    );
  });

  it("Given a srcset candidate that resolves nowhere, when finalizing, then it is rejected", async () => {
    const workspace = createWorkspace(
      '<img srcset="/icon.svg 1x, /missing.png 2x" alt="fixture">',
    );

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /broken local reference \/missing\.png/,
    );
  });

  it("Given a local social meta URL that resolves nowhere, when finalizing, then it is rejected", async () => {
    const workspace = createWorkspace(
      '<meta property="og:image" content="/missing.png">',
    );

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /broken local reference \/missing\.png/,
    );
  });

  it("Given a stylesheet URL that resolves nowhere, when finalizing, then it is rejected", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    writeFileSync(
      join(workspace, "_next", "static", "chunks", "site.css"),
      "body { background: url('/missing.png'); }",
    );

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /broken local reference \/missing\.png/,
    );
  });

  it("Given a named Next payload with an unknown body, when finalizing, then it fails without removing it", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const payload = join(workspace, "route", "__next._full.txt");
    mkdirSync(join(workspace, "route"));
    writeFileSync(join(workspace, "route", "index.html"), "<!doctype html><html><head><script src='/generated/theme.js'></script></head><body>Route</body></html>");
    writeFileSync(payload, "not a Flight payload");
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /malformed Next payload artifact/,
    );

    expect(snapshot(workspace)).toEqual(before);
    expect(existsSync(payload)).toBe(true);
  });

  it("Given a recognized Next tree payload, when finalizing, then it is removed", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const payload = join(workspace, "__next._tree.txt");
    writeFileSync(
      payload,
      ':HL["/_next/static/chunks/site.css","style"]\n0:{"tree":{"name":"","param":null,"slots":null},"buildId":"0123456789ABCDEFGHIJK"}',
    );

    await finalizeExportDirectory(workspace);

    expect(existsSync(payload)).toBe(false);
  });

  it("Given a route index payload with an unknown body, when finalizing, then it fails without removing it", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const route = join(workspace, "route");
    mkdirSync(route);
    writeFileSync(join(route, "index.html"), "<!doctype html><html><head><script src='/generated/theme.js'></script></head><body>Route</body></html>");
    writeFileSync(join(route, "index.txt"), "not a Flight payload");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /malformed Next payload artifact/,
    );
  });

  it("Given an unrecognized flat Next chunk, when finalizing, then it fails without removing it", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const unknownChunk = join(workspace, "_next", "static", "chunks", "unknown.js");
    writeFileSync(unknownChunk, "window.unknownChunk = true;");
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /unknown Next chunk artifact/,
    );

    expect(snapshot(workspace)).toEqual(before);
    expect(existsSync(unknownChunk)).toBe(true);
  });

  it("Given a recognized Turbopack chunk, when finalizing, then it is removed", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const chunk = join(workspace, "_next", "static", "chunks", "turbopack.js");
    writeFileSync(chunk, "(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([]);");

    await finalizeExportDirectory(workspace);

    expect(existsSync(chunk)).toBe(false);
  });

  it("Given an unlisted core-js-shaped vendor chunk, when finalizing, then it remains untouched", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const chunk = join(workspace, "_next", "static", "chunks", "vendor.js");
    writeFileSync(
      chunk,
      '!function(){var t="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function e(t){var e={exports:{}};return t(e,e.exports),e.exports}Object.defineProperty({},"fixture",{value:true})}();',
    );

    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown Next chunk artifact/);

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given a symlink in an export tree, when finalizing, then it fails before touching the output", async () => {
    const workspace = createWorkspace("<p>Fixture</p>");
    const link = join(workspace, "generated", "linked-site.js");
    symlinkSync(join(workspace, "generated", "site.js"), link);
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/symbolic link/);

    expect(snapshot(workspace)).toEqual(before);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
  });

  it("Given a local reference that escapes the export root, when finalizing, then it is rejected without mutation", async () => {
    const workspace = createWorkspace('<a href="../outside/">Outside</a>');
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /unsafe local reference \.\.\/outside\//,
    );

    expect(snapshot(workspace)).toEqual(before);
  });

  it.each([
    ["remote", '<script src="https://cdn.example/generated/site.js" type="module"></script>'],
    ["protocol-relative", '<script src="//cdn.example/generated/site.js" type="module"></script>'],
  ] as const)("Given a %s enhancer URL, when finalizing, then it is rejected without mutation", async (_kind, enhancer) => {
    const workspace = createWorkspace(enhancer);
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unsupported external script/);

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given a root-absolute local reference outside an inferred base path, when finalizing, then it is rejected without mutation", async () => {
    const workspace = createWorkspace(
      '<img src="/icon.svg" alt="fixture">',
      "/medical-word-parts/generated/site.js",
    );
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(
      /outside base path \/icon\.svg/,
    );

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given same-origin base-path references and external canonical URLs, when finalized twice, then the retained tree is stable", async () => {
    const workspace = createWorkspace(
      '<img src="/medical-word-parts/icon.svg" alt="fixture"><link rel="canonical" href="https://example.test/medical-word-parts/"><a href="https://example.test/outside/">Outside</a>',
      "/medical-word-parts/generated/site.js",
    );

    await finalizeExportDirectory(workspace);
    const first = snapshot(workspace);
    await finalizeExportDirectory(workspace);

    expect(snapshot(workspace)).toEqual(first);
  });
});

function createWorkspace(body: string, enhancerPath = "/generated/site.js"): string {
  const workspace = mkdtempSync(join(tmpdir(), "openword-prospective-"));
  workspaces.push(workspace);
  mkdirSync(join(workspace, "generated"));
  mkdirSync(join(workspace, "_next", "static", "chunks"), { recursive: true });
  const basePath = enhancerPath.slice(0, -"/generated/site.js".length);
  writeFileSync(
    join(workspace, "index.html"),
    `<!doctype html><html><head><script src="${basePath}/generated/theme.js"></script><script src="${enhancerPath}" type="module"></script><script src="${basePath}/_next/static/chunks/runtime.js"></script><link rel="stylesheet" href="${basePath}/_next/static/chunks/site.css"></head><body>${body}</body></html>`,
  );
  writeFileSync(join(workspace, "generated", "site.js"), "export {};");
  writeFileSync(join(workspace, "generated", "theme.js"), "void 0;");
  writeFileSync(join(workspace, "_next", "static", "chunks", "runtime.js"), nextChunk);
  writeFileSync(join(workspace, "_next", "static", "chunks", "site.css"), "body {}");
  writeFileSync(join(workspace, "icon.svg"), "<svg></svg>");
  return workspace;
}

function snapshot(root: string): Readonly<Record<string, string>> {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => ({ path: join(entry.parentPath, entry.name), file: entry.isFile() }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return Object.fromEntries(
    entries.map((entry) => [
      entry.path.slice(root.length + 1),
      entry.file ? readFileSync(entry.path, "base64") : "<directory>",
    ]),
  );
}
