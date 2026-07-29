import { assertNever } from "../core/invariants";
import { createElement } from "./dom";

export type StatusTone = "verified" | "derived" | "partial" | "unsupported" | "neutral" | "privacy";

export type StatusContent = {
  readonly tone: StatusTone;
  readonly label: string;
  readonly message: string;
  readonly live?: boolean;
};

function path(document: Document, data: string): SVGPathElement {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
  element.setAttribute("d", data);
  return element;
}

function marker(document: Document, tone: StatusTone): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("status-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("viewBox", "0 0 24 24");
  switch (tone) {
    case "verified":
      icon.append(path(document, "m5 12 4 4L19 6"));
      break;
    case "derived":
    case "neutral":
    case "privacy": {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", "9");
      icon.append(circle, path(document, "M12 11v6M12 7.5v.5"));
      break;
    }
    case "partial":
      icon.append(path(document, "M12 3 2.8 20h18.4Z"), path(document, "M12 9v5M12 17v.5"));
      break;
    case "unsupported":
      icon.append(path(document, "M8 3h8l5 5v8l-5 5H8l-5-5V8Z"), path(document, "M12 7v6M12 17v.5"));
      break;
    default:
      return assertNever(tone);
  }
  return icon;
}

export function renderStatus(document: Document, content: StatusContent): HTMLElement {
  const section = createElement(document, "section", { className: `status-panel status-${content.tone}` });
  if (content.live === true) section.setAttribute("role", content.tone === "unsupported" ? "alert" : "status");
  const body = createElement(document, "div");
  const label = createElement(document, "p", { className: "status-label", text: content.label });
  const message = createElement(document, "div");
  message.append(createElement(document, "p", { text: content.message }));
  body.append(label, message);
  section.append(marker(document, content.tone), body);
  return section;
}
