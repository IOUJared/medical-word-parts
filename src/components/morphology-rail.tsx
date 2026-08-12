import Link from "next/link";

import { partKindCode, partKindLabel, partSlug } from "../lib/catalog";
import { orderedRailItems, type RailAnalysis } from "../lib/morphology";
import type { Segment } from "../core";

function Transformation({ segment }: { readonly segment: Segment }) {
  if (segment.transformations.length === 0) return null;
  return <p className="segment-transform">Combining vowel <strong>o</strong> is dropped before the next part.</p>;
}

type MorphologyRailProps = {
  readonly analysis: RailAnalysis;
  readonly headingId: string;
  readonly reconstructedTerm: string;
  readonly showReconstruction?: boolean;
};

export function MorphologyRail({ analysis, headingId, reconstructedTerm, showReconstruction = true }: MorphologyRailProps) {
  const items = orderedRailItems(analysis);
  const summary = items.map((item) => item.kind === "segment" ? `${partKindLabel(item.segment.kind)} ${item.segment.notation}, ${item.segment.meaning}` : `unresolved ${item.span.surface}`).join("; ");
  return <section className="morphology" aria-labelledby={headingId}>
    <div className="section-heading"><p className="overline">Reading order</p><h2 id={headingId}>Morphology rail</h2></div>
    <p className="rail-summary"><strong>Construction:</strong> {summary}{showReconstruction ? <>; reconstructs <strong>{reconstructedTerm}</strong>.</> : "."}</p>
    <ol className="morphology-rail">{items.map((item, index) => {
      if (item.kind === "unresolved") return <li className="segment segment-unresolved" data-surface={item.span.surface} data-unresolved="true" key={`unresolved-${item.start}`}>
        <span className="ordinal">{String(index + 1).padStart(2, "0")}</span><span className="kind-code">? / Unresolved</span><strong>{item.span.surface}</strong><p>These literal characters are not explained by a known part.</p>
      </li>;
      const href = `/parts/${partSlug({ id: item.segment.partId })}/`;
      return <li className={`segment segment-${item.segment.kind}`} data-surface={item.segment.surface} key={`${item.segment.partId}-${item.start}`}>
        <span className="ordinal">{String(index + 1).padStart(2, "0")}</span><span className="kind-code">{partKindCode(item.segment.kind)} / {partKindLabel(item.segment.kind)}</span>
        <h3><Link href={href} prefetch={false}>{item.segment.notation}</Link></h3><p className="segment-surface">Surface: <strong>{item.segment.surface}</strong></p><p>{item.segment.meaning}</p><Transformation segment={item.segment} />
      </li>;
    })}</ol>
    {showReconstruction ? <p className={reconstructedTerm.length >= 19 ? "reconstruction long-term" : "reconstruction"} aria-label={`Reconstructed term: ${reconstructedTerm}`}><span aria-hidden="true">→</span> {reconstructedTerm}</p> : null}
  </section>;
}
