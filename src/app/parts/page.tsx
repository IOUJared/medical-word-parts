import { PageHeading } from "../../components/page-heading";
import { PartsIndex } from "../../components/parts-index";
import { corpus } from "../../generated/corpus";
import { createPageMetadata } from "../../lib/metadata";

export const metadata = createPageMetadata("Word parts", "Browse the sourced prefix, root, suffix, and combining-form index.", "/parts/");

export default function PartsPage() {
  return <div className="page-sheet"><PageHeading overline="Reference index" title="Word parts"><p>Search notation and meaning, or narrow the collection by structural kind. Every record links to its authored source ledger.</p></PageHeading><PartsIndex parts={corpus.parts} /></div>;
}
