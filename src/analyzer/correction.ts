import { buildCorrection } from "../lib/correction";
import { focusAndSelectText, writeClipboard } from "../lib/clipboard";
import { createElement } from "./dom";
import { renderStatus } from "./status";

function copyIcon(document: Document): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("button-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("viewBox", "0 0 24 24");
  const rectangle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rectangle.setAttribute("x", "8");
  rectangle.setAttribute("y", "8");
  rectangle.setAttribute("width", "11");
  rectangle.setAttribute("height", "11");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M16 8V5H5v11h3");
  icon.append(rectangle, path);
  return icon;
}

export function renderCorrection(window: Window, subject: string, currentBreakdown: string): HTMLElement {
  const { document } = window;
  const correction = buildCorrection({ subject, currentBreakdown });
  const section = createElement(document, "section", { className: "correction-flow" });
  section.id = "correction";
  const heading = createElement(document, "div", { className: "section-heading" });
  heading.append(
    createElement(document, "p", { className: "overline", text: "Editorial correction" }),
    createElement(document, "h2", { text: "Propose a correction" }),
  );
  const action = createElement(document, "a", { className: "button button-primary", text: "Propose a correction on GitHub " });
  action.href = correction.issueUrl;
  action.target = "_blank";
  action.rel = "noreferrer";
  action.append(createElement(document, "span", { className: "external-note", text: "External link" }));
  const details = createElement(document, "details");
  details.append(createElement(document, "summary", { text: "Copyable fallback template" }));
  const template = createElement(document, "pre", { text: correction.fallbackText });
  template.tabIndex = -1;
  details.append(template);
  const button = createElement(document, "button", { className: "button button-secondary", text: "Copy template " });
  button.type = "button";
  button.append(copyIcon(document));
  const status = createElement(document, "p");
  status.setAttribute("aria-live", "polite");
  button.addEventListener("click", () => {
    void writeClipboard(window, correction.fallbackText).then((copied) => {
      status.textContent = copied ? "Template copied." : "Copy failed. Select the template text manually.";
      if (!copied) focusAndSelectText(window, template);
    });
  });
  details.append(button, status);
  section.append(
    heading,
    renderStatus(document, {
      tone: "privacy",
      label: "Public issue and privacy notice",
      message: "GitHub issues are public. Do not include names, symptoms, record numbers, or other private medical information. Include published evidence for the proposed change.",
    }),
    action,
    details,
  );
  return section;
}
