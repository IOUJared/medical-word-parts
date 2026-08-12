import { focusAndSelectText, writeClipboard } from "../lib/clipboard";
import { browserPublicUrl } from "../lib/browser-paths";
import { decideTermRoute } from "../lib/term-route";
import { enhanceTermSuggestions } from "../lib/term-suggestions";
import { termRouteIndex } from "../generated/index";
import { enhanceTheme } from "../theme/client";

type SiteEnhancementOptions = {
  readonly navigate?: (href: string) => void;
};

class SiteDomError extends Error {
  override readonly name = "SiteDomError";
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new SiteDomError(`The site enhancement root is missing ${selector}`);
  return element;
}

export function enhanceSite(target: Window, options: SiteEnhancementOptions = {}): () => void {
  const cleanups: Array<() => void> = [];
  const navigate = options.navigate ?? ((href: string) => target.location.assign(href));
  cleanups.push(enhanceTheme(target));

  for (const trigger of target.document.querySelectorAll<HTMLButtonElement>("[data-mobile-menu-trigger]")) {
    const targetId = trigger.getAttribute("popovertarget");
    if (targetId === null) throw new SiteDomError("A mobile menu trigger is missing popovertarget");
    const popover = target.document.getElementById(targetId);
    if (popover === null || !popover.matches("[data-mobile-menu][popover]")) throw new SiteDomError(`The mobile menu trigger target is missing #${targetId}`);
    const synchronizeExpanded = () => trigger.setAttribute("aria-expanded", String(popover.matches(":popover-open")));
    synchronizeExpanded();
    popover.addEventListener("toggle", synchronizeExpanded);
    cleanups.push(() => {
      popover.removeEventListener("toggle", synchronizeExpanded);
      trigger.removeAttribute("aria-expanded");
    });
  }

  for (const form of target.document.querySelectorAll<HTMLFormElement>("[data-term-search]")) {
    const input = requiredElement<HTMLInputElement>(form, "[data-term-input]");
    const clear = requiredElement<HTMLButtonElement>(form, "[data-term-clear]");
    const message = requiredElement<HTMLElement>(form, "[data-term-message]");
    const suggestions = Object.entries(termRouteIndex).map(([value, canonical]) => ({ canonical, value }));
    cleanups.push(enhanceTermSuggestions(target, input, suggestions));
    const handleInput = () => {
      clear.hidden = input.value.length === 0;
      if (input.value.trim().length > 0) message.textContent = "";
    };
    const handleClear = () => {
      input.value = "";
      clear.hidden = true;
      message.textContent = "";
      input.focus();
    };
    const handleSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      if (input.value.trim().length === 0) {
        message.textContent = "Enter a term to continue.";
        input.focus();
        return;
      }
      navigate(browserPublicUrl(form, decideTermRoute(input.value).href));
    };
    input.addEventListener("input", handleInput);
    clear.addEventListener("click", handleClear);
    form.addEventListener("submit", handleSubmit);
    cleanups.push(() => {
      input.removeEventListener("input", handleInput);
      clear.removeEventListener("click", handleClear);
      form.removeEventListener("submit", handleSubmit);
    });
  }

  for (const root of target.document.querySelectorAll<HTMLElement>("[data-correction-root]")) {
    const template = requiredElement<HTMLElement>(root, "[data-correction-template]");
    const button = requiredElement<HTMLButtonElement>(root, "[data-correction-copy]");
    const status = requiredElement<HTMLElement>(root, "[data-correction-status]");
    const handleCopy = () => {
      void writeClipboard(target, template.textContent ?? "").then((copied) => {
        status.textContent = copied ? "Template copied." : "Copy failed. Select the template text manually.";
        if (!copied) focusAndSelectText(target, template);
      });
    };
    button.addEventListener("click", handleCopy);
    cleanups.push(() => button.removeEventListener("click", handleCopy));
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
