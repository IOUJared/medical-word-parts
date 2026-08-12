export type TermSuggestion = {
  readonly canonical: string;
  readonly value: string;
};

const maximumSuggestions = 6;

class TermSuggestionMarkupError extends Error {
  override readonly name = "TermSuggestionMarkupError";
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new TermSuggestionMarkupError(`The term suggestion field is missing ${selector}`);
  return element;
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function matchingSuggestions(entries: readonly TermSuggestion[], query: string): readonly TermSuggestion[] {
  const normalizedQuery = normalized(query);
  if (normalizedQuery.length === 0) return [];
  return entries
    .map((entry) => ({ entry, rank: normalized(entry.value).startsWith(normalizedQuery) ? 0 : normalized(entry.value).includes(normalizedQuery) ? 1 : 2 }))
    .filter(({ rank }) => rank < 2)
    .sort((left, right) => left.rank - right.rank || left.entry.value.localeCompare(right.entry.value))
    .slice(0, maximumSuggestions)
    .map(({ entry }) => entry);
}

export function enhanceTermSuggestions(target: Window, input: HTMLInputElement, entries: readonly TermSuggestion[]): () => void {
  const root = input.closest<HTMLElement>("[data-term-suggestion-root]");
  if (root === null) throw new TermSuggestionMarkupError("The term suggestion input is missing its field root");
  const panel = requiredElement<HTMLElement>(root, "[data-term-suggestion-panel]");
  const summary = requiredElement<HTMLElement>(root, "[data-term-suggestion-summary]");
  const list = requiredElement<HTMLUListElement>(root, "[data-term-suggestion-list]");
  const empty = requiredElement<HTMLElement>(root, "[data-term-suggestion-empty]");
  const reset = requiredElement<HTMLButtonElement>(root, "[data-term-suggestion-reset]");
  const status = requiredElement<HTMLElement>(root, "[data-term-suggestion-status]");
  const listboxId = list.id;
  let suggestions: readonly TermSuggestion[] = [];
  let activeIndex = -1;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listboxId);
  input.setAttribute("aria-expanded", "false");
  list.setAttribute("role", "listbox");

  const setActive = (index: number): void => {
    activeIndex = index;
    const options = Array.from(list.querySelectorAll<HTMLElement>("[role='option']"));
    for (const [optionIndex, option] of options.entries()) {
      option.setAttribute("aria-selected", String(optionIndex === activeIndex));
    }
    const active = options[activeIndex];
    if (active === undefined) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView?.({ block: "nearest" });
  };

  const close = (announcement?: string): void => {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
    if (announcement !== undefined) status.textContent = announcement;
  };

  const optionElement = (suggestion: TermSuggestion, index: number): HTMLLIElement => {
    const option = target.document.createElement("li");
    option.className = "term-suggestion-option";
    option.id = `${listboxId}-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.setAttribute("data-term-suggestion-value", suggestion.value);
    const term = target.document.createElement("span");
    term.textContent = suggestion.value;
    option.append(term);
    if (suggestion.canonical !== suggestion.value) {
      const alias = target.document.createElement("small");
      alias.className = "term-suggestion-alias";
      alias.textContent = `Alias for ${suggestion.canonical}`;
      option.append(" ", alias);
    }
    return option;
  };

  const render = (): void => {
    suggestions = matchingSuggestions(entries, input.value);
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    list.replaceChildren(...suggestions.map(optionElement));
    if (input.value.trim().length === 0) {
      status.textContent = "";
      close();
      return;
    }
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    const count = suggestions.length;
    list.hidden = count === 0;
    empty.hidden = count > 0;
    summary.textContent = count === 0 ? "No verified suggestions" : `Verified matches (${count})`;
    status.textContent = count === 0
      ? "No verified suggestions. Press Enter to analyze this term."
      : `${count} verified ${count === 1 ? "suggestion" : "suggestions"} available.`;
    panel.scrollIntoView?.({ block: "nearest" });
  };

  const select = (suggestion: TermSuggestion): void => {
    input.value = suggestion.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    close(`Filled “${suggestion.value}”. Press Enter to open it.`);
    input.focus();
  };

  const handleInput = (): void => render();
  const handleFocus = (): void => {
    if (input.value.trim().length > 0) render();
  };
  const handleBlur = (): void => close();
  const handleReset = (): void => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    close("Search reset.");
    input.focus();
  };
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      close("Suggestions closed.");
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      const selected = suggestions[activeIndex];
      if (selected !== undefined) {
        event.preventDefault();
        select(selected);
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (suggestions.length === 0) render();
    if (suggestions.length === 0) return;
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = activeIndex < 0
      ? event.key === "ArrowDown" ? 0 : suggestions.length - 1
      : (activeIndex + offset + suggestions.length) % suggestions.length;
    setActive(nextIndex);
  };
  const suggestionFromEvent = (event: Event): TermSuggestion | undefined => {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) return undefined;
    const option = eventTarget.closest<HTMLElement>("[data-term-suggestion-value]");
    const value = option?.getAttribute("data-term-suggestion-value");
    return value === null || value === undefined ? undefined : suggestions.find((suggestion) => suggestion.value === value);
  };
  const handleMouseDown = (event: MouseEvent): void => {
    if (suggestionFromEvent(event) !== undefined) event.preventDefault();
  };
  const handleClick = (event: MouseEvent): void => {
    const suggestion = suggestionFromEvent(event);
    if (suggestion !== undefined) select(suggestion);
  };

  input.addEventListener("input", handleInput);
  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("keydown", handleKeydown);
  list.addEventListener("mousedown", handleMouseDown);
  list.addEventListener("click", handleClick);
  reset.addEventListener("click", handleReset);
  return () => {
    input.removeEventListener("input", handleInput);
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("keydown", handleKeydown);
    list.removeEventListener("mousedown", handleMouseDown);
    list.removeEventListener("click", handleClick);
    reset.removeEventListener("click", handleReset);
    panel.hidden = true;
    activeIndex = -1;
    input.removeAttribute("role");
    input.removeAttribute("aria-autocomplete");
    input.removeAttribute("aria-controls");
    input.removeAttribute("aria-expanded");
    input.removeAttribute("aria-activedescendant");
    list.removeAttribute("role");
    list.replaceChildren();
    status.textContent = "";
  };
}
