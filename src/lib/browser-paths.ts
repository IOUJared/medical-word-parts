type PublicPath = `/${string}`;

export class BrowserPathMarkupError extends Error {
  override readonly name = "BrowserPathMarkupError";
}

export function browserPublicUrl(source: ParentNode, path: PublicPath): string {
  const root = source instanceof HTMLElement && source.hasAttribute("data-base-path")
    ? source
    : source.querySelector<HTMLElement>("[data-base-path]");
  if (root === null) throw new BrowserPathMarkupError("Server markup is missing the active base path");
  return `${root.dataset["basePath"] ?? ""}${path}`;
}
