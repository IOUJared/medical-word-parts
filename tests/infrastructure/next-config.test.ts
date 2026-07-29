import { afterEach, describe, expect, it, vi } from "vitest";

const originalBasePath = process.env["NEXT_PUBLIC_BASE_PATH"];

async function loadConfig(basePath: string): Promise<typeof import("../../next.config")> {
  process.env["NEXT_PUBLIC_BASE_PATH"] = basePath;
  vi.resetModules();
  return import("../../next.config");
}

afterEach(() => {
  if (originalBasePath === undefined) {
    delete process.env["NEXT_PUBLIC_BASE_PATH"];
  } else {
    process.env["NEXT_PUBLIC_BASE_PATH"] = originalBasePath;
  }
  vi.resetModules();
});

describe("public base-path configuration", () => {
  it.each([
    "//host.example/path",
    "https://host.example/path",
    "http://host.example/path",
    "/medical\\word-parts",
    "/medical-word-parts?preview=1",
    "/medical-word-parts#top",
    "/medical-word-parts/",
  ])("Given an unsafe base path %s, when Next config loads, then it rejects the value", async (basePath) => {
    await expect(loadConfig(basePath)).rejects.toThrow(
      "NEXT_PUBLIC_BASE_PATH",
    );
  });

  it.each(["", "/medical-word-parts"])("Given a local base path %s, when Next config loads, then it retains the path", async (basePath) => {
    const config = await loadConfig(basePath);

    expect(config.default.basePath).toBe(basePath);
  });
});
