import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CorrectionFlow } from "../../src/components/correction-flow";
import { MorphologyRail } from "../../src/components/morphology-rail";
import { StatusPanel } from "../../src/components/status-panel";
import { TermSearchForm } from "../../src/components/term-search-form";
import { analyzeTerm } from "../../src/core/analyzer";

describe("test-only primitive coverage", () => {
  it("Given action and field primitives, when the harness renders, then primary, secondary, quiet, disabled, and search states remain semantic", () => {
    render(<div>
      <button className="button button-primary" type="button">Primary action</button>
      <button className="button button-secondary" type="button">Secondary action</button>
      <button className="button button-quiet" type="button">Quiet action</button>
      <button className="button button-secondary" disabled type="button">Unavailable</button>
      <TermSearchForm compact />
    </div>);

    expect(screen.getByRole("button", { name: "Primary action" })).toHaveClass("button-primary");
    expect(screen.getByRole("button", { name: "Secondary action" })).toHaveClass("button-secondary");
    expect(screen.getByRole("button", { name: "Quiet action" })).toHaveClass("button-quiet");
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: "Medical term" })).toBeInTheDocument();
  });

  it("Given status primitives, when the harness renders, then every declared visual tone remains covered", () => {
    render(<div>
      <StatusPanel label="Verified entry" tone="verified"><p>Authored.</p></StatusPanel>
      <StatusPanel label="Constructed" tone="derived"><p>Derived.</p></StatusPanel>
      <StatusPanel label="Partial match" tone="partial"><p>Partial.</p></StatusPanel>
      <StatusPanel label="Unsupported" tone="unsupported"><p>Unsupported.</p></StatusPanel>
      <StatusPanel label="Ready" tone="neutral"><p>Neutral.</p></StatusPanel>
      <StatusPanel label="Privacy" tone="privacy"><p>Public.</p></StatusPanel>
    </div>);

    for (const tone of ["verified", "derived", "partial", "unsupported", "neutral", "privacy"] as const) {
      expect(document.querySelector(`.status-${tone}`)).not.toBeNull();
    }
  });

  it("Given morphology and correction primitives, when the harness renders, then resolved, partial, and public-fallback states keep unique semantics", () => {
    const exact = analyzeTerm("hypoglycemia");
    const partial = analyzeTerm("hypoxnephritis");
    if (exact.kind !== "exact" || partial.kind !== "partial") throw new TypeError("Expected primitive fixtures");
    const { container } = render(<div>
      <MorphologyRail analysis={exact.primary} headingId="fixture-exact-morphology" reconstructedTerm={exact.term.term} />
      <MorphologyRail analysis={partial} headingId="fixture-partial-morphology" reconstructedTerm={partial.normalized} />
      <CorrectionFlow currentBreakdown="hypo- + glyc/o + -emia" subject="hypoglycemia" />
    </div>);
    const ids = [...container.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);

    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(container.querySelector("[data-unresolved='true']")).not.toBeNull();
    expect(screen.getByRole("link", { name: /Propose a correction on GitHub/ })).toBeInTheDocument();
    expect(screen.getByText("Copyable fallback template")).toBeInTheDocument();
  });
});
