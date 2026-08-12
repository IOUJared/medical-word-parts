import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

describe("root development end-to-end environment", () => {
  it("Given inherited Cloudflare production variables, when root development E2E runs, then root mounting and client hydration pass", () => {
    const outcome = spawnSync(npmCommand, ["run", "test:e2e:dev:browser"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_PATH: "/medical-word-parts",
        NEXT_PUBLIC_SITE_URL:
          "https://ioujared.github.io/medical-word-parts",
        NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS: "0",
      },
      timeout: 240_000,
    });

    expect({ output: `${outcome.stdout}${outcome.stderr}`, status: outcome.status }).toMatchObject({
      status: 0,
    });
  }, 240_000);
});
