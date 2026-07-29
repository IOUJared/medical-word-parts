import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { build } from "esbuild";

type BundleTarget = "analyzer" | "parts" | "site" | "theme";

type BundleSpec = {
  readonly enhancer: string;
  readonly format: "esm" | "iife";
  readonly module: string;
  readonly output: string;
  readonly target: BundleTarget;
};

type BundleArguments = {
  readonly check: boolean;
  readonly output: string;
  readonly spec: BundleSpec;
};

class BrowserBundleError extends Error {
  override readonly name = "BrowserBundleError";
}

function bundleSpec(target: string | undefined): BundleSpec {
  switch (target) {
    case "analyzer":
      return { enhancer: "enhanceAnalyzer", format: "esm", module: "./src/analyzer/client.ts", output: "public/generated/analyzer.js", target };
    case "parts":
      return { enhancer: "enhanceParts", format: "esm", module: "./src/parts/client.ts", output: "public/generated/parts.js", target };
    case "site":
      return { enhancer: "enhanceSite", format: "esm", module: "./src/site/client.ts", output: "public/generated/site.js", target };
    case "theme":
      return { enhancer: "applyThemeBootstrap", format: "iife", module: "./src/theme/client.ts", output: "public/generated/theme.js", target };
    default:
      throw new BrowserBundleError("Use analyzer, parts, site, or theme as the bundle target");
  }
}

function bundleArguments(arguments_: readonly string[]): BundleArguments {
  const spec = bundleSpec(arguments_[0]);
  const options = arguments_.slice(1);
  const check = options.includes("--check");
  const outputOptions = options.filter((option) => option !== "--check");
  if (outputOptions.length === 0) return { check, output: join(process.cwd(), spec.output), spec };
  if (outputOptions.length === 2 && outputOptions[0] === "--output" && outputOptions[1] !== undefined) {
    return { check, output: resolve(outputOptions[1]), spec };
  }
  throw new BrowserBundleError("Use [--check] [--output <file>] after the bundle target");
}

async function renderBundle(spec: BundleSpec): Promise<string> {
  const result = await build({
    bundle: true,
    charset: "ascii",
    format: spec.format,
    stdin: {
      contents: `import { ${spec.enhancer} } from "${spec.module}"; ${spec.enhancer}(window);`,
      loader: "ts",
      resolveDir: process.cwd(),
      sourcefile: `${spec.target}-entry.ts`,
    },
    legalComments: "none",
    minify: true,
    outfile: `${spec.target}.js`,
    platform: "browser",
    sourcemap: false,
    splitting: false,
    target: "es2022",
    treeShaking: true,
    write: false,
  });
  const output = result.outputFiles[0];
  if (output === undefined || result.outputFiles.length !== 1) throw new BrowserBundleError(`Expected one ${spec.target} bundle output`);
  return `// GENERATED FILE\n${output.text}`;
}

const arguments_ = bundleArguments(process.argv.slice(2));
const expected = await renderBundle(arguments_.spec);
if (arguments_.check) {
  const actual = await readFile(arguments_.output, "utf8");
  if (actual !== expected) throw new BrowserBundleError(`${arguments_.spec.output} is stale; run npm run ${arguments_.spec.target}:build`);
} else {
  await mkdir(dirname(arguments_.output), { recursive: true });
  await writeFile(arguments_.output, expected);
}
