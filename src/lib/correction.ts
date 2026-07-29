export type CorrectionInput = {
  readonly subject: string;
  readonly currentBreakdown: string;
};

export type Correction = {
  readonly issueUrl: string;
  readonly fallbackText: string;
};

export function buildCorrection(input: CorrectionInput): Correction {
  const fallbackText = [
    `Term: ${input.subject}`,
    `Current analysis: ${input.currentBreakdown}`,
    "Proposed breakdown:",
    "Proposed meanings:",
    "Supporting source:",
    "Explanation:",
    "Context:",
    "",
    "Privacy: This issue is public. Do not include names, symptoms, record numbers, or private medical information.",
  ].join("\n");
  const parameters = new URLSearchParams([
    ["template", "term-correction.yml"],
    ["title", `Correction: ${input.subject}`],
    ["labels", "correction"],
    ["medical_term", input.subject],
    ["current_analysis", input.currentBreakdown],
  ]);
  return {
    issueUrl: `https://github.com/IOUJared/medical-word-parts/issues/new?${parameters.toString()}`,
    fallbackText,
  };
}
