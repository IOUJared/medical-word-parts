import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MorphologyRail } from "../../src/components/morphology-rail";
import { analyzeTerm } from "../../src/core";
import TermDetailPage from "../../src/app/term/[slug]/page";

describe("morphology reading order", () => {
  it("Given a partial result, when rendered, then resolved and unresolved spans follow source order", () => {
    const result = analyzeTerm("hypoxnephritis");
    if (result.kind !== "partial") throw new TypeError("Expected partial fixture");
    render(<MorphologyRail analysis={result} headingId="partial-morphology-heading" reconstructedTerm={result.normalized} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-surface"))).toEqual(["hypo", "x", "nephr", "itis"]);
    expect(screen.getByText("x").closest("li")).toHaveAttribute("data-unresolved", "true");
  });

  it("Given a term with primary and alternative analyses, when its static page renders, then every DOM id is unique", async () => {
    const page = await TermDetailPage({ params: Promise.resolve({ slug: "adrenal" }) });
    const { container } = render(page);
    const ids = [...container.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);

    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    for (const rail of container.querySelectorAll<HTMLElement>(".morphology")) {
      const headingId = rail.getAttribute("aria-labelledby");
      expect(headingId).not.toBeNull();
      expect(rail.querySelector(`#${headingId}`)).not.toBeNull();
    }
  });

  it("Given hypoglycemia, when its static page renders, then term and segment citations are visible in authored order", async () => {
    const page = await TermDetailPage({ params: Promise.resolve({ slug: "hypoglycemia" }) });
    const { container } = render(page);
    const ledger = container.querySelector(".source-section");

    if (ledger === null) throw new TypeError("Expected source ledger fixture");
    expect([...ledger.querySelectorAll<HTMLElement>("li")].map((item) => item.id)).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
  });

  it("Given adrenal alternatives, when its static page renders, then displayed segment citations are merged once", async () => {
    const page = await TermDetailPage({ params: Promise.resolve({ slug: "adrenal" }) });
    const { container } = render(page);
    const ledger = container.querySelector(".source-section");

    if (ledger === null) throw new TypeError("Expected source ledger fixture");
    expect([...ledger.querySelectorAll<HTMLElement>("li")].map((item) => item.id)).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
  });
});
