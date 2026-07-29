import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const repositoryRoot = process.cwd();
const fieldSchema = z.looseObject({
    type: z.string(),
    id: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    validations: z.record(z.string(), z.unknown()).optional(),
  });
const formSchema = z.looseObject({
    name: z.string(),
    description: z.string(),
    title: z.string(),
    labels: z.array(z.string()),
    body: z.array(fieldSchema),
  });

function loadForm(): z.infer<typeof formSchema> {
  const source = readFileSync(
    join(
      repositoryRoot,
      ".github",
      "ISSUE_TEMPLATE",
      "term-correction.yml",
    ),
    "utf8",
  );
  return formSchema.parse(parseDocument(source).toJS());
}

describe("term correction issue form contract", () => {
  it("declares the correction label and all machine-readable field types", () => {
    const form = loadForm();
    const expectedFields = {
      medical_term: "input",
      current_analysis: "textarea",
      proposed_breakdown: "textarea",
      proposed_meanings: "textarea",
      supporting_source: "textarea",
      explanation: "textarea",
      context: "textarea",
    } as const;

    expect(form.labels).toContain("correction");
    expect(form.body.some((field) => field.type === "markdown")).toBe(true);
    expect(
      form.body.flatMap((field) =>
        field.id === undefined ? [] : [field.id],
      ),
    ).toEqual(Object.keys(expectedFields));
    for (const [fieldId, fieldType] of Object.entries(expectedFields)) {
      const field = form.body.find((candidate) => candidate.id === fieldId);
      expect(field?.type).toBe(fieldType);
    }
  });

  it("requires correction details while leaving context optional", () => {
    const form = loadForm();
    const requiredFieldIds = [
      "medical_term",
      "current_analysis",
      "proposed_breakdown",
      "proposed_meanings",
      "supporting_source",
      "explanation",
    ];

    for (const fieldId of requiredFieldIds) {
      const field = form.body.find((candidate) => candidate.id === fieldId);
      expect(field?.validations?.["required"]).toBe(true);
    }
    const context = form.body.find((field) => field.id === "context");
    expect(context?.validations?.["required"]).not.toBe(true);
  });
});
