import type { AuthoredAnalysis, CandidateAnalysis } from "../core/analyzer";
import { MorphologyRail } from "./morphology-rail";

type Analysis = AuthoredAnalysis | CandidateAnalysis;

function notation(analysis: Analysis): string {
  return analysis.segments.map((segment) => segment.notation).join(" + ");
}

function qualification(analysis: Analysis): string | undefined {
  return "qualification" in analysis ? analysis.qualification : undefined;
}

export function AnalysisAlternatives({ analyses, headingIdPrefix, term, showReconstruction = true }: { readonly analyses: readonly Analysis[]; readonly headingIdPrefix: string; readonly term: string; readonly showReconstruction?: boolean }) {
  const first = analyses[0];
  if (first === undefined) return null;
  const firstQualification = qualification(first);
  return <details className="alternatives" aria-label="Alternative analyses"><summary><span>Alternative {analyses.length === 1 ? "analysis" : `analyses (${analyses.length})`}</span><span className="alternative-preview">{notation(first)}{firstQualification === undefined ? null : ` - ${firstQualification}`}{analyses.length > 1 ? `; plus ${analyses.length - 1} more` : null}</span></summary>{analyses.map((analysis, index) => <section className="alternative" key={"id" in analysis ? analysis.id : notation(analysis)}><h3>Alternative {index + 1}</h3>{qualification(analysis) === undefined ? null : <p>{qualification(analysis)}</p>}<MorphologyRail analysis={analysis} headingId={`${headingIdPrefix}-${index + 1}-morphology-heading`} reconstructedTerm={term} showReconstruction={showReconstruction} /></section>)}</details>;
}
