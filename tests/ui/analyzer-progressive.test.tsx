import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { enhanceAnalyzer, termFromSearch } from "../../src/analyzer/client";
import { AnalyzerShell } from "../../src/components/analyzer-shell";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setupAnalyzer(search = ""): HTMLInputElement {
  window.history.replaceState(null, "", `/analyze/${search}`);
  render(<AnalyzerShell />);
  cleanups.push(enhanceAnalyzer(window));
  return screen.getByRole("combobox", { name: "Medical term" });
}

describe("analyzer progressive enhancement", () => {
  it("Given an encoded query, when parsed and enhanced, then the field and result use the decoded term", () => {
    expect(termFromSearch("?term=hypoglycaemia%20")).toBe("hypoglycaemia ");

    const input = setupAnalyzer("?term=hypoglycaemia");

    expect(input.value).toBe("hypoglycaemia");
    expect(screen.getByTestId("analysis-result")).toHaveAttribute("data-result-status", "alias");
  });

  it.each([
    ["hypoglycemia", "verified"],
    ["hypoglycaemia", "alias"],
    ["hyponephritis", "derived"],
    ["hypoxnephritis", "partial"],
    ["xyz", "unsupported"],
  ] as const)("Given %s, when submitted, then result status is %s", (term, status) => {
    const input = setupAnalyzer();
    fireEvent.change(input, { target: { value: term } });
    fireEvent.submit(screen.getByRole("search"));

    expect(screen.getByTestId("analysis-result")).toHaveAttribute("data-result-status", status);
  });

  it("Given XSS-shaped text, when submitted, then it remains text-only unsupported input", () => {
    const input = setupAnalyzer();
    const scriptCount = document.scripts.length;
    fireEvent.change(input, { target: { value: "<script>window.injected=true</script>" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(document.scripts).toHaveLength(scriptCount);
    expect(screen.getByTestId("analysis-result")).toHaveAttribute("data-result-status", "unsupported");
    expect(document.body.textContent).not.toContain("window.injected=true");
  });

  it("Given a submission, when analysis completes, then history updates and focus moves to the polite result region", () => {
    const input = setupAnalyzer();
    fireEvent.change(input, { target: { value: "hypo nephritis" } });
    fireEvent.submit(screen.getByRole("search"));

    const region = screen.getByLabelText("Analysis result");
    expect(window.location.search).toBe("?term=hypo+nephritis");
    expect(region).toHaveFocus();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(within(region).getByRole("alert")).toBeInTheDocument();
  });

  it("Given analyzer history changes, when popstate fires, then the query and result restore without stealing focus", () => {
    const input = setupAnalyzer("?term=hypoglycemia");
    const historyPush = vi.spyOn(window.history, "pushState");
    fireEvent.change(input, { target: { value: "hypoxnephritis" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(historyPush).toHaveBeenCalledWith(null, "", "?term=hypoxnephritis");
    input.focus();
    window.history.replaceState(null, "", "?term=adrenal");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(input.value).toBe("adrenal");
    expect(screen.getByTestId("analysis-result")).toHaveAttribute("data-result-status", "verified");
    expect(input).toHaveFocus();
  });

  it("Given a partial result, when rendered, then morphology preserves resolved and unresolved source order", () => {
    setupAnalyzer("?term=hypoxnephritis");

    const primary = screen.getByTestId("analysis-result").querySelector(".morphology");
    if (!(primary instanceof HTMLElement)) throw new TypeError("Expected primary morphology fixture");
    const items = within(primary).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-surface"))).toEqual(["hypo", "x", "nephr", "itis"]);
    expect(within(primary).getByText("x").closest("li")).toHaveAttribute("data-unresolved", "true");
  });

  it("Given an exact entry, when rendered, then alternatives and citations remain semantic", () => {
    setupAnalyzer("?term=adrenal");
    const ledger = screen.getByRole("heading", { name: "Source ledger" }).closest("section");

    if (ledger === null) throw new TypeError("Expected source ledger fixture");
    expect(screen.getByRole("group", { name: "Alternative analyses" })).toBeInTheDocument();
    expect([...ledger.querySelectorAll<HTMLElement>("li")].map((item) => item.id)).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
  });

  it("Given canonical hypoglycemia, when rendered, then term and segment citations are visible in authored order", () => {
    setupAnalyzer("?term=hypoglycemia");
    const ledger = screen.getByRole("heading", { name: "Source ledger" }).closest("section");

    if (ledger === null) throw new TypeError("Expected source ledger fixture");
    expect([...ledger.querySelectorAll<HTMLElement>("li")].map((item) => item.id)).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
  });

  it("Given an alias entry, when rendered, then alias provenance and merged citations remain visible", () => {
    setupAnalyzer("?term=hypoglycaemia");
    const ledger = screen.getByRole("heading", { name: "Source ledger" }).closest("section");

    if (ledger === null) throw new TypeError("Expected source ledger fixture");
    expect(screen.getByText("Verified alias")).toBeInTheDocument();
    const sourceIds = [...ledger.querySelectorAll<HTMLElement>("li")].map((item) => item.id);
    expect(sourceIds).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(within(ledger).getByRole("link", { name: "Medical Terminology, 2nd ed., Chapter 1 - Identifying Word Parts" })).toBeInTheDocument();
  });

  it("Given an analyzer result, when correction renders, then its URL and fallback retain the analyzed subject", () => {
    setupAnalyzer("?term=hyponephritis");
    const link = screen.getByRole("link", { name: /Propose a correction on GitHub/ });
    const issueUrl = new URL(link.getAttribute("href") ?? "");

    expect(issueUrl.searchParams.get("template")).toBe("term-correction.yml");
    expect(issueUrl.searchParams.get("title")).toBe("Correction: hyponephritis");
    expect(issueUrl.searchParams.get("labels")).toBe("correction");
    expect(issueUrl.searchParams.get("medical_term")).toBe("hyponephritis");
    expect(issueUrl.searchParams.get("current_analysis")).toBe("hypo- + nephr- + -itis");
  });

  it("Given clipboard access, when correction fallback is copied, then status is announced", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    setupAnalyzer("?term=hyponephritis");
    await userEvent.click(screen.getByText("Copyable fallback template"));
    await userEvent.click(screen.getByRole("button", { name: "Copy template" }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(await screen.findByText("Template copied.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given clipboard access is unavailable, when correction fallback is copied, then manual recovery is announced", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    setupAnalyzer("?term=hyponephritis");
    await userEvent.click(screen.getByText("Copyable fallback template"));
    await userEvent.click(screen.getByRole("button", { name: "Copy template" }));

    const fallback = screen.getByText(/Term: hyponephritis/);
    expect(screen.getByText("Copy failed. Select the template text manually.")).toHaveAttribute("aria-live", "polite");
    expect(fallback).toHaveFocus();
    expect(window.getSelection()?.toString()).toContain("Term: hyponephritis");
  });

  it("Given repeated analyzer mounts, when an enhancer is disposed, then its submit and popstate listeners are removed", () => {
    window.history.replaceState(null, "", "/analyze/");
    render(<AnalyzerShell />);
    const form = screen.getByRole("search");
    const removeFormListener = vi.spyOn(form, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const cleanup = enhanceAnalyzer(window);

    expect(cleanup).toBeTypeOf("function");
    cleanup();

    expect(removeFormListener).toHaveBeenCalledWith("submit", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("popstate", expect.any(Function));
  });
});
