import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createSecureServer } from "node:http2";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

type StaticFile = {
  readonly body: Buffer;
  readonly compressed?: Buffer;
  readonly contentType: string;
};

export type AuditServer = {
  readonly close: () => Promise<void>;
  readonly origin: string;
};

export class AuditServerError extends Error {
  override readonly name = "AuditServerError";
}

const contentTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function isCompressible(contentType: string): boolean {
  return /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg\+xml)/.test(contentType);
}

async function loadFiles(root: string): Promise<ReadonlyMap<string, StaticFile>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = new Map<string, StaticFile>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = join(entry.parentPath, entry.name);
    const body = await readFile(filePath);
    const contentType = contentTypes.get(extname(filePath)) ?? "application/octet-stream";
    const key = relative(root, filePath).split("\\").join("/");
    if (isCompressible(contentType)) {
      files.set(key, {
        body,
        compressed: brotliCompressSync(body, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
        }),
        contentType,
      });
    } else {
      files.set(key, { body, contentType });
    }
  }
  return files;
}

function requestKey(requestUrl: string | undefined): string {
  const pathname = new URL(requestUrl ?? "/", "https://127.0.0.1").pathname;
  const relativePath = pathname.replace(/^\/medical-word-parts\/?/, "");
  if (relativePath.length === 0) return "index.html";
  return relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
}

function createCertificate(directory: string): { readonly certificatePath: string; readonly keyPath: string } {
  const keyPath = join(directory, "key.pem");
  const certificatePath = join(directory, "certificate.pem");
  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certificatePath,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    const diagnostic = result.error?.message ?? result.stderr;
    throw new AuditServerError(`Unable to create audit certificate: ${diagnostic}`);
  }
  return { certificatePath, keyPath };
}

export async function startAuditServer(root: string, port: number): Promise<AuditServer> {
  const files = await loadFiles(root);
  const certificateDirectory = await mkdtemp(join(tmpdir(), "openword-audit-"));
  const { keyPath, certificatePath } = createCertificate(certificateDirectory);
  const server = createSecureServer(
    {
      allowHTTP1: true,
      cert: await readFile(certificatePath),
      key: await readFile(keyPath),
    },
    (request, response) => {
      const key = requestKey(request.url);
      const file = files.get(key);
      if (file === undefined) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const acceptEncoding = request.headers["accept-encoding"];
      const useBrotli = typeof acceptEncoding === "string" && acceptEncoding.includes("br") && file.compressed !== undefined;
      const body = useBrotli ? file.compressed : file.body;
      const cacheControl = key.startsWith("_next/") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate";
      response.writeHead(200, {
        "Cache-Control": cacheControl,
        "Content-Length": body.byteLength,
        "Content-Type": file.contentType,
        ...(useBrotli ? { "Content-Encoding": "br", Vary: "Accept-Encoding" } : {}),
      });
      response.end(body);
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  } catch (error) {
    await rm(certificateDirectory, { recursive: true, force: true });
    throw error;
  }
  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
      await rm(certificateDirectory, { recursive: true, force: true });
    },
    origin: `https://127.0.0.1:${port}`,
  };
}
