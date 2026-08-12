import { publicUrl } from "../lib/paths";
import { ProgressiveEnhancerScript } from "./progressive-enhancer-script";
import { StatusPanel } from "./status-panel";
import { TermSuggestionField } from "./term-suggestion-field";

export function AnalyzerShell() {
  return <div className="analyzer" data-analyzer-root data-base-path={publicUrl("/").slice(0, -1)}>
    <form action={publicUrl("/analyze/")} className="search-form" id="analyzer-form" method="get" role="search">
      <label htmlFor="analyzer-term">Medical term</label>
      <p className="field-helper">Enter one word. Analysis runs only in this browser.</p>
      <div className="search-row">
        <TermSuggestionField inputId="analyzer-term" />
        <button className="button button-primary" type="submit">Analyze</button>
      </div>
      <p className="privacy-hint">Query text appears in the URL and may remain in browser history. Do not enter private medical information.</p>
      <noscript><p className="privacy-hint">Local analysis requires JavaScript. This form still preserves the term in the page URL.</p></noscript>
    </form>
    <div aria-label="Analysis result" aria-live="polite" className="analyzer-reserve" id="analyzer-result" tabIndex={-1}>
      <StatusPanel label="Ready to analyze" tone="neutral"><p>Try a known entry or a constructed term.</p></StatusPanel>
    </div>
    <ProgressiveEnhancerScript src={publicUrl("/generated/analyzer.js")} />
  </div>;
}
