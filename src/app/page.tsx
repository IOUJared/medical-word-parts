import Link from "next/link";
import type { Metadata } from "next";

import { MorphologyRail } from "../components/morphology-rail";
import { PageHeading } from "../components/page-heading";
import { TermSearchForm } from "../components/term-search-form";
import { analyzeTerm } from "../core/analyzer";
import { corpus } from "../generated/corpus";
import { createPageMetadata } from "../lib/metadata";

export const metadata: Metadata = createPageMetadata("Medical Word Parts", "A sourced field guide for learning medical terminology construction.", "/");

const kindLinks = [
  ["Prefixes", "prefix", "Begin or qualify a construction."],
  ["Roots", "root", "Carry the central lexical meaning."],
  ["Suffixes", "suffix", "Close or classify a construction."],
  ["Combining forms", "combiningForm", "Join a root with a combining vowel."],
] as const;

export default function HomePage() {
  const example = analyzeTerm("hypoglycemia");
  return <div className="page-sheet home-page">
    <PageHeading overline="Sourced terminology field guide" title="Read the parts. Verify the construction."><p>Explore how authored medical terms are assembled from prefixes, roots, suffixes, and combining forms. Results distinguish verified entries from local computational analysis.</p></PageHeading>
    <section className="lookup-block" aria-labelledby="lookup-heading"><div className="section-heading"><p className="overline">Start with a term</p><h2 id="lookup-heading">Look up or analyze</h2></div><TermSearchForm /></section>
    {example.kind === "exact" ? <section className="example-block" aria-labelledby="example-heading"><p className="margin-note">Example 01 / verified construction</p><h2 id="example-heading" className="sr-only">Field guide example</h2><MorphologyRail analysis={example.primary} headingId="home-example-morphology-heading" reconstructedTerm={example.term.term} /></section> : null}
    <section className="browse-block" aria-labelledby="browse-heading"><div className="section-heading"><p className="overline">Reference index</p><h2 id="browse-heading">Browse by kind</h2></div><div className="kind-index">{kindLinks.map(([label, kind, description]) => <Link key={kind} href={`/parts/?kind=${kind}`} prefetch={false}><span>{label}</span><strong>{corpus.parts.filter((part) => part.kind === kind).length}</strong><small>{description}</small></Link>)}</div></section>
    <aside className="evidence-strip"><div><p className="overline">How to read this guide</p><h2>Evidence stays visible</h2></div><p>Authored records, generated constructions, limitations, and source links are labeled rather than blended together.</p><p><Link href="/sources/" prefetch={false}>Review sources</Link><br /><Link href="/methodology/" prefetch={false}>Read the methodology</Link></p></aside>
  </div>;
}
