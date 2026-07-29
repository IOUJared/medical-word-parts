import Link from "next/link";
import type { Metadata } from "next";

import { PageHeading } from "../../components/page-heading";
import { corpus } from "../../generated/corpus";
import { createPageMetadata } from "../../lib/metadata";

export const metadata: Metadata = createPageMetadata("Common Medical Terms", "A frequency-backed entry point to verified medical word-part analyses.", "/common-medical-terms/");

const frequencySource = corpus.sources.find((source) => source.id === "source:nlm-snomed-core-subset");
const verifiedTerms = [...corpus.terms].sort((left, right) => left.term.localeCompare(right.term));

export default function CommonMedicalTermsPage() {
  return <div className="page-sheet"><PageHeading overline="Common clinical vocabulary" title="Common medical terms"><p>The National Library of Medicine CORE Problem List Subset is built from frequently used clinical problem-list terms. This page only lists entries whose word parts are verified in the local corpus.</p></PageHeading><section className="method-band" aria-labelledby="common-source"><h2 id="common-source">Frequency source</h2>{frequencySource === undefined ? <p>The frequency source is not registered.</p> : <p><a href={frequencySource.url} target="_blank" rel="noreferrer">{frequencySource.title}</a> reports a frequently used SNOMED CT problem-list subset derived from institutional clinical usage data. Raw subset entries are not copied here until their educational word-part analyses are source-checked.</p>}<p>Goal: top 10,000 common medical terms. Published now: {verifiedTerms.length} verified authored records with checked word parts.</p></section><section aria-labelledby="verified-common-terms"><div className="section-heading"><p className="overline">Verified subset</p><h2 id="verified-common-terms">Terms with checked word parts</h2></div><ol className="source-ledger source-index">{verifiedTerms.map((term) => <li key={term.id}><p className="source-number">Verified word-part record</p><h2><Link href={`/term/${term.slug}/`} prefetch={false}>{term.term}</Link></h2><p>{term.note}</p></li>)}</ol></section><aside className="evidence-strip"><div><p className="overline">Verification rule</p><h2>No raw imports</h2></div><p>Frequency lists and terminology subsets can identify candidates, but this guide only publishes terms after their parts, spans, and citations pass corpus validation.</p><p><Link href="/methodology/" prefetch={false}>Read the methodology</Link></p></aside></div>;
}
