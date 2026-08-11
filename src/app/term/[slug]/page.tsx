import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../../../components/breadcrumbs";
import { AnalysisAlternatives } from "../../../components/analysis-alternatives";
import { CorrectionFlow } from "../../../components/correction-flow";
import { MorphologyRail } from "../../../components/morphology-rail";
import { SourceLedger } from "../../../components/source-ledger";
import { StatusPanel } from "../../../components/status-panel";
import { analyzeTerm, unionCitations } from "../../../core/analyzer";
import { getRelatedTerms } from "../../../core/relations";
import { routeSlugs } from "../../../generated/routes";
import { findTermBySlug } from "../../../lib/catalog";
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
    <section className="term-opening" aria-labelledby="term-heading">
      <p className="overline">Verified corpus entry</p>
      <h1 className={result.term.term.length >= 19 ? "long-term" : undefined} id="term-heading">{result.term.term}</h1>
    </section>
    <MorphologyRail analysis={result.primary} headingId="term-primary-morphology-heading" reconstructedTerm={result.term.term} />
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: result.term.term }]} />
    <StatusPanel tone="verified" label="Verified entry"><p>This primary analysis is authored in the local corpus. It is a terminology record, not medical advice.</p></StatusPanel>
    <section className="term-note" aria-labelledby="term-note-heading">
      <div className="section-heading"><p className="overline">Corpus context</p><h2 id="term-note-heading">Authored note</h2></div>
      <p>{result.term.note}</p>
    </section>
    {result.primary.qualification === undefined ? null : <p className="qualification">{result.primary.qualification}</p>}
    <AnalysisAlternatives analyses={result.alternatives} headingIdPrefix="term-alternative" term={result.term.term} />
    <section aria-labelledby="related-heading"><div className="section-heading"><p className="overline">Reference paths</p><h2 id="related-heading">Parts and related terms</h2></div><ul className="relation-list">{result.primary.segments.map((segment) => <li key={`${segment.partId}-${segment.start}`}><Link href={`/parts/${segment.partId.replace(":", "-")}/`}>{segment.notation}</Link> — {segment.meaning}</li>)}{related.map((relation) => <li key={`${relation.kind}-${relation.term.id}`}><span className="kind-code">{relation.kind}</span> <Link href={`/term/${relation.term.slug}/`}>{relation.term.term}</Link></li>)}</ul></section>
    <SourceLedger sourceIds={citations} />
    <CorrectionFlow subject={result.term.term} currentBreakdown={result.primary.segments.map((segment) => segment.notation).join(" + ")} />
  </div>;
}
