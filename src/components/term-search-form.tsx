import { publicUrl } from "../lib/paths";

export function TermSearchForm({ compact = false }: { readonly compact?: boolean }) {
  const inputId = compact ? "compact-term" : "home-term";
  return <form action={publicUrl("/analyze/")} className={`search-form${compact ? " search-compact" : ""}`} data-base-path={publicUrl("/").slice(0, -1)} data-term-search method="get" role="search">
    <label htmlFor={inputId}>Medical term</label>
    <p className="field-helper">Known entries open their verified page. Other input is analyzed locally.</p>
    <div className="search-row">
      <input autoComplete="off" data-term-input id={inputId} name="term" type="search" />
      <button className="button button-quiet" data-term-clear hidden type="button">Clear</button>
      <button className="button button-primary" type="submit">Find term</button>
    </div>
    <p aria-live="polite" className="field-message" data-term-message />
    <p className="privacy-hint">Do not enter names, symptoms, or private medical details. Query text may remain in browser history.</p>
  </form>;
}
