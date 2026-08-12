import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TermDetailPage from "../../src/app/term/[slug]/page";
import { analyzeTerm } from "../../src/core/analyzer";

const representativeTerms = ["adrenal", "cytokine", "hypoglycemia"] as const;
const divergentSlug = "adrenal-entry";

vi.mock("../../src/lib/catalog", async (importOriginal) => {
  const catalog = await importOriginal<typeof import("../../src/lib/catalog")>();
  return {
    ...catalog,
    findTermBySlug: (slug: string) =>
      slug === divergentSlug
        ? { id: "term:adrenal", normalized: "adrenal" }
        : catalog.findTermBySlug(slug),
  };
});

describe("verified term hierarchy", () => {
  it("Given a valid term whose slug differs from normalized text, when its route renders, then the resolved canonical term is shown", async () => {
    const { getByRole } = render(await TermDetailPage({ params: Promise.resolve({ slug: divergentSlug }) }));

    expect(getByRole("heading", { level: 1, name: "adrenal" })).toBeVisible();
  });

  it.each(representativeTerms)("Given the authored %s term, when its page renders, then the breadcrumb, canonical word, concise construction, and parts lead the document without repeated identity", async (slug) => {
    const analysis = analyzeTerm(slug);
    if (analysis.kind !== "exact") throw new TypeError(`Expected exact analysis for ${slug}`);

    const { container } = render(await TermDetailPage({ params: Promise.resolve({ slug }) }));
    const sheet = container.querySelector<HTMLElement>(".page-sheet");
    if (sheet === null) throw new TypeError("Expected term page sheet");
    const leadingBlocks = [...sheet.children].slice(0, 4);
    expect(leadingBlocks[0]).toHaveClass("breadcrumbs");
    expect(leadingBlocks[1]).toHaveClass("term-opening");
    expect(leadingBlocks[2]).toHaveClass("term-construction");
    expect(leadingBlocks[3]).toHaveClass("term-parts");

    const opening = leadingBlocks[1];
    const construction = leadingBlocks[2];
    const parts = leadingBlocks[3];
    if (!(opening instanceof HTMLElement) || !(construction instanceof HTMLElement) || !(parts instanceof HTMLElement)) throw new TypeError("Expected leading term blocks");

    expect(within(opening).getByRole("heading", { level: 1, name: analysis.term.term })).toBeVisible();
    expect(within(opening).getByText("Verified entry")).toBeVisible();
    expect(within(construction).getByRole("heading", { level: 2, name: "Construction" })).toBeVisible();
    expect(within(parts).getByRole("heading", { level: 2, name: "Parts" })).toBeVisible();
    expect(within(sheet).getAllByText(analysis.term.term)).toHaveLength(2);
    expect(sheet.querySelector(":scope > .morphology")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Authored note")).not.toBeInTheDocument();
    expect(sheet.querySelector(".reconstruction")).not.toBeInTheDocument();

    const segments = [...construction.querySelectorAll<HTMLElement>(".term-construction-part")];
    const partRows = [...parts.querySelectorAll<HTMLElement>(".term-part-row")];
    expect(segments).toHaveLength(analysis.primary.segments.length);
    expect(partRows).toHaveLength(analysis.primary.segments.length);
    for (const [index, segment] of analysis.primary.segments.entries()) {
      const rendered = segments[index];
      const partRow = partRows[index];
      if (rendered === undefined) throw new TypeError(`Missing rendered segment ${index}`);
      if (partRow === undefined) throw new TypeError(`Missing rendered part row ${index}`);
      expect(within(rendered).getByRole("link", { name: segment.notation })).toBeVisible();
      expect(within(partRow).getByRole("link", { name: segment.notation })).toBeVisible();
      expect(within(partRow).getByText(segment.meaning)).toBeVisible();
    }
  });
});
