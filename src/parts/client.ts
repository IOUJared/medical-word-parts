const partKinds = ["prefix", "root", "suffix", "combiningForm"] as const;
type PartKind = (typeof partKinds)[number];

type PartEntry = {
  readonly element: HTMLElement;
  readonly kind: PartKind;
  readonly searchText: string;
};

type PartGroup = {
  readonly element: HTMLElement;
  readonly count: HTMLElement;
  readonly kind: PartKind;
};

class PartsDomError extends Error {
  override readonly name = "PartsDomError";
}

function partKind(value: string | undefined): PartKind {
  switch (value) {
    case "prefix":
    case "root":
    case "suffix":
    case "combiningForm":
      return value;
    default:
      throw new PartsDomError("The parts index contains an unknown kind");
  }
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new PartsDomError(`The parts index is missing ${selector}`);
  return element;
}

function selectedKinds(parameters: URLSearchParams): ReadonlySet<PartKind> {
  const selected = new Set<PartKind>();
  for (const kind of partKinds) {
    if (parameters.getAll("kind").includes(kind)) selected.add(kind);
  }
  return selected;
}

export function enhanceParts(target: Window): () => void {
  const root = target.document.querySelector<HTMLElement>("[data-parts-root]");
  if (root === null) return () => undefined;
  const form = requiredElement<HTMLElement>(root, "[data-parts-filter]");
  const search = requiredElement<HTMLInputElement>(form, "[data-part-search]");
  const checkboxes = [...form.querySelectorAll<HTMLInputElement>("[data-part-kind]")];
  const count = requiredElement<HTMLElement>(form, "[data-part-count]");
  const empty = requiredElement<HTMLElement>(root, "[data-parts-empty]");
  const reset = requiredElement<HTMLButtonElement>(empty, "[data-parts-reset]");
  const groups: readonly PartGroup[] = [...root.querySelectorAll<HTMLElement>(".part-group[data-kind]")].map((element) => ({
    element,
    count: requiredElement<HTMLElement>(element, ".part-group-heading > p > strong"),
    kind: partKind(element.dataset["kind"]),
  }));
  const entries: readonly PartEntry[] = groups.flatMap((group) => [...group.element.querySelectorAll<HTMLElement>(".part-list > li")].map((element) => ({
    element,
    kind: group.kind,
    searchText: element.textContent?.normalize("NFKC").toLowerCase() ?? "",
  })));

  function renderResults(): void {
    const query = search.value.normalize("NFKC").trim().toLowerCase();
    const selected = new Set<PartKind>();
    for (const checkbox of checkboxes) {
      if (checkbox.checked) selected.add(partKind(checkbox.value));
    }
    let visibleCount = 0;
    for (const entry of entries) {
      const visible = (selected.size === 0 || selected.has(entry.kind)) && (query.length === 0 || entry.searchText.includes(query));
      entry.element.hidden = !visible;
      if (visible) visibleCount += 1;
    }
    for (const group of groups) {
      const groupCount = entries.filter((entry) => entry.kind === group.kind && !entry.element.hidden).length;
      group.element.hidden = groupCount === 0;
      group.count.textContent = String(groupCount);
      group.count.parentElement?.replaceChildren(group.count, ` ${groupCount === 1 ? "entry" : "entries"}`);
    }
    count.textContent = String(visibleCount);
    empty.hidden = visibleCount !== 0;
  }

  function updateQuery(): void {
    const url = new URL(target.location.href);
    url.searchParams.delete("kind");
    for (const checkbox of checkboxes) {
      if (checkbox.checked) url.searchParams.append("kind", checkbox.value);
    }
    target.history.replaceState(target.history.state, "", url);
  }

  function syncFromLocation(): void {
    const selected = selectedKinds(new URL(target.location.href).searchParams);
    for (const checkbox of checkboxes) checkbox.checked = selected.has(partKind(checkbox.value));
    renderResults();
  }

  const handleSearch = () => renderResults();
  const handleChange = () => { updateQuery(); renderResults(); };
  const handleReset = () => {
    search.value = "";
    for (const checkbox of checkboxes) checkbox.checked = false;
    updateQuery();
    renderResults();
    search.focus();
  };
  search.addEventListener("input", handleSearch);
  form.addEventListener("change", handleChange);
  reset.addEventListener("click", handleReset);
  target.addEventListener("popstate", syncFromLocation);
  syncFromLocation();

  return () => {
    search.removeEventListener("input", handleSearch);
    form.removeEventListener("change", handleChange);
    reset.removeEventListener("click", handleReset);
    target.removeEventListener("popstate", syncFromLocation);
  };
}
