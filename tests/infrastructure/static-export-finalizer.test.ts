import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { finalizeExportDirectory } from "../../scripts/static-export-finalize";
import { finalizeHtmlDocument } from "../../scripts/static-export-html";
import { assertHydrationFreeSource } from "../../scripts/static-export-policy";

const workspaces: string[] = [];
const buildId = "0123456789ABCDEFGHIJK";

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

const fixture = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><link rel="canonical" href="https://example.test/">
<script src="/medical-word-parts/generated/theme.js"></script>
<link rel="stylesheet" href="/medical-word-parts/_next/static/chunks/site.css">
<link rel="preload" href="/medical-word-parts/_next/static/media/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/medical-word-parts/_next/static/chunks/runtime.js" as="script">
<link rel="modulepreload" href="/medical-word-parts/_next/static/chunks/module.js">
<link rel="preload" href="/medical-word-parts/generated/site.js" as="script">
<script type="application/ld+json">{"@type":"WebSite","name":"OpenWord"}</script>
<script src="/medical-word-parts/_next/static/chunks/runtime.js" async></script>
</head><body><a href="/medical-word-parts/parts/">Parts</a>
<script>(self.__next_f=self.__next_f||[]).push([0])</script>
<script>self.__next_f.push([1,"payload"])</script>
</body></html>`;

describe("zero-runtime static export finalizer", () => {
  it("Given a Next export document, when finalized, then only runtime and Flight references are removed", () => {
    const output = finalizeHtmlDocument(fixture, "fixture.html");

    expect(output).not.toContain("runtime.js");
    expect(output).not.toContain("module.js");
    expect(output).not.toContain("__next_f");
    expect(output).toContain('/medical-word-parts/_next/static/chunks/site.css');
    expect(output).toContain('/medical-word-parts/_next/static/media/font.woff2');
    expect(output).toContain('rel="canonical"');
    expect(output).toContain('type="application/ld+json"');
    expect(output).toContain('{"@type":"WebSite","name":"OpenWord"}');
    expect(output).toContain('<script src="/medical-word-parts/generated/theme.js"></script>');
    expect(output).toContain('<script src="/medical-word-parts/generated/site.js" type="module"></script>');
    expect(output).toContain('<a href="/medical-word-parts/parts/">Parts</a>');
  });

  it("Given finalized HTML, when finalized again, then output is byte-identical", () => {
    const first = finalizeHtmlDocument(fixture, "fixture.html");

    expect(finalizeHtmlDocument(first, "fixture.html")).toBe(first);
  });

  it("Given Next staging metadata on the local pre-paint bootstrap, when finalized, then it normalizes to the exact classic shape", () => {
    const source = "<!DOCTYPE html><html><head><script src='/generated/theme.js' data-nscript='beforeInteractive'></script></head><body></body></html>";

    expect(finalizeHtmlDocument(source, "fixture.html")).toContain('<script src="/generated/theme.js"></script>');
  });

  it("Given Next's pre-paint preload and exact local registration, when finalized, then one parser-blocking classic script remains", () => {
    const source = '<!DOCTYPE html><html><head><link rel="preload" href="/generated/theme.js" as="script"><script>(self.__next_s=self.__next_s||[]).push(["/generated/theme.js",{}])</script></head><body></body></html>';
    const output = finalizeHtmlDocument(source, "fixture.html");

    expect(output).toContain('<script src="/generated/theme.js"></script>');
    expect(output).not.toContain("__next_s");
  });

  it.each([
    '<script async src="/medical-word-parts/generated/site.js" type="module"></script>',
    '<link rel="modulepreload" href="/medical-word-parts/generated/site.js">',
    '<link rel="preload" href="/medical-word-parts/generated/site.js" as="script" crossorigin>',
  ])("Given an enhancer outside the exact production lifecycle shape, when finalized, then it fails closed", (enhancer) => {
    const source = `<!DOCTYPE html><html><head><script src="/generated/theme.js"></script>${enhancer}</head><body></body></html>`;

    expect(() => finalizeHtmlDocument(source, "fixture.html")).toThrow(/unsupported enhancer/);
  });

  it.each([
    "https://cdn.example/generated/site.js",
    "//cdn.example/generated/site.js",
    "https://cdn.example/generated/theme.js",
    "//cdn.example/generated/theme.js",
  ])("Given a remote enhancer URL %s, when finalized, then it fails closed", (sourceUrl) => {
    const source = `<!DOCTYPE html><html><head><script src="/generated/theme.js"></script><script src="${sourceUrl}" type="module"></script></head><body></body></html>`;

    expect(() => finalizeHtmlDocument(source, "fixture.html")).toThrow(/unsupported external script/);
  });

  it("Given malformed HTML, when finalization is attempted, then it fails closed", () => {
    expect(() => finalizeHtmlDocument("<!DOCTYPE html><html><body><script", "broken.html")).toThrow(/broken\.html/);
  });

  it.each([
    ["missing", "<!DOCTYPE html><html><head></head><body></body></html>"],
    ["duplicate", "<!DOCTYPE html><html><head><script src='/generated/theme.js'></script><script src='/generated/theme.js'></script></head><body></body></html>"],
    ["body", "<!DOCTYPE html><html><head></head><body><script src='/generated/theme.js'></script></body></html>"],
    ["module", "<!DOCTYPE html><html><head><script src='/generated/theme.js' type='module'></script></head><body></body></html>"],
  ] as const)("Given a %s pre-paint theme script shape, when finalized, then it fails closed", (_kind, source) => {
    expect(() => finalizeHtmlDocument(source, "fixture.html")).toThrow(/theme script/);
  });

  it.each([
    ['"use client"; export function Client() { return null; }', "use client"],
    ['import { useRouter } from "next/navigation"; export const value = useRouter;', "next/navigation"],
    ['import navigation from "next/navigation"; export const value = navigation;', "next/navigation"],
    ['import { useState } from "react"; export const value = useState;', "runtime React"],
    ['import dynamic from "next/dynamic"; export const value = dynamic;', "unsupported dependency"],
    ['import thing from "unapproved-package"; export const value = thing;', "unsupported dependency"],
  ])("Given unsupported source %s, when inspected, then the hydration guard fails", (source, expected) => {
    expect(() => assertHydrationFreeSource(source, "fixture.tsx")).toThrow(expected);
  });

  it("Given server-only framework imports, when inspected, then the hydration guard accepts them", () => {
    expect(() => assertHydrationFreeSource('import Link from "next/link"; import { notFound } from "next/navigation"; import type { ReactNode } from "react"; export const value: ReactNode = null;', "fixture.tsx")).not.toThrow();
  });

  it("Given a static export directory, when finalized twice, then all documents remain identical and local references resolve", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "openword-finalizer-"));
    workspaces.push(workspace);
    mkdirSync(join(workspace, "parts"));
    mkdirSync(join(workspace, "generated"));
    mkdirSync(join(workspace, "_next", "static", "chunks"), { recursive: true });
    mkdirSync(join(workspace, "_next", "static", "media"), { recursive: true });
    writeFileSync(join(workspace, "index.html"), fixture);
    writeFileSync(join(workspace, "parts", "index.html"), "<!DOCTYPE html><html><head><script src='/medical-word-parts/generated/theme.js'></script></head><body>Parts</body></html>");
    writeFileSync(join(workspace, "generated", "site.js"), "export {};");
    writeFileSync(join(workspace, "generated", "theme.js"), "void 0;");
    writeFileSync(join(workspace, "_next", "static", "chunks", "site.css"), "body{}");
    writeFileSync(join(workspace, "_next", "static", "media", "font.woff2"), "font");

    await finalizeExportDirectory(workspace);
    const first = readFileSync(join(workspace, "index.html"), "utf8");
    await finalizeExportDirectory(workspace);

    expect(readFileSync(join(workspace, "index.html"), "utf8")).toBe(first);
  });

  it("Given unreferenced Next payload and chunk artifacts, when finalized, then only classified candidates are removed", async () => {
    const workspace = createArtifactWorkspace();

    await finalizeExportDirectory(workspace);

    expect(existsSync(join(workspace, "route", "__next._full.txt"))).toBe(false);
    expect(existsSync(join(workspace, "route", "index.txt"))).toBe(false);
    expect(existsSync(join(workspace, "_next", "static", "chunks", "runtime.js"))).toBe(false);
    expect(readFileSync(join(workspace, "route", "notes.txt"), "utf8")).toBe("authored notes");
    expect(readFileSync(join(workspace, "_next", "static", "chunks", "site.css"), "utf8")).toBe("body{}");
    expect(readFileSync(join(workspace, "_next", "static", "media", "font.woff2"), "utf8")).toBe("font");
    expect(existsSync(join(workspace, "_next", "static", buildId))).toBe(false);
    expect(readFileSync(join(workspace, "manifest.webmanifest"), "utf8")).toBe("{}");
    expect(readFileSync(join(workspace, "icon.svg"), "utf8")).toBe("<svg></svg>");
    expect(readFileSync(join(workspace, "robots.txt"), "utf8")).toBe("User-agent: *");
    expect(readFileSync(join(workspace, "sitemap.xml"), "utf8")).toBe("<urlset></urlset>");
    expect(readFileSync(join(workspace, "_redirects"), "utf8")).toBe("/ /route/ 301");
  });

  it.each([
    ["_next/static/chunks/site.css", "@import url('./runtime.js');"],
    ["generated/site.js", 'const runtime = "/_next/static/chunks/runtime.js";'],
    ["manifest.webmanifest", '["runtime.js"]'],
    ["route/notes.txt", "See _next/static/chunks/runtime.js"],
  ])("Given retained %s references a candidate, when finalized, then deletion is refused without mutation", async (source, content) => {
    const workspace = createArtifactWorkspace();
    writeFileSync(join(workspace, source), content);

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/is referenced by retained/);
    expect(existsSync(join(workspace, "_next", "static", "chunks", "runtime.js"))).toBe(true);
  });

  it("Given an unknown nested Next executable shape, when finalized, then it fails closed", async () => {
    const workspace = createArtifactWorkspace();
    mkdirSync(join(workspace, "_next", "static", "chunks", "nested"));
    writeFileSync(join(workspace, "_next", "static", "chunks", "nested", "runtime.js"), "runtime");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/unknown Next executable artifact/);
  });

  it("Given a malformed Next payload name, when finalized, then it fails closed", async () => {
    const workspace = createArtifactWorkspace();
    writeFileSync(join(workspace, "route", "__next.txt"), "payload");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/malformed Next payload artifact/);
  });

  it("Given user-authored text containing a Flight token, when finalized, then it fails instead of deleting the text", async () => {
    const workspace = createArtifactWorkspace();
    writeFileSync(join(workspace, "route", "notes.txt"), '1:"$Sreact.fragment"');

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/Flight token/);
    expect(existsSync(join(workspace, "route", "notes.txt"))).toBe(true);
  });

  it("Given a stale runtime reference without its chunk, when finalized, then it fails closed", async () => {
    const workspace = createArtifactWorkspace();
    rmSync(join(workspace, "_next", "static", "chunks", "runtime.js"));
    writeFileSync(join(workspace, "route", "notes.txt"), "See /_next/static/chunks/missing.js");

    await expect(finalizeExportDirectory(workspace)).rejects.toThrow(/retained Next runtime reference/);
  });

  it("Given a cleaned artifact directory, when finalized again, then every retained path and byte is identical", async () => {
    const workspace = createArtifactWorkspace();
    await finalizeExportDirectory(workspace);
    const first = directorySnapshot(workspace);

    await finalizeExportDirectory(workspace);

    expect(directorySnapshot(workspace)).toEqual(first);
  });

  it("Given unremoved candidates, when check mode runs, then it reports an unfinalized artifact without deleting it", async () => {
    const workspace = createArtifactWorkspace();

    await expect(finalizeExportDirectory(workspace, { check: true })).rejects.toThrow(/is not finalized/);
    expect(existsSync(join(workspace, "_next", "static", "chunks", "runtime.js"))).toBe(true);
  });
});

function createArtifactWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "openword-artifacts-"));
  workspaces.push(workspace);
  for (const path of ["route", "generated", "_next/static/chunks", "_next/static/media", `_next/static/${buildId}`]) mkdirSync(join(workspace, path), { recursive: true });
  writeFileSync(join(workspace, "index.html"), '<!DOCTYPE html><html><head><script src="/generated/theme.js"></script><script src="/generated/site.js" type="module"></script></head><body><a href="/route/">Route</a></body></html>');
  writeFileSync(join(workspace, "route", "index.html"), "<!DOCTYPE html><html><head><script src='/generated/theme.js'></script></head><body>Route</body></html>");
  writeFileSync(join(workspace, "route", "index.txt"), '1:"$Sreact.fragment"\n0:{}');
  writeFileSync(join(workspace, "route", "__next._full.txt"), '1:"$Sreact.fragment"\n0:{}');
  writeFileSync(join(workspace, "route", "notes.txt"), "authored notes");
  writeFileSync(join(workspace, "generated", "site.js"), "export {};");
  writeFileSync(join(workspace, "generated", "theme.js"), "void 0;");
    writeFileSync(join(workspace, "_next", "static", "chunks", "runtime.js"), "(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{},()=>{}]);");
  writeFileSync(join(workspace, "_next", "static", "chunks", "site.css"), "body{}");
  writeFileSync(join(workspace, "_next", "static", "media", "font.woff2"), "font");
  writeFileSync(join(workspace, "_next", "static", buildId, "_buildManifest.js"), "self.__BUILD_MANIFEST={};self.__BUILD_MANIFEST_CB&&self.__BUILD_MANIFEST_CB()");
  writeFileSync(join(workspace, "_next", "static", buildId, "_clientMiddlewareManifest.js"), "self.__MIDDLEWARE_MATCHERS=[];self.__MIDDLEWARE_MATCHERS_CB&&self.__MIDDLEWARE_MATCHERS_CB()");
  writeFileSync(join(workspace, "_next", "static", buildId, "_ssgManifest.js"), "self.__SSG_MANIFEST=new Set([]);self.__SSG_MANIFEST_CB&&self.__SSG_MANIFEST_CB()");
  writeFileSync(join(workspace, "manifest.webmanifest"), "{}");
  writeFileSync(join(workspace, "icon.svg"), "<svg></svg>");
  writeFileSync(join(workspace, "robots.txt"), "User-agent: *");
  writeFileSync(join(workspace, "sitemap.xml"), "<urlset></urlset>");
  writeFileSync(join(workspace, "_redirects"), "/ /route/ 301");
  return workspace;
}

function directorySnapshot(root: string): Readonly<Record<string, string>> {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => ({ path: join(entry.parentPath, entry.name), file: entry.isFile() }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return Object.fromEntries(entries.map((entry) => [
    entry.path.slice(root.length + 1),
    entry.file ? readFileSync(entry.path, "base64") : "<directory>",
  ]));
}
