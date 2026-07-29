import { partKindCode, partKindLabel, partSlug } from "../lib/catalog";
import { browserPublicUrl } from "../lib/browser-paths";
import { orderedRailItems, type RailAnalysis } from "../lib/morphology";
import { createElement } from "./dom";

export type MorphologyContent = {
  readonly analysis: RailAnalysis;
  readonly reconstructedTerm: string;
  readonly headingId: string;
};

export function renderMorphology(document: Document, content: MorphologyContent): HTMLElement {
  const items = orderedRailItems(content.analysis);
  const section = createElement(document, "section", { className: "morphology" });
  section.setAttribute("aria-labelledby", content.headingId);
  const heading = createElement(document, "div", { className: "section-heading" });
  heading.append(
    createElement(document, "p", { className: "overline", text: "Reading order" }),
    createElement(document, "h2", { text: "Morphology rail" }),
  );
  const headingElement = heading.querySelector("h2");
  if (headingElement !== null) headingElement.id = content.headingId;
  const summary = createElement(document, "p", { className: "rail-summary" });
  summary.append(createElement(document, "strong", { text: "Construction:" }));
  const summaryText = items.map((item) => item.kind === "segment"
    ? `${partKindLabel(item.segment.kind)} ${item.segment.notation}, ${item.segment.meaning}`
    : `unresolved ${item.span.surface}`).join("; ");
  summary.append(` ${summaryText}; reconstructs `, createElement(document, "strong", { text: content.reconstructedTerm }), ".");
  const list = createElement(document, "ol", { className: "morphology-rail" });
  items.forEach((item, index) => {
    if (item.kind === "unresolved") {
      const unresolved = createElement(document, "li", { className: "segment segment-unresolved" });
      unresolved.dataset["surface"] = item.span.surface;
      unresolved.dataset["unresolved"] = "true";
      unresolved.append(
        createElement(document, "span", { className: "ordinal", text: String(index + 1).padStart(2, "0") }),
        createElement(document, "span", { className: "kind-code", text: "? / Unresolved" }),
        createElement(document, "strong", { text: item.span.surface }),
        createElement(document, "p", { text: "These literal characters are not explained by a known part." }),
      );
      list.append(unresolved);
      return;
    }
    const segment = createElement(document, "li", { className: `segment segment-${item.segment.kind}` });
    segment.dataset["surface"] = item.segment.surface;
    const link = createElement(document, "a", { text: item.segment.notation });
    link.href = browserPublicUrl(document, `/parts/${partSlug({ id: item.segment.partId })}/`);
    const title = createElement(document, "h3");
    title.append(link);
    const surface = createElement(document, "p", { className: "segment-surface", text: "Surface: " });
    surface.append(createElement(document, "strong", { text: item.segment.surface }));
    segment.append(
      createElement(document, "span", { className: "ordinal", text: String(index + 1).padStart(2, "0") }),
      createElement(document, "span", { className: "kind-code", text: `${partKindCode(item.segment.kind)} / ${partKindLabel(item.segment.kind)}` }),
      title,
      surface,
      createElement(document, "p", { text: item.segment.meaning }),
    );
    if (item.segment.transformations.length > 0) {
      const transformation = createElement(document, "p", { className: "segment-transform", text: "Combining vowel " });
      transformation.append(createElement(document, "strong", { text: "o" }), " is dropped before the next part.");
      segment.append(transformation);
    }
    list.append(segment);
  });
  const reconstruction = createElement(document, "p", { className: "reconstruction" });
  reconstruction.setAttribute("aria-label", `Reconstructed term: ${content.reconstructedTerm}`);
  const arrow = createElement(document, "span", { text: "→" });
  arrow.setAttribute("aria-hidden", "true");
  reconstruction.append(arrow, ` ${content.reconstructedTerm}`);
  section.append(heading, summary, list, reconstruction);
  return section;
}
