import { parse, serialize, type DefaultTreeAdapterTypes, type ParserError } from "parse5";

import { StaticExportPolicyError } from "./static-export-policy";

type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;

const enhancerPath = /^\/(?:[^/]+\/)*generated\/(?:analyzer|parts|site)\.js$/;
const themePath = /^\/(?:[^/]+\/)*generated\/theme\.js$/;
const localOrigin = "https://openword.invalid";

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

function hasExactAttributes(element: Element, expected: Readonly<Record<string, string>>): boolean {
  const entries = Object.entries(expected);
  return element.attrs.length === entries.length && entries.every(([name, value]) => attribute(element, name) === value);
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

function isNextRuntimeReference(value: string): boolean {
  const reference = localReference(value);
  return reference !== undefined && reference.pathname.includes("/_next/static/") && reference.pathname.endsWith(".js");
}

function isEnhancerReference(value: string): boolean {
  const reference = localReference(value);
  return reference !== undefined && enhancerPath.test(reference.pathname);
}

function isThemeReference(value: string): boolean {
  const reference = localReference(value);
  return reference !== undefined && themePath.test(reference.pathname);
}

function removeNode(parent: ParentNode, node: ChildNode): void {
  const index = parent.childNodes.indexOf(node);
  if (index < 0) throw new StaticExportPolicyError("Unable to remove detached export node");
  parent.childNodes.splice(index, 1);
}

function scriptText(element: Element): string {
  return element.childNodes.flatMap((node) => "value" in node ? [node.value] : []).join("");
}

function transformScript(element: Element, parent: ParentNode, path: string): boolean {
  const source = attribute(element, "src");
  if (source !== undefined) {
    if (isNextRuntimeReference(source)) {
      removeNode(parent, element);
      return false;
    }
    if (isThemeReference(source)) {
      const exact = hasExactAttributes(element, { src: source });
      const nextStaging = hasExactAttributes(element, { src: source, "data-nscript": "beforeInteractive" });
      if ((exact || nextStaging) && scriptText(element).trim().length === 0) {
        element.attrs = [{ name: "src", value: source }];
        return true;
      }
      throw new StaticExportPolicyError(`${path}: unsupported theme script shape`);
    }
    if (isEnhancerReference(source)) {
      if (hasExactAttributes(element, { src: source, type: "module" })) return true;
      throw new StaticExportPolicyError(`${path}: unsupported enhancer script shape`);
    }
    throw new StaticExportPolicyError(`${path}: unsupported external script ${source}`);
  }
  const type = attribute(element, "type");
  if (type === "application/ld+json") return true;
  const text = scriptText(element).trim();
  const queuedTheme = /^\(self\.__next_s=self\.__next_s\|\|\[\]\)\.push\(\["(\/(?:[^"\\]+\/)*generated\/theme\.js)",\{\}\]\)$/.exec(text)?.[1];
  if (queuedTheme !== undefined && isThemeReference(queuedTheme)) {
    removeNode(parent, element);
    return false;
  }
  if (text.startsWith("(self.__next_f=self.__next_f||[]).push(") || text.startsWith("self.__next_f.push(")) {
    removeNode(parent, element);
    return false;
  }
  throw new StaticExportPolicyError(`${path}: unsupported inline executable script`);
}

function assertThemeScript(root: ParentNode, path: string): void {
  const matches: Array<{ readonly element: Element; readonly parent: ParentNode }> = [];
  const visit = (parent: ParentNode): void => {
    for (const node of parent.childNodes) {
      if (!isElement(node)) continue;
      const source = node.tagName === "script" ? attribute(node, "src") : undefined;
      if (source !== undefined && isThemeReference(source)) matches.push({ element: node, parent });
      visit(node);
    }
  };
  visit(root);
  if (matches.length !== 1) throw new StaticExportPolicyError(`${path}: expected exactly one theme script`);
  const match = matches[0];
  if (match === undefined || !isElement(match.parent) || match.parent.tagName !== "head") {
    throw new StaticExportPolicyError(`${path}: theme script must be a direct head child`);
  }
  const source = attribute(match.element, "src");
  if (source === undefined || !hasExactAttributes(match.element, { src: source }) || scriptText(match.element).trim().length > 0) {
    throw new StaticExportPolicyError(`${path}: unsupported theme script shape`);
  }
}

function transformLink(element: Element, parent: ParentNode, path: string): boolean {
  const rel = attribute(element, "rel")?.toLowerCase();
  const scriptPreload = rel === "modulepreload" || (rel === "preload" && attribute(element, "as")?.toLowerCase() === "script");
  const href = attribute(element, "href");
  if (href !== undefined && isThemeReference(href)) {
    if (!hasExactAttributes(element, { rel: "preload", href, as: "script" })) {
      throw new StaticExportPolicyError(`${path}: unsupported theme script preload shape`);
    }
    element.nodeName = "script";
    element.tagName = "script";
    element.attrs = [{ name: "src", value: href }];
    element.childNodes = [];
    return true;
  }
  if (href !== undefined && isEnhancerReference(href)) {
    if (!hasExactAttributes(element, { rel: "preload", href, as: "script" })) {
      throw new StaticExportPolicyError(`${path}: unsupported enhancer preload shape`);
    }
    element.nodeName = "script";
    element.tagName = "script";
    element.attrs = [{ name: "src", value: href }, { name: "type", value: "module" }];
    element.childNodes = [];
    return true;
  }
  if (!scriptPreload) return true;
  if (href === undefined) throw new StaticExportPolicyError(`${path}: script preload is missing href`);
  if (isNextRuntimeReference(href)) {
    removeNode(parent, element);
    return false;
  }
  throw new StaticExportPolicyError(`${path}: unsupported script preload ${href}`);
}

function transformChildren(parent: ParentNode, path: string): void {
  for (const node of [...parent.childNodes]) {
    if (!isElement(node)) continue;
    const retained = node.tagName === "script"
      ? transformScript(node, parent, path)
      : node.tagName === "link"
        ? transformLink(node, parent, path)
        : true;
    if (retained) transformChildren(node, path);
  }
}

export function finalizeHtmlDocument(source: string, path: string): string {
  const errors: ParserError[] = [];
  const document = parse(source, { onParseError: (error) => errors.push(error) });
  if (errors.length > 0) throw new StaticExportPolicyError(`${path}: malformed HTML (${errors.map((error) => error.code).join(", ")})`);
  transformChildren(document, path);
  assertThemeScript(document, path);
  return serialize(document);
}
