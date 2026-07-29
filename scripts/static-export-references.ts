import { dirname, extname, posix } from "node:path";

import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { StaticExportPolicyError } from "./static-export-policy";

type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;

type LocalReference = {
  readonly path: string;
  readonly source: string;
  readonly value: string;
};

const externalReference = /^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i;
const localOrigin = "https://openword.invalid";
const metaUrlNames = new Set([
  "og:audio",
  "og:image",
  "og:url",
  "og:video",
  "twitter:image",
  "twitter:player",
  "twitter:url",
]);

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

function srcsetCandidates(value: string): readonly string[] {
  const candidates: string[] = [];
  let offset = 0;
  while (offset < value.length) {
    while (value[offset] === " " || value[offset] === ",") offset += 1;
    const start = offset;
    while (offset < value.length && value[offset] !== " " && value[offset] !== "\t") offset += 1;
    const candidate = value.slice(start, offset);
    if (candidate.length > 0) candidates.push(candidate);
    while (offset < value.length && value[offset] !== ",") offset += 1;
    if (value[offset] === ",") offset += 1;
  }
  return candidates;
}

function refreshTarget(value: string): string | undefined {
  const match = /^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(.+)\s*$/i.exec(value);
  return match?.[1];
}

function localReference(value: string): URL | undefined {
  if (value.startsWith("//")) return undefined;
  try {
    const reference = new URL(value, localOrigin);
    return reference.origin === localOrigin ? reference : undefined;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

function htmlReferences(source: string, path: string): readonly LocalReference[] {
  const references: LocalReference[] = [];
  const document = parse(source);
  const walk = (node: Node): void => {
    if (isElement(node)) {
      for (const name of ["href", "src", "action", "poster"] as const) {
        const value = attribute(node, name);
        if (value !== undefined) references.push({ path, source: path, value });
      }
      const srcset = attribute(node, "srcset");
      if (srcset !== undefined) {
        for (const value of srcsetCandidates(srcset)) references.push({ path, source: path, value });
      }
      if (node.tagName === "meta") {
        const name = attribute(node, "property")?.toLowerCase() ?? attribute(node, "name")?.toLowerCase();
        const content = attribute(node, "content");
        if (name !== undefined && content !== undefined && metaUrlNames.has(name)) references.push({ path, source: path, value: content });
        if (attribute(node, "http-equiv")?.toLowerCase() === "refresh" && content !== undefined) {
          const target = refreshTarget(content);
          if (target !== undefined) references.push({ path, source: path, value: target });
        }
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) walk(child);
  };
  walk(document);
  return references;
}

function cssReferences(source: string, path: string): readonly LocalReference[] {
  const references: LocalReference[] = [];
  const patterns = [
    /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))\s*\)?/gi,
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi,
  ] as const;
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3];
      if (value !== undefined) references.push({ path, source: path, value });
    }
  }
  return references;
}

function referenceBasePath(files: ReadonlyMap<string, Buffer>): string {
  for (const [path, body] of files) {
    if (!path.endsWith(".html")) continue;
    const reference = htmlReferences(body.toString("utf8"), path)
      .map((candidate) => localReference(candidate.value))
      .find((candidate): candidate is URL => candidate !== undefined && candidate.pathname.endsWith("/generated/site.js"));
    if (reference !== undefined) return reference.pathname.slice(0, -"/generated/site.js".length);
  }
  return "";
}

function assertSafeReferencePath(reference: LocalReference): string {
  const rawPath = reference.value.split(/[?#]/)[0] ?? "";
  try {
    const decodedPath = decodeURIComponent(rawPath);
    const relativeTarget = decodedPath.startsWith("/")
      ? ""
      : posix.normalize(posix.join(dirname(reference.path), decodedPath));
    if (relativeTarget === ".." || relativeTarget.startsWith("../")) {
      throw new StaticExportPolicyError(`${reference.source}: unsafe local reference ${reference.value}`);
    }
    return decodedPath;
  } catch (error) {
    if (error instanceof URIError) throw new StaticExportPolicyError(`${reference.source}: malformed local reference ${reference.value}`);
    throw error;
  }
}

function localTarget(reference: LocalReference, basePath: string): string | undefined {
  if (externalReference.test(reference.value)) return undefined;
  const decodedPath = assertSafeReferencePath(reference);
  const sourceDirectory = dirname(reference.path).replace(/^\.$/, "");
  const sourceBase = `${basePath}/${sourceDirectory}${sourceDirectory.length > 0 ? "/" : ""}`.replace(/\/+/g, "/");
  let pathname: string;
  try {
    pathname = new URL(reference.value, `https://example.invalid${sourceBase}`).pathname;
  } catch (error) {
    if (error instanceof TypeError) throw new StaticExportPolicyError(`${reference.source}: malformed local reference ${reference.value}`);
    throw error;
  }
  const withinBasePath = basePath.length > 0 && (pathname === basePath || pathname.startsWith(`${basePath}/`));
  if (basePath.length > 0 && decodedPath.startsWith("/") && !withinBasePath) {
    throw new StaticExportPolicyError(`${reference.source}: root-absolute local reference outside base path ${reference.value}`);
  }
  const relativePath = (withinBasePath ? pathname.slice(basePath.length) : pathname).replace(/^\//, "");
  if (relativePath.length === 0) return "index.html";
  if (pathname.endsWith("/") || extname(relativePath).length === 0) return `${relativePath.replace(/\/$/, "")}/index.html`;
  return relativePath;
}

export function assertAllLocalReferences(files: ReadonlyMap<string, Buffer>): void {
  const basePath = referenceBasePath(files);
  const references = [...files].flatMap(([path, body]) => {
    if (path.endsWith(".html")) return htmlReferences(body.toString("utf8"), path);
    if (path.endsWith(".css")) return cssReferences(body.toString("utf8"), path);
    return [];
  });
  for (const reference of references) {
    const target = localTarget(reference, basePath);
    if (target !== undefined && !files.has(target)) {
      throw new StaticExportPolicyError(`${reference.source}: broken local reference ${reference.value}`);
    }
  }
}
