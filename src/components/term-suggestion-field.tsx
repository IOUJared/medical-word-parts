import { publicUrl } from "../lib/paths";

type TermSuggestionFieldProps = {
  readonly inputId: string;
};

export function TermSuggestionField({ inputId }: TermSuggestionFieldProps) {
  const listboxId = `${inputId}-suggestions`;
  return <div className="term-suggestion-field" data-term-suggestion-root>
    <input autoComplete="off" data-term-input data-term-suggestion-input id={inputId} name="term" type="search" />
    <div className="term-suggestion-panel" data-term-suggestion-panel hidden>
      <p className="term-suggestion-summary" data-term-suggestion-summary />
      <ul aria-label="Verified term suggestions" data-term-suggestion-list id={listboxId} />
      <div className="term-suggestion-empty" data-term-suggestion-empty hidden>
        <p>No verified matches. Check the spelling, or press Enter to analyze this term.</p>
        <div className="term-suggestion-actions">
          <a href={publicUrl("/common-medical-terms/")}>Browse verified terms</a>
          <button className="button button-quiet" data-term-suggestion-reset type="button">Reset search</button>
        </div>
      </div>
    </div>
    <p aria-live="polite" className="sr-only" data-term-suggestion-status />
  </div>;
}
