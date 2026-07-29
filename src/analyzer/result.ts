import { unionCitations, type AnalyzerResult, type AuthoredAnalysis, type CandidateAnalysis } from "../core/analyzer";
import { assertNever } from "../core/invariants";
import { renderAlternatives } from "./alternatives";
import { renderCorrection } from "./correction";
import { createElement } from "./dom";
import { renderMorphology } from "./morphology";
import { renderSourceLedger } from "./source-ledger";
import { renderStatus } from "./status";

type Analysis = AuthoredAnalysis | CandidateAnalysis;

function breakdown(analysis: Analysis): string {
  return analysis.segments.map((segment) => segment.notation).join(" + ");
}

function appendAlternatives(container: HTMLElement, alternatives: HTMLElement | null): void {
  if (alternatives !== null) container.append(alternatives);
}

function unsupportedMessage(result: Extract<AnalyzerResult, { readonly kind: "unsupported" }>): string {
  switch (result.reason) {
    case "empty": return "Enter one medical term to analyze.";
    case "too_long": return "This input is longer than the local analyzer supports.";
    case "multiple_words": return "Analyze one word at a time.";
    case "unsupported_characters": return "Use letters, an internal hyphen, or an apostrophe.";
    case "no_known_parts": return "No known word parts were found in the local corpus.";
    default: return assertNever(result.reason);
  }
}

export function renderAnalyzerResult(window: Window, result: AnalyzerResult): HTMLElement {
  const { document } = window;
  const container = createElement(document, "div", { className: "analysis-result" });
  container.dataset["testid"] = "analysis-result";
  switch (result.kind) {
    case "exact": {
      const status = result.provenance.kind === "alias" ? "alias" : "verified";
      container.dataset["resultStatus"] = status;
      container.append(renderStatus(document, {
        tone: "verified",
        label: status === "alias" ? "Verified alias" : "Verified entry",
        message: "This authored corpus entry provides the primary analysis.",
      }));
      const primary = createElement(document, "div");
      primary.dataset["testid"] = "primary-analysis";
      primary.append(renderMorphology(document, {
        analysis: result.primary,
        reconstructedTerm: result.term.term,
        headingId: "primary-morphology-heading",
      }));
      container.append(primary);
      if (result.primary.qualification !== undefined) {
        container.append(createElement(document, "p", { className: "qualification", text: result.primary.qualification }));
      }
      appendAlternatives(container, renderAlternatives(window, result.alternatives, result.term.term));
      const citations = unionCitations(
        result.term.citations,
        result.provenance.kind === "alias" ? result.provenance.citations : [],
        result.primary,
        ...result.alternatives,
      );
      container.append(renderSourceLedger(document, citations));
      container.append(renderCorrection(window, result.term.term, breakdown(result.primary)));
      return container;
    }
    case "derived":
      container.dataset["resultStatus"] = "derived";
      container.append(renderStatus(document, {
        tone: "derived",
        label: "Constructed from known parts",
        message: "This is a local computational construction, not an authored term entry.",
      }));
      container.append(renderMorphology(document, {
        analysis: result,
        reconstructedTerm: result.normalized,
        headingId: "primary-morphology-heading",
      }));
      appendAlternatives(container, renderAlternatives(window, result.alternatives, result.normalized));
      container.append(renderSourceLedger(document, unionCitations(result, ...result.alternatives)));
      container.append(renderCorrection(window, result.normalized, breakdown(result)));
      return container;
    case "partial":
      container.dataset["resultStatus"] = "partial";
      container.append(renderStatus(document, {
        tone: "partial",
        label: "Partial match",
        message: "Known parts are shown in order; unresolved characters remain literal.",
      }));
      container.append(renderMorphology(document, {
        analysis: result,
        reconstructedTerm: result.normalized,
        headingId: "primary-morphology-heading",
      }));
      appendAlternatives(container, renderAlternatives(window, result.alternatives, result.normalized));
      container.append(renderSourceLedger(document, unionCitations(result, ...result.alternatives)));
      container.append(renderCorrection(window, result.normalized, breakdown(result)));
      return container;
    case "unsupported":
      container.dataset["resultStatus"] = "unsupported";
      container.append(renderStatus(document, {
        tone: "unsupported",
        label: "Unsupported",
        message: unsupportedMessage(result),
        live: true,
      }));
      return container;
    default:
      return assertNever(result);
  }
}
