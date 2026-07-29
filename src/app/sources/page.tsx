import Link from "next/link";

import { PageHeading } from "../../components/page-heading";
import { corpus } from "../../generated/corpus";
import { sourceCitations } from "../../generated/index";
import { createPageMetadata } from "../../lib/metadata";

export const metadata = createPageMetadata("Sources", "Review every external source cited by the local terminology corpus.", "/sources/");

export default function SourcesPage() {
  return <div className="page-sheet"><PageHeading overline="Provenance ledger" title="Sources"><p>Sources support individual term, part, alias, or relationship records. A citation documents editorial provenance; it does not make this guide clinical advice.</p></PageHeading><section className="method-band" aria-labelledby="citation-method"><h2 id="citation-method">How citations work</h2><p>Source links open the authored external record in a new tab. The number of corpus records below shows where each source is used locally.</p></section><ol className="source-ledger source-index">{corpus.sources.map((source, index) => { const bucket = Object.entries(sourceCitations).find(([id]) => id === source.id); const count = bucket === undefined ? 0 : bucket[1].terms.length + bucket[1].parts.length + bucket[1].aliases.length + bucket[1].relations.length; return <li id={source.id} key={source.id}><p className="source-number">Source {index + 1} / {count} cited records</p><h2><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></h2><p>{source.publisher}</p><p className="source-host">External source at {new URL(source.url).hostname}; opens in a new tab.</p></li>; })}</ol><aside className="evidence-strip"><div><p className="overline">Scope</p><h2>External links leave this guide</h2></div><p>Other sites have their own privacy practices. Do not send personal medical details through this reference.</p><p><Link href="/methodology/">Read the methodology</Link></p></aside></div>;
}
