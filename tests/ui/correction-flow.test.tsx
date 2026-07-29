import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CorrectionFlow } from "../../src/components/correction-flow";
import { enhanceSite } from "../../src/site/client";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("correction fallback", () => {
  it("Given JavaScript is unavailable, when rendered, then the public action and selectable fallback remain complete", () => {
    const markup = renderToStaticMarkup(<CorrectionFlow subject="cytokine" currentBreakdown="cyt/o + -kine" />);

    expect(markup).toContain("https://github.com/IOUJared/medical-word-parts/issues/new?");
    expect(markup).toContain("Term: cytokine");
    expect(markup).toContain("Current analysis: cyt/o + -kine");
    expect(markup).toContain("Proposed breakdown:");
    expect(markup).toContain("Proposed meanings:");
    expect(markup).toContain("Supporting source:");
    expect(markup).toContain("Explanation:");
    expect(markup).toContain("Context:");
    expect(markup).toContain("GitHub issues are public");
  });

  it("Given clipboard access, when the fallback is copied, then a polite acknowledgement appears", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CorrectionFlow subject="adrenal" currentBreakdown="ad- + ren- + -al" />);
    cleanups.push(enhanceSite(window));
    await userEvent.click(screen.getByText(/copyable fallback template/i));
    await userEvent.click(screen.getByRole("button", { name: /copy template/i }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(await screen.findByText("Template copied.")).toHaveAttribute("aria-live", "polite");
  });

  it("Given clipboard failure, when copy is activated, then manual recovery is announced and the selectable template receives focus", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<CorrectionFlow subject="adrenal" currentBreakdown="ad- + ren- + -al" />);
    cleanups.push(enhanceSite(window));
    await userEvent.click(screen.getByText(/copyable fallback template/i));
    await userEvent.click(screen.getByRole("button", { name: /copy template/i }));

    expect(await screen.findByText(/copy failed/i)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/Term: adrenal/)).toHaveFocus();
  });

  it("Given multiple correction instances, when one copy is activated, then only its own template and status are used", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<><CorrectionFlow subject="adrenal" currentBreakdown="ad- + ren- + -al" /><CorrectionFlow subject="cytokine" currentBreakdown="cyt/o + -kine" /></>);
    cleanups.push(enhanceSite(window));
    const corrections = screen.getAllByRole("region", { name: "Propose a correction" });
    const second = corrections[1];
    if (second === undefined) throw new Error("Expected a second correction fixture");
    await userEvent.click(within(second).getByText(/copyable fallback template/i));
    await userEvent.click(within(second).getByRole("button", { name: /copy template/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Term: cytokine"));
    expect(within(second).getByText("Template copied.")).toBeVisible();
    expect(within(corrections[0] ?? second).queryByText("Template copied.")).toBeNull();
  });

  it("Given a public issue action, when rendered, then its privacy warning precedes the external link", () => {
    render(<CorrectionFlow subject="cytokine" currentBreakdown="cyt/o + -kine" />);
    const warning = screen.getByText(/github issues are public/i);
    const action = screen.getByRole("link", { name: /propose a correction on github/i });

    expect(warning.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action).toHaveAttribute("target", "_blank");
  });
});
