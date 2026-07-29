import type { AuthoredAnalysis, CandidateAnalysis } from "../core/analyzer";
import { createElement } from "./dom";
import { renderMorphology } from "./morphology";

type Analysis = AuthoredAnalysis | CandidateAnalysis;

function notation(analysis: Analysis): string {
  return analysis.segments.map((segment) => segment.notation).join(" + ");
}

function qualification(analysis: Analysis): string | undefined {
  return "qualification" in analysis ? analysis.qualification : undefined;
}

export function renderAlternatives(window: Window, analyses: readonly Analysis[], term: string): HTMLElement | null {
  const first = analyses[0];
  if (first === undefined) return null;
  const { document } = window;
  const details = createElement(document, "details", { className: "alternatives" });
  details.setAttribute("aria-label", "Alternative analyses");
  const summary = createElement(document, "summary");
  summary.append(createElement(document, "span", {
    text: analyses.length === 1 ? "Alternative analysis" : `Alternative analyses (${analyses.length})`,
  }));
  const firstQualification = qualification(first);
  const preview = `${notation(first)}${firstQualification === undefined ? "" : ` - ${firstQualification}`}${analyses.length > 1 ? `; plus ${analyses.length - 1} more` : ""}`;
  summary.append(createElement(document, "span", { className: "alternative-preview", text: preview }));
  details.append(summary);
  analyses.forEach((analysis, index) => {
    const section = createElement(document, "section", { className: "alternative" });
    section.append(createElement(document, "h3", { text: `Alternative ${index + 1}` }));
    const analysisQualification = qualification(analysis);
    if (analysisQualification !== undefined) section.append(createElement(document, "p", { text: analysisQualification }));
    section.append(renderMorphology(document, {
      analysis,
      reconstructedTerm: term,
      headingId: `alternative-${index + 1}-morphology-heading`,
    }));
    details.append(section);
  });
  return details;
}
