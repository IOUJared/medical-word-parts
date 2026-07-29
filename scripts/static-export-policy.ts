import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import ts from "typescript";

const allowedExternalModules = new Set([
  "next",
  "next/font/local",
  "next/link",
  "next/navigation",
  "next/script",
  "react",
  "zod",
]);

export class StaticExportPolicyError extends Error {
  override readonly name = "StaticExportPolicyError";
}

function moduleName(statement: ts.ImportDeclaration): string | undefined {
  return ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
}

function isExternalModule(name: string): boolean {
  return !name.startsWith(".") && !name.startsWith("/") && !name.startsWith("node:");
}

export function assertHydrationFreeSource(source: string, path: string): void {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client") {
      throw new StaticExportPolicyError(`${path}: use client is incompatible with zero-runtime export`);
    }
    if (!ts.isImportDeclaration(statement)) continue;
    const name = moduleName(statement);
    if (name === undefined) continue;
    if (name === "react" && statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword) {
      throw new StaticExportPolicyError(`${path}: runtime React imports are incompatible with zero-runtime export`);
    }
    if (name === "next/navigation") {
      const bindings = statement.importClause?.namedBindings;
      const imports = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements.map((element) => element.propertyName?.text ?? element.name.text) : [];
      if (imports.length === 0 || imports.some((value) => value !== "notFound")) {
        throw new StaticExportPolicyError(`${path}: next/navigation client hooks are incompatible with zero-runtime export`);
      }
    }
    if (isExternalModule(name) && !allowedExternalModules.has(name)) {
      throw new StaticExportPolicyError(`${path}: unsupported dependency ${name}`);
    }
  }
}

export async function assertHydrationFreeTree(root: string): Promise<void> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const sourcePaths = entries
    .filter((entry) => entry.isFile() && /\.[cm]?tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  for (const path of sourcePaths) assertHydrationFreeSource(await readFile(path, "utf8"), path);
}
