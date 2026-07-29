import { partKindLabel, partKinds, partSlug, type PartRecord } from "../lib/catalog";
import { publicUrl } from "../lib/paths";

export function PartGroups({ parts }: { readonly parts: readonly PartRecord[] }) {
  return <div className="part-groups">{partKinds.map((kind) => {
    const entries = parts.filter((part) => part.kind === kind);
    if (entries.length === 0) return null;
    const headingId = `part-group-${kind}`;
    return <section className="part-group" aria-labelledby={headingId} data-kind={kind} key={kind}><header className="part-group-heading"><div><p className="kind-code">Collection group</p><h2 id={headingId}>{partKindLabel(kind)}</h2></div><p><strong>{entries.length}</strong> {entries.length === 1 ? "entry" : "entries"}</p></header><ol className="part-list">{entries.map((part) => <li key={part.id}><h3><a href={publicUrl(`/parts/${partSlug(part)}/`)}>{part.form}</a></h3><p>{part.meaning}</p></li>)}</ol></section>;
  })}</div>;
}
