import { AnalyzerShell } from "../../components/analyzer-shell";
import { PageHeading } from "../../components/page-heading";
import { createPageMetadata } from "../../lib/metadata";

export const metadata = createPageMetadata("Analyze a term", "Analyze one medical term locally against the sourced word-part corpus.", "/analyze/");

export default function AnalyzePage() {
  return <div className="page-sheet"><PageHeading overline="Local analyzer" title="Analyze a medical term"><p>One word at a time. Verified records are labeled separately from constructions, partial matches, and unsupported input.</p></PageHeading><AnalyzerShell /></div>;
}
