import type { NextConfig } from "next";
import { z } from "zod";

const isProduction = process.env["NODE_ENV"] === "production";
const defaultBasePath = isProduction ? "/medical-word-parts" : "";
const defaultSiteUrl = isProduction
  ? "https://ioujared.github.io/medical-word-parts"
  : "http://localhost:3000";

const basePath = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (value.startsWith("/") &&
        !value.startsWith("//") &&
        value.length > 1 &&
        !value.endsWith("/") &&
        !value.includes("\\") &&
        !value.includes("?") &&
        !value.includes("#") &&
        !value.includes("://")),
    "NEXT_PUBLIC_BASE_PATH must be empty or a safe local slash-prefixed path without a trailing slash",
  )
  .parse(process.env["NEXT_PUBLIC_BASE_PATH"] ?? defaultBasePath);

const siteUrl = z
  .url("NEXT_PUBLIC_SITE_URL must be an absolute URL")
  .parse(process.env["NEXT_PUBLIC_SITE_URL"] ?? defaultSiteUrl);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
};

export default nextConfig;
