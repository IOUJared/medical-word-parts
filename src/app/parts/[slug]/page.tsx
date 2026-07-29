import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "../../../components/breadcrumbs";
import { CorrectionFlow } from "../../../components/correction-flow";
import { PageHeading } from "../../../components/page-heading";
import { SourceLedger } from "../../../components/source-ledger";
import { getPartUsage } from "../../../core/relations";
import { corpus } from "../../../generated/corpus";
import { findPartBySlug, partKindLabel, partSlug } from "../../../lib/catalog";
import { createPageMetadata } from "../../../lib/metadata";

type PageProps = { readonly params: Promise<{ readonly slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return corpus.parts.map((part) => ({ slug: partSlug(part) }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const part = findPartBySlug(slug);
  return part === undefined ? {} : createPageMetadata(`${part.form} word part`, `${partKindLabel(part.kind)} meaning ${part.meaning}.`, `/parts/${slug}/`);
}

export default async function PartDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const part = findPartBySlug(slug);
  if (part === undefined) notFound();
  const usage = getPartUsage(part.id);
  return <div className="page-sheet"><Breadcrumbs items={[{ label: "Word parts", href: "/parts/" }, { label: part.form }]} /><PageHeading overline={partKindLabel(part.kind)} title={part.form}><p>{part.meaning}</p></PageHeading><section className={`part-definition segment-${part.kind}`}><p className="kind-code">{partKindLabel(part.kind)}</p><h2>Reference meaning</h2><p className="term-display">{part.meaning}</p><p>Canonical notation: <strong>{part.form}</strong></p></section><section aria-labelledby="usage-heading"><div className="section-heading"><p className="overline">Corpus usage</p><h2 id="usage-heading">Example terms</h2></div>{usage.length === 0 ? <p className="empty-panel">No authored term currently uses this exact part record.</p> : <ul className="relation-list">{usage.map((term) => <li key={term.id}><Link href={`/term/${term.slug}/`}>{term.term}</Link></li>)}</ul>}</section><SourceLedger sourceIds={part.sources} /><CorrectionFlow subject={part.form} currentBreakdown={`${part.form}: ${part.meaning}`} /></div>;
}
