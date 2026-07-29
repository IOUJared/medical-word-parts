import type { MetadataRoute } from "next";

import { corpus } from "../generated/corpus";
import { routeSlugs } from "../generated/routes";
import { partSlug } from "../lib/catalog";
import { absoluteUrl } from "../lib/metadata";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/analyze/", "/parts/", "/common-medical-terms/", "/sources/", "/methodology/"] as const;
  return [
    ...staticRoutes.map((path) => ({ url: absoluteUrl(path) })),
    ...routeSlugs.map((slug) => ({ url: absoluteUrl(`/term/${slug}/`) })),
    ...corpus.parts.map((part) => ({ url: absoluteUrl(`/parts/${partSlug(part)}/`) })),
  ];
}
