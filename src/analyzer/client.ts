import { analyzeTerm } from "../core/analyzer";
import { renderAnalyzerResult } from "./result";

export class AnalyzerMarkupError extends Error {
  override readonly name = "AnalyzerMarkupError";
}

type AnalyzerElements = {
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly result: HTMLElement;
};

export function termFromSearch(search: string): string {
  return new URLSearchParams(search).get("term") ?? "";
}

function elements(document: Document): AnalyzerElements {
  const form = document.getElementById("analyzer-form");
  const input = document.getElementById("analyzer-term");
  const result = document.getElementById("analyzer-result");
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || result === null) {
    throw new AnalyzerMarkupError("Analyzer server markup is incomplete");
  }
  return { form, input, result };
}

export function enhanceAnalyzer(window: Window): () => void {
  const analyzer = elements(window.document);
  const initialNodes = Array.from(analyzer.result.childNodes, (node) => node.cloneNode(true));
  const render = (term: string, moveFocus: boolean): void => {
    analyzer.result.replaceChildren(renderAnalyzerResult(window, analyzeTerm(term)));
    if (moveFocus) analyzer.result.focus();
  };
  const renderLocation = (): void => {
    const term = termFromSearch(window.location.search);
    analyzer.input.value = term;
    if (term.length > 0) {
      render(term, false);
    } else {
      analyzer.result.replaceChildren(...initialNodes.map((node) => node.cloneNode(true)));
    }
  };
  renderLocation();
  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const parameters = new URLSearchParams({ term: analyzer.input.value });
    window.history.pushState(null, "", `?${parameters.toString()}`);
    render(analyzer.input.value, true);
  };
  analyzer.form.addEventListener("submit", handleSubmit);
  window.addEventListener("popstate", renderLocation);
  return () => {
    analyzer.form.removeEventListener("submit", handleSubmit);
    window.removeEventListener("popstate", renderLocation);
  };
}
