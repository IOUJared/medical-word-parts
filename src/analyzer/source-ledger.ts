import { findSource } from "../lib/catalog";
import { createElement } from "./dom";

export function renderSourceLedger(document: Document, sourceIds: readonly string[]): HTMLElement {
  const section = createElement(document, "section", { className: "source-section" });
  section.setAttribute("aria-labelledby", "source-ledger-heading");
  const heading = createElement(document, "div", { className: "section-heading" });
  heading.append(
    createElement(document, "p", { className: "overline", text: "Provenance" }),
    createElement(document, "h2", { text: "Source ledger" }),
  );
  const title = heading.querySelector("h2");
  if (title !== null) title.id = "source-ledger-heading";
  const list = createElement(document, "ol", { className: "source-ledger" });
  sourceIds.forEach((sourceId, index) => {
    const source = findSource(sourceId);
    if (source === undefined) return;
    const item = createElement(document, "li");
    item.id = source.id;
    item.tabIndex = -1;
    const link = createElement(document, "a", { text: source.title });
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    const sourceTitle = createElement(document, "h3");
    sourceTitle.append(link);
    item.append(
      createElement(document, "p", { className: "source-number", text: `Source ${index + 1}` }),
      sourceTitle,
      createElement(document, "p", { text: source.publisher }),
      createElement(document, "p", { className: "source-host", text: `External link to ${new URL(source.url).hostname}; opens in a new tab.` }),
    );
    list.append(item);
  });
  section.append(heading, list);
  return section;
}
