import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import PartsPage from "../../src/app/parts/page";
import { PartsIndex } from "../../src/components/parts-index";
import { corpus } from "../../src/generated/corpus";
import { enhanceParts } from "../../src/parts/client";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function renderEnhanced(search = ""): void {
  window.history.replaceState(null, "", `/parts/${search}`);
  render(<PartsIndex parts={corpus.parts} />);
  cleanups.push(enhanceParts(window));
}

function visibleEntries(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".part-list > li")].filter((entry) => !entry.hidden);
}

describe("word parts progressive enhancement", () => {
  it("Given the static parts route, when rendered, then it ships the complete semantic index, an honest no-JS explanation, and one local enhancer", () => {
    render(<PartsPage />);
    const markup = renderToStaticMarkup(<PartsPage />);
    const enhancer = document.querySelector("script[src='/medical-word-parts/generated/parts.js']");

    expect(markup.match(/<li>/g)).toHaveLength(corpus.parts.length);
    expect(markup).toContain('href="/medical-word-parts/parts/combining-glyc-o/"');
    expect(enhancer).toHaveAttribute("data-nscript", "afterInteractive");
    expect(enhancer).toHaveAttribute("type", "module");
    expect(markup).not.toContain("aria-busy");
    expect(markup).not.toContain("Apply filters");
    expect(markup).not.toContain("<form");
    expect(markup).toContain("Interactive filtering requires JavaScript");
  });

  it.each(["prefix", "root", "suffix", "combiningForm"] as const)("Given kind=%s in the URL, when enhanced, then that kind is selected and counted", (kind) => {
    renderEnhanced(`?kind=${kind}`);

    const expected = corpus.parts.filter((part) => part.kind === kind).length;
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${kind === "combiningForm" ? "combining form" : kind}`, "i") })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(`${expected} of ${corpus.parts.length} parts`);
    expect(visibleEntries()).toHaveLength(expected);
  });

  it("Given multiple valid kinds, when enhanced, then their union remains selected and visible", () => {
    renderEnhanced("?kind=prefix&kind=root");

    const expected = corpus.parts.filter((part) => part.kind === "prefix" || part.kind === "root").length;
    expect(screen.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Root" })).toBeChecked();
    expect(visibleEntries()).toHaveLength(expected);
  });

  it("Given valid, invalid, and markup-shaped kinds, when enhanced, then only the valid kind is applied without creating markup", () => {
    renderEnhanced("?kind=prefix&kind=unknown&kind=%3Cimg%20src=x%20onerror=alert(1)%3E");

    expect(screen.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
    expect(visibleEntries().every((entry) => entry.closest<HTMLElement>(".part-group")?.dataset["kind"] === "prefix")).toBe(true);
    expect(document.querySelector("img")).toBeNull();
  });

  it("Given a comma-joined malformed kind, when enhanced, then the full collection remains available", () => {
    renderEnhanced("?kind=prefix%2Croot");

    expect(visibleEntries()).toHaveLength(corpus.parts.length);
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
  });

  it.each([["glyc/o", "glyc/o"], ["sugar", "glyc/o"]] as const)("Given all parts, when %s is searched, then notation and meaning are searchable", async (query, expectedLink) => {
    renderEnhanced();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search word parts" }), query);

    expect(visibleEntries()).toHaveLength(1);
    expect(screen.getByRole("link", { name: expectedLink })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(`1 of ${corpus.parts.length} parts`);
  });

  it("Given all parts, when kind checkboxes change, then visible groups, count, and URL query update", async () => {
    renderEnhanced("?source=index");
    await userEvent.click(screen.getByRole("checkbox", { name: "Prefix" }));

    expect(visibleEntries().every((entry) => entry.closest<HTMLElement>(".part-group")?.dataset["kind"] === "prefix")).toBe(true);
    expect(screen.getByRole("heading", { name: "Prefix" }).closest("section")).not.toHaveAttribute("hidden");
    expect(document.querySelector("#part-group-root")?.closest("section")).toHaveAttribute("hidden");
    expect(window.location.search).toBe("?source=index&kind=prefix");
  });

  it("Given unmatched filters, when reset is activated, then the collection and keyboard focus recover", async () => {
    renderEnhanced("?kind=suffix");
    const search = screen.getByRole("searchbox", { name: "Search word parts" });
    await userEvent.type(search, "quartz");
    expect(screen.getByTestId("no-results")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(visibleEntries()).toHaveLength(corpus.parts.length);
    expect(screen.getByTestId("no-results")).not.toBeVisible();
    expect(window.location.search).toBe("");
    expect(search).toHaveFocus();
  });

  it("Given browser navigation changes kinds, when popstate fires, then controls and results follow history", () => {
    renderEnhanced("?kind=prefix");
    window.history.pushState(null, "", "/parts/?kind=suffix");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(screen.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Prefix" })).not.toBeChecked();
    expect(visibleEntries().every((entry) => entry.closest<HTMLElement>(".part-group")?.dataset["kind"] === "suffix")).toBe(true);
  });

  it("Given keyboard navigation, when controls receive focus and results change, then native focus and polite announcements remain available", async () => {
    renderEnhanced();
    await userEvent.tab();

    expect(screen.getByRole("searchbox", { name: "Search word parts" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  });
});
