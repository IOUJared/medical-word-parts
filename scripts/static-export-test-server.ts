import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";

const port = 4173;
const root = join(process.cwd(), "out");
const contentTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function targetPath(requestUrl: string | undefined): string | undefined {
  const pathname = new URL(requestUrl ?? "/", "http://127.0.0.1").pathname;
  if (!pathname.startsWith("/medical-word-parts")) return undefined;
  const relativePath = pathname.slice("/medical-word-parts".length).replace(/^\//, "");
  const file = relativePath.length === 0 || relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
  const resolved = normalize(join(root, file));
  return relative(root, resolved).startsWith("..") ? undefined : resolved;
}

const server = createServer(async (request, response) => {
  const path = targetPath(request.url);
  if (path === undefined) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Length": body.byteLength,
      "Content-Type": contentTypes.get(extname(path)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    throw error;
  }
});

server.listen(port, "127.0.0.1");
