import { describe, expect, it, vi } from "vitest";

import { analyzeTerm } from "../../src/core/analyzer";
import { corpus } from "../../src/generated/corpus";

describe("analyzer catalog lookup budget", () => {
  it("Given repeated exact and partial analyses, when catalog records resolve, then immutable arrays are not linearly rescanned", () => {
    const partScans = vi.spyOn(corpus.parts, "find");
    const termScans = vi.spyOn(corpus.terms, "find");
    const aliasScans = vi.spyOn(corpus.aliases, "find");

    analyzeTerm("adrenal");
    analyzeTerm("hypoxnephritis");

    expect(partScans).not.toHaveBeenCalled();
    expect(termScans).not.toHaveBeenCalled();
    expect(aliasScans).not.toHaveBeenCalled();
    partScans.mockRestore();
    termScans.mockRestore();
    aliasScans.mockRestore();
  });
});
