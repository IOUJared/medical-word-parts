import { corpus } from "../generated/corpus";

export type PartRecord = (typeof corpus.parts)[number];
export type SourceRecord = (typeof corpus.sources)[number];
export type TermRecord = (typeof corpus.terms)[number];

export const partKinds = ["prefix", "root", "suffix", "combiningForm"] as const;

export function partSlug(part: { readonly id: string }): string {
  return part.id.replace(":", "-");
}

export function findPartBySlug(slug: string): PartRecord | undefined {
  return corpus.parts.find((part) => partSlug(part) === slug);
}

export function findTermBySlug(slug: string): TermRecord | undefined {
  return corpus.terms.find((term) => term.slug === slug);
}

export function findSource(sourceId: string): SourceRecord | undefined {
  return corpus.sources.find((source) => source.id === sourceId);
}

export function partKindLabel(kind: PartRecord["kind"]): string {
  switch (kind) {
    case "prefix":
      return "Prefix";
    case "root":
      return "Root";
    case "suffix":
      return "Suffix";
    case "combiningForm":
      return "Combining form";
  }
}

export function partKindCode(kind: PartRecord["kind"]): string {
  switch (kind) {
    case "prefix":
      return "PRE";
    case "root":
      return "ROOT";
    case "suffix":
      return "SUF";
    case "combiningForm":
      return "C/F";
  }
}
