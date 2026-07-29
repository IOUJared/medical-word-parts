import { findSource } from "../lib/catalog";

export function SourceLedger({ sourceIds }: { readonly sourceIds: readonly string[] }) {
  return <section className="source-section" aria-labelledby="source-ledger-heading">
    <div className="section-heading"><p className="overline">Provenance</p><h2 id="source-ledger-heading">Source ledger</h2></div>
    <ol className="source-ledger">{sourceIds.map((sourceId, index) => {
      const source = findSource(sourceId);
      if (source === undefined) return null;
      const host = new URL(source.url).hostname;
      return <li id={source.id} key={source.id} tabIndex={-1}>
        <p className="source-number">Source {index + 1}</p>
        <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></h3>
        <p>{source.publisher}</p><p className="source-host">External link to {host}; opens in a new tab.</p>
      </li>;
    })}</ol>
  </section>;
}
