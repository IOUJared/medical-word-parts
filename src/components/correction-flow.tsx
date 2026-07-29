import { buildCorrection } from "../lib/correction";
import { CopyIcon } from "./icons";
import { StatusPanel } from "./status-panel";

export function CorrectionFlow({ subject, currentBreakdown }: { readonly subject: string; readonly currentBreakdown: string }) {
  const correction = buildCorrection({ subject, currentBreakdown });
  return <section aria-label="Propose a correction" className="correction-flow" data-correction-root id="correction">
    <div className="section-heading"><p className="overline">Editorial correction</p><h2>Propose a correction</h2></div>
    <StatusPanel tone="privacy" label="Public issue and privacy notice"><p>GitHub issues are public. Do not include names, symptoms, record numbers, or other private medical information. Include published evidence for the proposed change.</p></StatusPanel>
    <a className="button button-primary" href={correction.issueUrl} target="_blank" rel="noreferrer">Propose a correction on GitHub <span className="external-note">External link</span></a>
    <details><summary>Copyable fallback template</summary><pre data-correction-template tabIndex={-1}>{correction.fallbackText}</pre><button className="button button-secondary" data-correction-copy type="button">Copy template <CopyIcon className="button-icon" /></button><p aria-live="polite" data-correction-status /></details>
  </section>;
}
