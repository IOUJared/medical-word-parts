import { partKindLabel, partKinds, type PartRecord } from "../lib/catalog";
import { publicUrl } from "../lib/paths";
import { PartGroups } from "./part-groups";
import { ProgressiveEnhancerScript } from "./progressive-enhancer-script";

export function PartsIndex({ parts }: { readonly parts: readonly PartRecord[] }) {
  return <div className="parts-browser" data-base-path={publicUrl("/").slice(0, -1)} data-parts-root>
    <section aria-label="Interactive word-part filters" className="filter-panel" data-parts-filter>
      <label htmlFor="part-search">Search word parts</label>
      <input autoComplete="off" data-part-search id="part-search" type="search" />
      <fieldset><legend>Filter by kind</legend><div className="filter-set">{partKinds.map((kind) => <label key={kind}><input data-part-kind name="kind" type="checkbox" value={kind} /> <span>{partKindLabel(kind)}</span></label>)}</div></fieldset>
      <p aria-atomic="true" aria-live="polite" role="status"><strong data-part-count>{parts.length}</strong> of {parts.length} parts</p>
      <noscript><p className="privacy-hint">Interactive filtering requires JavaScript. The complete linked index remains available below.</p></noscript>
    </section>
    <PartGroups parts={parts} />
    <div className="empty-panel" data-parts-empty data-testid="no-results" hidden><h2>No matching parts</h2><p>Change the search or remove a kind filter.</p><button className="button button-secondary" data-parts-reset type="button">Clear filters</button></div>
    <ProgressiveEnhancerScript src={publicUrl("/generated/parts.js")} />
  </div>;
}
