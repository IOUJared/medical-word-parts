import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AnalyzePage from "../../src/app/analyze/page";

describe("analyzer progressive enhancement architecture", () => {
  it("Given the static analyzer route, when rendered, then it delegates the local module to the production Next lifecycle", () => {
    render(<AnalyzePage />);
    const enhancer = document.querySelector("script[src='/medical-word-parts/generated/analyzer.js']");

    expect(enhancer).toHaveAttribute("data-nscript", "afterInteractive");
    expect(enhancer).toHaveAttribute("type", "module");
  });

  it("Given JavaScript is unavailable, when the server shell renders, then the form and explanation remain usable", () => {
    render(<AnalyzePage />);
    const staticMarkup = renderToStaticMarkup(<AnalyzePage />);

    expect(screen.getByRole("search")).toHaveAttribute("action", "/medical-word-parts/analyze/");
    expect(staticMarkup).toContain("<noscript>");
    expect(staticMarkup).toContain("requires JavaScript");
  });

  it("Given the server shell, when rendered, then the result region reserves an announced focus target", () => {
    render(<AnalyzePage />);

    expect(screen.getByLabelText("Analysis result")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Analysis result")).toHaveClass("analyzer-reserve");
  });
});
