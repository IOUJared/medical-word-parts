import type { Metadata } from "next";

const defaultSiteUrl = "https://ioujared.github.io/medical-word-parts";

export function absoluteUrl(path: `/${string}`): string {
  return new URL(path.replace(/^\//, ""), `${process.env["NEXT_PUBLIC_SITE_URL"] ?? defaultSiteUrl}/`).toString();
}

export function createPageMetadata(title: string, description: string, path: `/${string}`): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "Medical Word Parts" },
  };
}
