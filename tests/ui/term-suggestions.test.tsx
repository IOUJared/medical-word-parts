import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { enhanceAnalyzer } from "../../src/analyzer/client";
import { AnalyzerShell } from "../../src/components/analyzer-shell";
import { TermSearchForm } from "../../src/components/term-search-form";
import { enhanceSite } from "../../src/site/client";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

describe("verified term suggestions", () => {
  it("Given JavaScript is unavailable, when the lookup form renders, then it remains a native search field without a false combobox role", () => {
    const markup = renderToStaticMarkup(<TermSearchForm />);

    expect(markup).toContain('type="search"');
    expect(markup).toContain('name="term"');
    expect(markup).not.toContain('role="combobox"');
  });

  it("Given the home lookup is enhanced, when a prefix is typed, then verified matches open with an announced result count", async () => {
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate: vi.fn() }));

    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "cardio");

    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Verified term suggestions" })).toBeVisible();
    expect(screen.getByRole("option", { name: "cardiology" })).toBeVisible();
    expect(screen.getByRole("option", { name: "cardiomegaly" })).toBeVisible();
    expect(screen.getByRole("option", { name: "cardiomyocyte" })).toBeVisible();
    expect(screen.getByText("5 verified suggestions available.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given suggestions are open, when ArrowDown and Enter are pressed, then the active suggestion fills the field without navigating", async () => {
    const navigate = vi.fn();
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate }));
    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "cardio");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(search).toHaveValue("cardiology");
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Filled “cardiology”. Press Enter to open it.')).toHaveAttribute("aria-live", "polite");
  });

  it("Given an alias suggestion, when it is clicked, then the alias fills and the next submit uses its canonical route", async () => {
    const navigate = vi.fn();
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate }));
    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "hypoglycae");

    await userEvent.click(screen.getByRole("option", { name: "hypoglycaemia Alias for hypoglycemia" }));
    await userEvent.keyboard("{Enter}");

    expect(search).toHaveValue("hypoglycaemia");
    expect(navigate).toHaveBeenCalledWith("/medical-word-parts/term/hypoglycemia/");
  });

  it("Given no verified match, when input changes, then spelling, browse, and reset recovery remain available", async () => {
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate: vi.fn() }));
    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "xyzzy");

    expect(screen.getByText("No verified matches. Check the spelling, or press Enter to analyze this term.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse verified terms" })).toHaveAttribute("href", "/medical-word-parts/common-medical-terms/");
    expect(screen.getByText("No verified suggestions. Press Enter to analyze this term.")).toHaveAttribute("aria-live", "polite");

    await userEvent.click(screen.getByRole("button", { name: "Reset search" }));

    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Search reset.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given suggestions are open, when ArrowUp then Escape are pressed, then the last option activates before the list closes with an announcement", async () => {
    render(<TermSearchForm />);
    cleanups.push(enhanceSite(window, { navigate: vi.fn() }));
    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "cardio");

    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("option", { name: "phonocardiography" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Escape}");
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Suggestions closed.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given the analyzer is enhanced, when a prefix is typed, then it offers the same verified suggestions", async () => {
    render(<AnalyzerShell />);
    cleanups.push(enhanceAnalyzer(window));

    const search = screen.getByRole("combobox", { name: "Medical term" });
    await userEvent.type(search, "dermatofibro");

    expect(screen.getByRole("option", { name: "dermatofibrosarcoma" })).toBeVisible();
  });
});
