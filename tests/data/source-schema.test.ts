import { describe, expect, it } from "vitest";

import { sourceSchema } from "../../src/data/schemas";

const source = {
  id: "source:test",
  publisher: "Test publisher",
  title: "Test source",
  url: "https://example.test/source",
} as const;

describe("authored source URL schema", () => {
  it.each(["http://example.test/source", "ftp://example.test/source"])("Given a non-HTTPS source URL %s, when parsed, then it is rejected", (url) => {
    expect(sourceSchema.safeParse({ ...source, url }).success).toBe(false);
  });

  it("Given an HTTPS source URL, when parsed, then it is accepted", () => {
    expect(sourceSchema.safeParse(source).success).toBe(true);
  });
});
