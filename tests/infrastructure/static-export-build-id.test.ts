import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { finalizeExportDirectory } from "../../scripts/static-export-finalize";

const workspaces: string[] = [];
const firstId = "0123456789ABCDEFGHIJK";
const secondId = "ZYXWVUTSRQPONMLKJIHGF";

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("Next build-ID artifact finalization", () => {
  it("Given the exact approved manifest set, when finalized, then manifests and their empty directory are removed", async () => {
    const workspace = createWorkspace(firstId);

    await finalizeExportDirectory(workspace);

    expect(existsSync(join(workspace, "_next", "static", firstId))).toBe(false);
    expect(readFileSync(join(workspace, "_next", "static", "chunks", "site.css"), "utf8")).toBe("body{}");
    expect(readFileSync(join(workspace, "_next", "static", "media", "font.woff2"), "utf8")).toBe("font");
  });

  it("Given a retained reference to the build-ID directory, when finalized, then removal is refused", async () => {
    const workspace = createWorkspace(firstId);
    writeFileSync(join(workspace, "generated", "site.js"), `const manifest = "/_next/static/${firstId}/";`);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/is referenced by retained generated\/site\.js/);
    expect(existsSync(join(workspace, "_next", "static", firstId))).toBe(true);
  });

  it.each([
    ["missing manifest", (root: string) => rmSync(join(root, "_next", "static", firstId, "_ssgManifest.js"))],
    ["extra manifest", (root: string) => writeFileSync(join(root, "_next", "static", firstId, "extra.js"), "extra")],
    ["nested content", (root: string) => { mkdirSync(join(root, "_next", "static", firstId, "nested")); writeFileSync(join(root, "_next", "static", firstId, "nested", "extra.js"), "extra"); }],
  ])("Given %s in a build-ID directory, when finalized, then it fails closed", async (_name, mutate) => {
    const workspace = createWorkspace(firstId);
    mutate(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/manifest set/);
  });

  it("Given a malformed build-ID path, when finalized, then it fails closed", async () => {
    const workspace = createWorkspace("short-id");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/malformed Next build-ID directory/);
  });

  it("Given an unknown manifest body, when finalized, then it fails closed", async () => {
    const workspace = createWorkspace(firstId);
    writeFileSync(join(workspace, "_next", "static", firstId, "_buildManifest.js"), "self.unknown={}");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown _buildManifest\.js shape/);
  });

  it("Given an empty random build-ID directory, when finalized, then it fails without mutation", async () => {
    const workspace = createWorkspace(firstId);
    mkdirSync(join(workspace, "_next", "static", secondId));
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown Next build-ID directory/);

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given an empty root Next build-ID directory, when finalized, then it is removed", async () => {
    const workspace = createWorkspace(firstId);
    const rootBuildDirectory = join(workspace, "_next", secondId);
    mkdirSync(rootBuildDirectory);

    await finalizeExportDirectory(workspace);

    expect(existsSync(rootBuildDirectory)).toBe(false);
  });

  it("Given a nonempty root Next build-ID directory, when finalized, then it fails without mutation", async () => {
    const workspace = createWorkspace(firstId);
    const rootBuildDirectory = join(workspace, "_next", secondId);
    mkdirSync(rootBuildDirectory);
    writeFileSync(join(rootBuildDirectory, "unexpected.txt"), "unexpected");
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown Next build-ID directory/);

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given a valid build-ID directory with an empty nested directory, when finalized, then it fails without mutation", async () => {
    const workspace = createWorkspace(firstId);
    mkdirSync(join(workspace, "_next", "static", firstId, "nested"));
    const before = snapshot(workspace);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown Next build manifest set/);

    expect(snapshot(workspace)).toEqual(before);
  });

  it("Given two exports differing only by random build ID, when finalized, then sorted path and bytes are equal", async () => {
    const first = createWorkspace(firstId);
    const second = createWorkspace(secondId);

    await finalizeExportDirectory(first);
    await finalizeExportDirectory(second);

    expect(snapshot(second)).toEqual(snapshot(first));
  });
});

function createWorkspace(buildId: string): string {
  const root = mkdtempSync(join(tmpdir(), "openword-build-id-"));
  workspaces.push(root);
  for (const path of ["generated", "_next/static/chunks", "_next/static/media", `_next/static/${buildId}`]) mkdirSync(join(root, path), { recursive: true });
  writeFileSync(join(root, "index.html"), '<!DOCTYPE html><html><head><script src="/generated/theme.js"></script><script src="/generated/site.js" type="module"></script></head><body>Home</body></html>');
  writeFileSync(join(root, "generated", "site.js"), "export {};");
  writeFileSync(join(root, "generated", "theme.js"), "void 0;");
  writeFileSync(join(root, "_next", "static", "chunks", "site.css"), "body{}");
  writeFileSync(join(root, "_next", "static", "media", "font.woff2"), "font");
  const directory = join(root, "_next", "static", buildId);
  writeFileSync(join(directory, "_buildManifest.js"), "self.__BUILD_MANIFEST={};self.__BUILD_MANIFEST_CB&&self.__BUILD_MANIFEST_CB()");
  writeFileSync(join(directory, "_clientMiddlewareManifest.js"), "self.__MIDDLEWARE_MATCHERS=[];self.__MIDDLEWARE_MATCHERS_CB&&self.__MIDDLEWARE_MATCHERS_CB()");
  writeFileSync(join(directory, "_ssgManifest.js"), "self.__SSG_MANIFEST=new Set([]);self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB()");
  return root;
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
