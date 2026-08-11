import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  deferredDisposition,
  validate,
  withFixture,
  writeDispositions,
} from "./candidate-dispositions-validation-fixture";

describe("candidate disposition validation", () => {
  it("Given every supported final outcome, when validated, then the archive is accepted", () => {
    withFixture((directory) => {
      writeFileSync(join(directory, "candidate-terms.json"), '{"candidateTerms":[]}\n');
      writeFileSync(join(directory, "candidate-review-decisions.json"), '{"candidateReviewDecisions":[]}\n');
      const outcomes = [
        "deferred_insufficient_evidence",
        "deferred_schema_incompatible",
        "deferred_phrase_review",
        "source_review_required",
        "rejected_out_of_scope",
      ] as const;
      writeDispositions(directory, [
        {
          ...deferredDisposition,
          originalCandidateId: "candidate:promoted",
          originalTerm: "promoted",
          originalNormalized: "promoted",
          outcome: "promoted_verified_term",
          promotedTermId: "term:sample",
        },
        ...outcomes.map((outcome, index) => ({
          ...deferredDisposition,
          originalCandidateId: `candidate:archived-${index}`,
          originalTerm: `archived${index}`,
          originalNormalized: `archived${index}`,
          outcome,
        })),
      ]);
      expect(validate(directory).status).toBe(0);
    });
  });

  it("Given duplicate original candidate IDs, when validated, then the duplicate disposition is rejected", () => {
    withFixture((directory) => {
      writeDispositions(directory, [deferredDisposition, deferredDisposition]);
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("duplicate candidate disposition candidate:diabetes");
    });
  });

  it("Given a promoted disposition with a missing term, when validated, then the dangling term is rejected", () => {
    withFixture((directory) => {
      writeDispositions(directory, [{
        ...deferredDisposition,
        outcome: "promoted_verified_term",
        promotedTermId: "term:missing",
      }]);
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("dangling disposition term term:missing");
    });
  });

  it("Given a disposition with a missing source, when validated, then the dangling source is rejected", () => {
    withFixture((directory) => {
      writeDispositions(directory, [{ ...deferredDisposition, reviewSources: ["source:missing"] }]);
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("dangling source source:missing");
    });
  });

  it("Given a promoted disposition without its outcome field, when validated, then the field is required", () => {
    withFixture((directory) => {
      writeDispositions(directory, [{ ...deferredDisposition, outcome: "promoted_verified_term" }]);
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("promotedTermId");
    });
  });

  it("Given final disposition text containing TODO or draft markers, when validated, then it is rejected", () => {
    for (const marker of ["TODO: verify later", "Draft review text"] as const) {
      withFixture((directory) => {
        writeDispositions(directory, [{ ...deferredDisposition, note: marker }]);
        const outcome = validate(directory);
        expect(outcome.status).not.toBe(0);
        expect(outcome.output).toContain("final disposition note must not contain TODO or draft text");
      });
    }
  });

  it("Given a removed candidate with original identity, when validated, then its disposition remains valid", () => {
    withFixture((directory) => {
      writeFileSync(join(directory, "candidate-terms.json"), '{"candidateTerms":[]}\n');
      writeFileSync(join(directory, "candidate-review-decisions.json"), '{"candidateReviewDecisions":[]}\n');
      writeDispositions(directory, [deferredDisposition]);
      expect(validate(directory).status).toBe(0);
    });
  });
});
