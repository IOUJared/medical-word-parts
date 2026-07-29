type PublicPath = `/${string}`;

const basePath = process.env["NEXT_PUBLIC_BASE_PATH"] ?? "/medical-word-parts";

export function publicUrl(path: PublicPath): string {
  return `${basePath}${path}`;
}
