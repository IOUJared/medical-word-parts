export const browserBaseUrl = "http://127.0.0.1:4173/medical-word-parts";

export function appUrl(path: string): string {
  return `${browserBaseUrl}${path}`;
}

export const visualRoutes = [
  { path: "/", heading: "Read the parts. Verify the construction.", slug: "home" },
  { path: "/term/adrenal/", heading: "adrenal", slug: "term-adrenal" },
  { path: "/term/cytokine/", heading: "cytokine", slug: "term-cytokine" },
  { path: "/term/hypoglycemia/", heading: "hypoglycemia", slug: "term-hypoglycemia" },
  { path: "/parts/", heading: "Word parts", slug: "parts" },
  { path: "/parts/combining-glyc-o/", heading: "glyc/o", slug: "part-glyc-o" },
  { path: "/sources/", heading: "Sources", slug: "sources" },
  { path: "/methodology/", heading: "Methodology", slug: "methodology" },
  { path: "/analyze/?term=hyponephritis", heading: "Analyze a medical term", slug: "analyze-derived" },
  { path: "/analyze/?term=hypoxnephritis", heading: "Analyze a medical term", slug: "analyze-partial" },
  { path: "/analyze/?term=%3Cscript%3E", heading: "Analyze a medical term", slug: "analyze-invalid" },
  { path: "/404/", heading: "This page is not in the field guide", slug: "not-found" },
] as const;
