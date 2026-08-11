import { describe, expect, it } from "vitest";

import candidateDispositionsJson from "../../data/candidate-dispositions.json";
import sourcesDocument from "../../data/sources.json";
import { candidateDispositionsDocumentSchema } from "../../src/data/schemas";
import { candidateTerms } from "../../src/generated/candidates";
import { corpus } from "../../src/generated/corpus";
import { expectedSourceGroups } from "./anatomy-physiology-candidate-sources";

const expectedInventory = [
  "absorption",
  "actin",
  "adipocyte",
  "anabolism",
  "anatomy",
  "assimilation",
  "axon",
  "cardiomyocyte",
  "catabolism",
  "cerebellum",
  "cerebrum",
  "chondrocyte",
  "connective tissue",
  "contraction",
  "cytology",
  "deglutition",
  "dendrite",
  "depolarization",
  "dermis",
  "diaphysis",
  "diastole",
  "diffusion",
  "diuresis",
  "endocardium",
  "endomysium",
  "endosteum",
  "epicardium",
  "epidermis",
  "epimysium",
  "epiphysis",
  "epithelial",
  "erythrocyte",
  "erythropoiesis",
  "expiration",
  "extracellular",
  "fertilization",
  "fibroblast",
  "filtration",
  "gluconeogenesis",
  "glycogenesis",
  "glycogenolysis",
  "gonadotropin",
  "hematopoiesis",
  "hemostasis",
  "histology",
  "homeostasis",
  "hypodermis",
  "hypothalamus",
  "implantation",
  "inspiration",
  "interstitial",
  "intracellular",
  "keratinocyte",
  "lactation",
  "leukocyte",
  "leukopoiesis",
  "lipolysis",
  "mastication",
  "melanocyte",
  "meninges",
  "metabolism",
  "metaphysis",
  "micturition",
  "myocardium",
  "myocyte",
  "myofibril",
  "myosin",
  "neuroglia",
  "neuron",
  "neurotransmitter",
  "oogenesis",
  "osmosis",
  "ossification",
  "osteoblast",
  "osteoclast",
  "osteocyte",
  "osteogenesis",
  "osteon",
  "ovulation",
  "oxygenation",
  "perfusion",
  "pericardium",
  "perichondrium",
  "perimysium",
  "periosteum",
  "peristalsis",
  "physiology",
  "reabsorption",
  "relaxation",
  "repolarization",
  "respiration",
  "sarcolemma",
  "sarcomere",
  "sarcoplasm",
  "sebaceous gland",
  "secretion",
  "spermatogenesis",
  "sudoriferous gland",
  "synapse",
  "systole",
  "thalamus",
  "thrombopoiesis",
  "vasoconstriction",
  "vasodilation",
  "ventilation",
] as const;

const expectedSourceByTerm = new Map<string, string>(
  Object.entries(expectedSourceGroups).flatMap(([sourceId, terms]) => terms.map((term) => [term, sourceId] as const)),
);
const expectedSet = new Set<string>(expectedInventory);
const candidateDispositionsDocument = candidateDispositionsDocumentSchema.parse(candidateDispositionsJson);
const importedDispositions = candidateDispositionsDocument.candidateDispositions.filter((disposition) =>
  expectedSet.has(disposition.originalNormalized)
);
const promotedTerms = new Set([
  "cardiomyocyte",
  "chondrocyte",
  "cytology",
  "fibroblast",
  "hemostasis",
  "myocyte",
  "osteoblast",
  "osteocyte",
]);

describe("anatomy and physiology candidate dispositions", () => {
  it("Given the approved inventory, when the resolved corpus is loaded, then every original candidate is archived once", () => {
    const importedSet = new Set<string>(importedDispositions.map((disposition) => disposition.originalNormalized));
    const missing = expectedInventory.filter((term) => !importedSet.has(term));
    const unexpected = [...importedSet].filter((term) => !expectedSet.has(term));

    expect(expectedInventory).toHaveLength(105);
    expect([...expectedInventory].sort()).toEqual(expectedInventory);
    expect(candidateTerms).toEqual([]);
    expect(importedDispositions).toHaveLength(105);
    expect(importedSet.size).toBe(105);
    expect(missing).toEqual([]);
    expect(unexpected).toEqual([]);
    expect(corpus.terms.filter((term) => expectedSet.has(term.normalized)).map((term) => term.normalized).sort()).toEqual(
      [...promotedTerms].sort(),
    );
  });

  it("Given an archived candidate, when its disposition is inspected, then original identity and provenance are exact", () => {
    for (const disposition of importedDispositions) {
      const expectedSource = expectedSourceByTerm.get(disposition.originalNormalized);
      expect(expectedSource).toBeDefined();
      expect(disposition.originalTerm).toBe(disposition.originalNormalized);
      expect(disposition.originalCandidateId).toBe(
        `candidate:${disposition.originalNormalized.replaceAll(" ", "-")}`,
      );
      expect(disposition.reviewSources).toEqual([expectedSource]);
      if (promotedTerms.has(disposition.originalNormalized)) {
        expect(disposition).toMatchObject({
          outcome: "promoted_verified_term",
          promotedTermId: `term:${disposition.originalNormalized}`,
        });
      } else {
        expect(disposition.outcome).not.toBe("promoted_verified_term");
      }
    }
  });

  it("Given the Chapter 2 source, when the source register is loaded, then its provenance is exact", () => {
    expect(sourcesDocument.sources).toContainEqual({
      id: "source:ncbi-medical-terminology-whole-body",
      publisher: "National Library of Medicine, Open Resources for Nursing",
      title: "Medical Terminology, 2nd ed., Chapter 2: Medical Language Related to the Whole Body",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK607445/",
    });
  });

  it("Given the approved source map, when archived dispositions are bucketed, then every bucket is exhaustive", () => {
    const importedBySource = new Map<string, string[]>();
    for (const disposition of importedDispositions) {
      const sourceId = disposition.reviewSources[0];
      if (sourceId === undefined) continue;
      const bucket = importedBySource.get(sourceId) ?? [];
      bucket.push(disposition.originalNormalized);
      importedBySource.set(sourceId, bucket);
    }

    for (const [sourceId, expectedTerms] of Object.entries(expectedSourceGroups)) {
      expect(importedBySource.get(sourceId)?.sort()).toEqual([...expectedTerms].sort());
    }
  });
});
