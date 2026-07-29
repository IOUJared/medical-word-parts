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

  it.each(representativeTerms)("Given the authored %s term, when its page renders, then the canonical word and complete primary morphology lead the document", async (slug) => {
    const analysis = analyzeTerm(slug);
    if (analysis.kind !== "exact") throw new TypeError(`Expected exact analysis for ${slug}`);

    const { container } = render(await TermDetailPage({ params: Promise.resolve({ slug }) }));
    const sheet = container.querySelector<HTMLElement>(".page-sheet");
    if (sheet === null) throw new TypeError("Expected term page sheet");
    const first = sheet.children.item(0);
    const second = sheet.children.item(1);
    if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) throw new TypeError("Expected leading term blocks");

    expect(first).toHaveClass("term-opening");
    expect(first.tagName).toBe("SECTION");
    expect(within(first).getByRole("heading", { level: 1, name: analysis.term.term })).toBeVisible();
    expect(within(first).getByText("Verified corpus entry")).toBeVisible();
    expect(second).toHaveClass("morphology");

    const segments = [...second.querySelectorAll<HTMLElement>(".morphology-rail > li")];
    expect(segments).toHaveLength(analysis.primary.segments.length);
    for (const [index, segment] of analysis.primary.segments.entries()) {
      const rendered = segments[index];
      if (rendered === undefined) throw new TypeError(`Missing rendered segment ${index}`);
      expect(rendered).toHaveAttribute("data-surface", segment.surface);
      expect(within(rendered).getByRole("heading", { level: 3, name: segment.notation })).toBeVisible();
      expect(rendered.querySelector(".segment-surface")).toHaveTextContent(`Surface: ${segment.surface}`);
      expect(within(rendered).getByText(segment.meaning)).toBeVisible();
    }
  });
});
