import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CommonMedicalTermsPage from "../../src/app/common-medical-terms/page";
import { candidateTerms } from "../../src/generated/candidates";
import { corpus } from "../../src/generated/corpus";

describe("common medical terms page", () => {
  it("Given a frequency-backed source, when the page renders, then only verified local term records are listed", () => {
    render(<CommonMedicalTermsPage />);

    expect(screen.getByRole("link", { name: "The CORE Problem List Subset of SNOMED CT" })).toHaveAttribute("href", "https://www.nlm.nih.gov/research/umls/Snomed/core_subset.html");
    expect(screen.getByText(/Raw subset entries are not copied here until their educational word-part analyses are source-checked\./)).toBeVisible();
    expect(screen.getByText(`Goal: top 10,000 common medical terms. Published now: ${corpus.terms.length} verified authored records with checked word parts.`)).toBeVisible();
    expect(screen.getAllByText("Verified word-part record")).toHaveLength(corpus.terms.length);
  });

  it("Given open candidate terms, when the page renders, then candidates are separated from verified records", () => {
    render(<CommonMedicalTermsPage />);

    expect(screen.getByRole("heading", { name: "Candidate terms awaiting verification" })).toBeVisible();
    expect(screen.getByText(`Discovery queue: ${candidateTerms.length} open-source candidate terms awaiting authored word-part review.`)).toBeVisible();
    expect(screen.getAllByText("Candidate only - no verified word parts yet")).toHaveLength(candidateTerms.length);
    expect(screen.getByText("diabetes")).toBeVisible();
  });
});
