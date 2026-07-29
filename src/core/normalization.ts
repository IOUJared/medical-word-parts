import type { UnsupportedReason } from "./types";

const maximumTermLength = 80;
const supportedTerm = /^[a-z]+(?:[-'][a-z]+)*$/;

export type NormalizationResult =
  | { readonly kind: "supported"; readonly normalized: string }
  | {
      readonly kind: "unsupported";
      readonly normalized: string;
      readonly reason: Exclude<UnsupportedReason, "no_known_parts">;
    };

export function normalizeTermInput(input: string): NormalizationResult {
  const normalized = input.normalize("NFKC").trim().toLowerCase();
  if (normalized.length === 0) {
    return { kind: "unsupported", normalized, reason: "empty" };
  }
  if (normalized.length > maximumTermLength) {
    return { kind: "unsupported", normalized, reason: "too_long" };
  }
  if (/\s/.test(normalized)) {
    return { kind: "unsupported", normalized, reason: "multiple_words" };
  }
  if (!supportedTerm.test(normalized)) {
    return { kind: "unsupported", normalized, reason: "unsupported_characters" };
  }
  return { kind: "supported", normalized };
}
