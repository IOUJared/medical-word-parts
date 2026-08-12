import Link from "next/link";

import type { Segment } from "../core";
import { partKindLabel, partSlug } from "../lib/catalog";

function Transformation({ segment }: { readonly segment: Segment }) {
  if (segment.transformations.length === 0) return null;
  return <small className="term-construction-note">The combining vowel <strong>o</strong> drops before the next part.</small>;
}

export function TermConstruction({ segments }: { readonly segments: readonly Segment[] }) {
  return <section className="term-construction" aria-labelledby="term-construction-heading">
    <div className="section-heading"><h2 id="term-construction-heading">Construction</h2></div>
    <ol className="term-construction-list">{segments.map((segment) => <li className="term-construction-part" key={`${segment.partId}-${segment.start}`}>
      <span className="kind-code">{partKindLabel(segment.kind)}</span>
      <Link href={`/parts/${partSlug({ id: segment.partId })}/`} prefetch={false}>{segment.notation}</Link>
      <Transformation segment={segment} />
    </li>)}</ol>
  </section>;
}
