import { describe, expect, it } from "vitest";

import { buildCorrection } from "../../src/lib/correction";
import { absoluteUrl, createPageMetadata } from "../../src/lib/metadata";
import { publicUrl } from "../../src/lib/paths";

describe("correction issue builder", () => {
  it("Given a term record with punctuation, when a correction is built, then the public issue URL encodes the issue form template, label, title, and field IDs exactly", () => {
    const subject = "alpha beta/gamma & <term> (x)";
    const currentBreakdown = "pre/ root + suffix & detail <markup>";
    const correction = buildCorrection({ subject, currentBreakdown });
    const url = new URL(correction.issueUrl);
    const expectedSearch = new URLSearchParams([
      ["template", "term-correction.yml"],
      ["title", `Correction: ${subject}`],
      ["labels", "correction"],
      ["medical_term", subject],
      ["current_analysis", currentBreakdown],
    ]).toString();

    expect(url.origin + url.pathname).toBe("https://github.com/IOUJared/medical-word-parts/issues/new");
    expect(url.search.slice(1)).toBe(expectedSearch);
    expect(url.searchParams.get("template")).toBe("term-correction.yml");
    expect(url.searchParams.get("labels")).toBe("correction");
    expect(url.searchParams.get("title")).toBe(`Correction: ${subject}`);
    expect(url.searchParams.get("medical_term")).toBe(subject);
    expect(url.searchParams.get("current_analysis")).toBe(currentBreakdown);
    expect(url.searchParams.has("body")).toBe(false);
    expect(correction.fallbackText).toContain("Term:");
    expect(correction.fallbackText).toContain("Current analysis:");
    expect(correction.fallbackText).toContain("Proposed breakdown:");
    expect(correction.fallbackText).toContain("Proposed meanings:");
    expect(correction.fallbackText).toContain("Supporting source:");
    expect(correction.fallbackText).toContain("Explanation:");
    expect(correction.fallbackText).toContain("Context:");
    expect(correction.fallbackText).toContain("Privacy: This issue is public.");
  });
});

describe("metadata and public URL helpers", () => {
  it("Given a route, when metadata is created, then canonical is absolute and base-path aware", () => {
    expect(absoluteUrl("/parts/")).toBe("https://ioujared.github.io/medical-word-parts/parts/");
    expect(createPageMetadata("Word parts", "Reference index", "/parts/").alternates?.canonical)
      .toBe("https://ioujared.github.io/medical-word-parts/parts/");
  });

  it("Given an asset path, when a public URL is built, then it includes the configured base path", () => {
    expect(publicUrl("/mark.svg")).toBe("/medical-word-parts/mark.svg");
  });
});
