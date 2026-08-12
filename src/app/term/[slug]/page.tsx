import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../../../components/breadcrumbs";
import { AnalysisAlternatives } from "../../../components/analysis-alternatives";
import { CorrectionFlow } from "../../../components/correction-flow";
import { CheckIcon } from "../../../components/icons";
import { SourceLedger } from "../../../components/source-ledger";
import { TermConstruction } from "../../../components/term-construction";
import { analyzeTerm, unionCitations } from "../../../core/analyzer";
import { getRelatedTerms } from "../../../core/relations";
import { routeSlugs } from "../../../generated/routes";
import { findTermBySlug, partKindLabel, partSlug } from "../../../lib/catalog";
import { createPageMetadata } from "../../../lib/metadata";

type PageProps = { readonly params: Promise<{ readonly slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return routeSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const term = findTermBySlug(slug);
  return term === undefined ? {} : createPageMetadata(term.term, term.note, `/term/${term.slug}/`);
}

export default async function TermDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const term = findTermBySlug(slug);
  if (term === undefined) notFound();
  const result = analyzeTerm(term.normalized);
  if (result.kind !== "exact" || result.term.id !== term.id) notFound();
  const related = getRelatedTerms(result.term.id);
  const citations = unionCitations(
    result.term.citations,
    result.provenance.kind === "alias" ? result.provenance.citations : [],
    result.primary,
    ...result.alternatives,
  );
  return <div className="page-sheet term-page">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: result.term.term }]} />
    <header className="term-opening">
      <h1 className={result.term.term.length >= 19 ? "long-term" : undefined} id="term-heading">{result.term.term}</h1>
      <p className="term-verification"><CheckIcon className="status-icon" /> Verified entry</p>
    </header>
    <TermConstruction segments={result.primary.segments} />
    <section className="term-parts" aria-labelledby="term-parts-heading">
      <div className="section-heading"><h2 id="term-parts-heading">Parts</h2></div>
      <dl className="term-parts-list">{result.primary.segments.map((segment) => <div className="term-part-row" key={`${segment.partId}-${segment.start}`}>
        <dt><Link href={`/parts/${partSlug({ id: segment.partId })}/`} prefetch={false}>{segment.notation}</Link><span className="kind-code">{partKindLabel(segment.kind)}</span></dt>
        <dd>{segment.meaning}</dd>
      </div>)}</dl>
    </section>
    {related.length === 0 ? null : <section className="term-related" aria-labelledby="related-heading"><div className="section-heading"><h2 id="related-heading">Related terms</h2></div><ul className="relation-list">{related.map((relation) => <li key={`${relation.kind}-${relation.term.id}`}><span className="kind-code">{relation.kind}</span> <Link href={`/term/${relation.term.slug}/`}>{relation.term.term}</Link></li>)}</ul></section>}
    {result.primary.qualification === undefined ? null : <p className="qualification">{result.primary.qualification}</p>}
    <AnalysisAlternatives analyses={result.alternatives} headingIdPrefix="term-alternative" term={result.term.term} showReconstruction={false} />
    <SourceLedger sourceIds={citations} />
    <CorrectionFlow subject={result.term.term} currentBreakdown={result.primary.segments.map((segment) => segment.notation).join(" + ")} />
  </div>;
}
