import Link from "next/link";

import { PageHeading } from "../components/page-heading";
import { TermSearchForm } from "../components/term-search-form";

export default function NotFoundPage() {
  return <div className="page-sheet"><PageHeading overline="404 / Path unavailable" title="This page is not in the field guide"><p>The address does not match an exported reference page. That does not mean a medical term itself is invalid.</p></PageHeading><section className="lookup-block" aria-labelledby="recover-heading"><h2 id="recover-heading">Find another route</h2><TermSearchForm /><p><Link href="/">Return home</Link> · <Link href="/parts/">Browse word parts</Link> · <Link href="/methodology/">Read methodology</Link></p></section></div>;
}
