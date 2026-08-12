import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/components/app-shell";
import { TermSearchForm } from "../../src/components/term-search-form";
import { decideTermRoute } from "../../src/lib/term-route";
import { enhanceSite } from "../../src/site/client";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

function installColorSchemePreference(initialDark: boolean) {
  const listeners = new Set<(event: { readonly matches: boolean }) => void>();
  const preference = {
    matches: initialDark,
    addEventListener: (_type: string, listener: (event: { readonly matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: { readonly matches: boolean }) => void) => listeners.delete(listener),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => preference,
  });
  return {
    change(matches: boolean) {
      preference.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
}

describe("application shell", () => {
  it("Given page content, when the shell renders, then landmarks, skip link, navigation, and footer exist", () => {
    render(<AppShell><h1>Fixture</h1></AppShell>);

    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("Given any page, when the shell renders, then primary navigation exposes one compact search link without adding a search landmark", () => {
    render(<AppShell><h1>Fixture</h1></AppShell>);

    const primaryNavigation = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNavigation).getByRole("link", { name: "Search" })).toHaveAttribute("href", "/analyze");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("Given server-rendered shell markup, when enhancement has not run, then one inert hidden Dark mode button exposes a false pressed state", () => {
    render(<AppShell><h1>Fixture</h1></AppShell>);

    const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
    if (toggle === null) throw new TypeError("Expected theme toggle");
    expect(toggle).toHaveTextContent("Dark mode");
    expect(toggle).toHaveClass("button-quiet");
    expect(toggle).not.toHaveClass("button-secondary");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("inert");
    expect(document.querySelectorAll("[data-theme-toggle]")).toHaveLength(1);
  });

  it("Given server-rendered mobile navigation, when enhancement has not run, then the native trigger has no stale expanded state", () => {
    render(<AppShell><h1>Fixture</h1></AppShell>);

    expect(screen.getByRole("button", { name: "Menu" })).not.toHaveAttribute("aria-expanded");
  });
});

describe("mobile navigation progressive enhancement", () => {
  function renderEnhancedMobileNavigation(initiallyOpen: boolean) {
    let open = initiallyOpen;
    installColorSchemePreference(false);
    render(<AppShell><h1>Fixture</h1></AppShell>);
    const trigger = screen.getByRole("button", { name: "Menu" });
    const popover = document.querySelector<HTMLElement>("#mobile-menu");
    if (popover === null) throw new TypeError("Expected mobile menu popover");
    const nativeMatches = popover.matches;
    vi.spyOn(popover, "matches").mockImplementation((selector) => selector === ":popover-open" ? open : nativeMatches.call(popover, selector));
    const cleanup = enhanceSite(window);
    cleanups.push(cleanup);
    return {
      cleanup,
      popover,
      setOpen(nextOpen: boolean) {
        open = nextOpen;
        popover.dispatchEvent(new Event("toggle"));
      },
      trigger,
    };
  }

  it("Given a closed native popover, when site enhancement wires, then the trigger exposes false expanded state", () => {
    const { trigger } = renderEnhancedMobileNavigation(false);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Given an enhanced closed popover, when its native toggle event reports open, then the trigger exposes true expanded state", () => {
    const { setOpen, trigger } = renderEnhancedMobileNavigation(false);

    setOpen(true);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("Given an enhanced open popover, when its native toggle event reports closed, then the trigger exposes false expanded state", () => {
    const { setOpen, trigger } = renderEnhancedMobileNavigation(true);

    setOpen(false);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Given enhanced mobile navigation, when cleanup runs, then its toggle listener and owned expanded state are removed", () => {
    installColorSchemePreference(false);
    render(<AppShell><h1>Fixture</h1></AppShell>);
    const trigger = screen.getByRole("button", { name: "Menu" });
    const popover = document.querySelector<HTMLElement>("#mobile-menu");
    if (popover === null) throw new TypeError("Expected mobile menu popover");
    const nativeMatches = popover.matches;
    vi.spyOn(popover, "matches").mockImplementation((selector) => selector === ":popover-open" ? false : nativeMatches.call(popover, selector));
    const removeEventListener = vi.spyOn(popover, "removeEventListener");
    const cleanup = enhanceSite(window);

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith("toggle", expect.any(Function));
    expect(trigger).not.toHaveAttribute("aria-expanded");
  });
});

describe("theme progressive enhancement", () => {
  it("Given no explicit choice and a dark system, when wiring succeeds, then the control reveals with dark pressed without creating persisted state", () => {
    installColorSchemePreference(true);
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));

    const toggle = screen.getByRole("button", { name: "Dark mode" });
    expect(toggle).not.toHaveAttribute("inert");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("medical-word-parts:theme")).toBeNull();
  });

  it("Given a persisted dark choice under a light system, when wiring succeeds, then explicit dark wins", () => {
    installColorSchemePreference(false);
    localStorage.setItem("medical-word-parts:theme", "dark");
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));

    expect(screen.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("Given invalid persisted state and a light system, when wiring succeeds, then automatic light remains active", () => {
    installColorSchemePreference(false);
    localStorage.setItem("medical-word-parts:theme", "sepia");
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));

    expect(screen.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("Given automatic mode, when the system preference changes, then the pressed state follows without persisting", () => {
    const preference = installColorSchemePreference(false);
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));

    preference.change(true);

    expect(screen.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("medical-word-parts:theme")).toBeNull();
  });

  it("Given an explicit choice, when the system preference changes, then the explicit state remains", async () => {
    const preference = installColorSchemePreference(false);
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));
    const toggle = screen.getByRole("button", { name: "Dark mode" });
    await userEvent.click(toggle);

    preference.change(false);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("medical-word-parts:theme")).toBe("dark");
  });

  it("Given blocked storage, when the native button is activated by keyboard, then the current document still toggles without throwing", async () => {
    installColorSchemePreference(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    render(<AppShell><h1>Fixture</h1></AppShell>);
    cleanups.push(enhanceSite(window));
    const toggle = screen.getByRole("button", { name: "Dark mode" });
    toggle.focus();

    await userEvent.keyboard(" ");

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("term route decision", () => {
  it("Given a known canonical term, when routing is decided, then it selects the canonical term page", () => {
    expect(decideTermRoute(" Hypoglycemia ")).toEqual({ kind: "term", href: "/term/hypoglycemia/" });
  });

  it("Given an unknown term, when routing is decided, then it selects local analysis with encoded input", () => {
    expect(decideTermRoute("hypo nephritis")).toEqual({ kind: "analyze", href: "/analyze/?term=hypo+nephritis" });
  });

  it("Given a source-cited alias, when routing is decided, then it selects the canonical term page", () => {
    expect(decideTermRoute("hypoglycaemia")).toEqual({ kind: "term", href: "/term/hypoglycemia/" });
  });

  it("Given markup-shaped input, when routing is decided, then it remains encoded analysis data", () => {
    expect(decideTermRoute("<img src=x onerror=alert(1)>")).toEqual({ kind: "analyze", href: "/analyze/?term=%3Cimg+src%3Dx+onerror%3Dalert%281%29%3E" });
  });
});

describe("term search progressive enhancement", () => {
  it("Given JavaScript is unavailable, when rendered, then the native GET form submits safely to local analysis", () => {
    const markup = renderToStaticMarkup(<TermSearchForm />);

    expect(markup).toContain('action="/medical-word-parts/analyze/"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain('name="term"');
  });

  it.each([
    ["", "adrenal", "/term/adrenal/"],
    ["", "hypoglycaemia", "/term/hypoglycemia/"],
    ["", "hypo nephritis", "/analyze/?term=hypo+nephritis"],
    ["/medical-word-parts", "adrenal", "/medical-word-parts/term/adrenal/"],
    ["/medical-word-parts", "hypoglycaemia", "/medical-word-parts/term/hypoglycemia/"],
    ["/medical-word-parts", "hypo nephritis", "/medical-word-parts/analyze/?term=hypo+nephritis"],
  ] as const)("Given base path %s and term %s, when Enter submits, then navigation uses the active DOM base path", async (basePath, term, expected) => {
    const navigate = vi.fn();
    render(<TermSearchForm />);
    const form = screen.getByRole("search");
    form.setAttribute("data-base-path", basePath);
    cleanups.push(enhanceSite(window, { navigate }));

    await userEvent.type(screen.getByRole("combobox", { name: /medical term/i }), term);
    fireEvent.submit(form);

    expect(navigate).toHaveBeenCalledWith(expected);
  });

  it("Given an empty search, when submitted, then it announces recovery without navigating", () => {
    const navigate = vi.fn();
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate }));

    fireEvent.submit(screen.getByRole("search"));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a term to continue.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given a populated search, when cleared, then input and message reset while focus returns to the field", async () => {
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate: vi.fn() }));
    const search = screen.getByRole("combobox", { name: /medical term/i });
    await userEvent.type(search, "adrenal");
    const clear = screen.getByRole("button", { name: "Clear" });

    await userEvent.click(clear);

    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(clear).not.toBeVisible();
  });
});
