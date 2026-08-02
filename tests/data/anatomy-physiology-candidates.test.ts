import { describe, expect, it } from "vitest";

import sourcesDocument from "../../data/sources.json";
import { candidateTerms } from "../../src/generated/candidates";
import { corpus } from "../../src/generated/corpus";

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

const expectedSourceGroups = {
  "source:ncbi-medical-terminology-whole-body": [
    "homeostasis",
    "anatomy",
    "physiology",
    "histology",
    "cytology",
    "metabolism",
    "anabolism",
    "catabolism",
    "extracellular",
    "intracellular",
    "interstitial",
  ],
  "source:ncbi-medical-terminology-integumentary": [
    "epithelial",
    "connective tissue",
    "adipocyte",
    "fibroblast",
    "epidermis",
    "dermis",
    "hypodermis",
    "keratinocyte",
    "melanocyte",
    "sebaceous gland",
    "sudoriferous gland",
  ],
  "source:ncbi-medical-terminology-skeletal": [
    "chondrocyte",
    "osteocyte",
    "osteoblast",
    "osteoclast",
    "hematopoiesis",
    "periosteum",
    "endosteum",
    "perichondrium",
    "epiphysis",
    "metaphysis",
    "diaphysis",
    "osteon",
    "osteogenesis",
    "ossification",
  ],
  "source:ncbi-medical-terminology-cardiovascular": [
    "erythrocyte",
    "leukocyte",
    "cardiomyocyte",
    "endocardium",
    "myocardium",
    "pericardium",
    "epicardium",
    "erythropoiesis",
    "leukopoiesis",
    "thrombopoiesis",
    "hemostasis",
    "vasoconstriction",
    "vasodilation",
    "systole",
    "diastole",
    "perfusion",
  ],
  "source:ncbi-medical-terminology-muscular": [
    "myocyte",
    "epimysium",
    "perimysium",
    "endomysium",
    "sarcolemma",
    "sarcoplasm",
    "sarcomere",
    "myofibril",
    "actin",
    "myosin",
    "contraction",
    "relaxation",
  ],
  "source:ncbi-medical-terminology-nervous": [
    "neuron",
    "neuroglia",
    "cerebrum",
    "cerebellum",
    "hypothalamus",
    "thalamus",
    "meninges",
    "dendrite",
    "axon",
    "synapse",
    "neurotransmitter",
    "depolarization",
    "repolarization",
  ],
  "source:ncbi-medical-terminology-respiratory": [
    "ventilation",
    "respiration",
    "inspiration",
    "expiration",
    "diffusion",
    "oxygenation",
  ],
  "source:ncbi-medical-terminology-digestive": [
    "peristalsis",
    "mastication",
    "deglutition",
    "absorption",
    "assimilation",
    "glycogenesis",
    "glycogenolysis",
    "gluconeogenesis",
    "lipolysis",
  ],
  "source:ncbi-medical-terminology-urinary": [
    "filtration",
    "reabsorption",
    "secretion",
    "micturition",
    "diuresis",
    "osmosis",
  ],
  "source:ncbi-medical-terminology-male-reproductive": ["spermatogenesis"],
  "source:ncbi-medical-terminology-female-reproductive": [
    "oogenesis",
    "ovulation",
    "fertilization",
    "implantation",
    "lactation",
  ],
  "source:ncbi-medical-terminology-endocrine": ["gonadotropin"],
} as const;

const expectedSourceByTerm = new Map<string, string>(
  Object.entries(expectedSourceGroups).flatMap(([sourceId, terms]) => terms.map((term) => [term, sourceId] as const)),
);
const expectedSet = new Set<string>(expectedInventory);
const importedCandidates = candidateTerms.filter((candidate) => expectedSet.has(candidate.normalized));

describe("anatomy and physiology candidate import", () => {
  it("Given the approved inventory, when generated candidates are loaded, then the exact set is present once", () => {
    const importedSet = new Set<string>(importedCandidates.map((candidate) => candidate.normalized));
    const missing = expectedInventory.filter((term) => !importedSet.has(term));
    const unexpected = [...importedSet].filter((term) => !expectedSet.has(term));

    expect(expectedInventory).toHaveLength(105);
    expect([...expectedInventory].sort()).toEqual(expectedInventory);
    expect(importedCandidates).toHaveLength(105);
    expect(importedSet.size).toBe(105);
    expect(missing).toEqual([]);
    expect(unexpected).toEqual([]);
    expect(corpus.terms.some((term) => expectedSet.has(term.normalized))).toBe(false);
  });

  it("Given an approved candidate, when its generated record is inspected, then identity and provenance are exact", () => {
    for (const candidate of importedCandidates) {
      const expectedSource = expectedSourceByTerm.get(candidate.normalized);
      expect(expectedSource).toBeDefined();
      expect(candidate.term).toBe(candidate.normalized);
      expect(candidate.id).toBe(`candidate:${candidate.normalized.replaceAll(" ", "-")}`);
      expect(candidate.status).toBe("candidate");
      expect(candidate.sources).toEqual([expectedSource]);
      expect(candidate.sourceVersion).toBe("Medical Terminology, 2nd ed.");
      expect(candidate.license).toBe("CC BY 4.0");
      expect(candidate).not.toHaveProperty("aliases");
      expect(candidate).not.toHaveProperty("externalIds");
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

  it("Given the approved source map, when imported candidates are bucketed, then every bucket is exhaustive", () => {
    const importedBySource = new Map<string, string[]>();
    for (const candidate of importedCandidates) {
      const sourceId = candidate.sources[0];
      if (sourceId === undefined) continue;
      const bucket = importedBySource.get(sourceId) ?? [];
      bucket.push(candidate.normalized);
      importedBySource.set(sourceId, bucket);
    }

    for (const [sourceId, expectedTerms] of Object.entries(expectedSourceGroups)) {
      expect(importedBySource.get(sourceId)?.sort()).toEqual([...expectedTerms].sort());
    }
  });
});
