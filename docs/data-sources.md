# Corpus Sources And Audit

## Boundary

The version-controlled files in `data/` are the only authored corpus inputs. `src/data/` parses each JSON document with strict Zod schemas at the file boundary, then applies cross-record integrity checks. `src/generated/` is derived output and starts with a generated-file warning.

## Source register

| Key | Publisher | Use |
| --- | --- | --- |
| `source:medlineplus-appendix-a` | National Library of Medicine, NIH | General word-part teaching records and contrast relations. |
| `source:ncbi-medical-terminology` | National Library of Medicine, Open Resources for Nursing | Word-part terminology records and spelling variants. |
| `source:ncbi-medical-terminology-whole-body` | National Library of Medicine, Open Resources for Nursing | Chapter 2 provenance for the anatomy and physiology candidate queue. |
| `source:nci-cytokine` | National Cancer Institute | The lexicalized cytokine note and the `-kine` citation. |
| `source:nci-adenoma` | National Cancer Institute | The adenoma term citation. |
| `source:nci-osteoplasty` | National Cancer Institute | The osteoplasty term citation. |
| `source:nlm-snomed-core-subset` | National Library of Medicine | Frequently used clinical problem-list source for the common terms route. |
| `source:wikidata-cc0` | Wikimedia Foundation | CC0 candidate-term discovery data. |
| `source:disease-ontology-cc0` | Disease Ontology | CC0 disease-name candidate records. |
| `source:mesh-terms` | National Library of Medicine | MeSH candidate-term discovery data with NLM acknowledgement and version tracking. |

The canonical URLs live in [`data/sources.json`](../data/sources.json). The corpus does not fetch them at build or runtime.

The common terms route cites the NLM CORE Problem List Subset as the frequency-backed source. The page only displays local terms whose word-part analyses are already verified in this corpus; raw CORE terms are not imported until their parts are source-checked and authored.

`data/candidate-terms.json` is a discovery queue, not a verified word-part corpus. Candidate terms may be shown in search and on the common terms route, but they do not produce term detail pages or verified analyses until an authored `data/terms/*.json` record is added.

Candidate records that cite `source:mesh-terms` with a MeSH descriptor identifier are source-backed term identities only. Their word parts remain unverified until a separate editorial pass identifies each proposed segment, checks any new or unused part against an authoritative word-part source, adds missing `data/word-parts/*.json` records with citations, and then authors a reconstructing `data/terms/*.json` analysis. Do not infer or publish a word-part meaning from a candidate term alone.

## Provenance notes

Every authored term, part, alias, and relation has at least one source key. The validation command rejects dangling citations, unknown JSON fields, duplicate IDs, duplicate slugs, duplicate normalized values, invalid segment spans, non-reconstructing analyses, invalid vowel-drop rules, and invalid relations.

Some records carry editorial notes because the corpus is teaching material, not a universal clinical system:

- `adrenal` keeps both the `ad- + ren + -al` reading and the qualified `adren- + -al` alternative.
- `cytokine` keeps `cyt/o` as a combining form and flags `-kine` as lexicalized.
- `hypoglycemia` and `hyperglycemia` record the dropped `o` from `glyc/o` explicitly.
- `hypoglycaemia` and `hyperglycaemia` are alias spellings, not separate canonical terms.

## Rebuild audit

Run `npm run data:build`, then `npm run data:validate`, then `npm run data:test` after editing authored corpus files. Generation uses lexical ordering only and contains no clock, random, network, or environment-derived content. Re-running the build must leave `src/generated/candidates.ts`, `src/generated/corpus.ts`, `src/generated/index.ts`, `src/generated/routes.ts`, and `src/generated/segmentation.ts` byte-identical.

## Candidate verification workflow

Run `npm run candidate:triage` to rank the candidate queue by known and unresolved word-part coverage. Run `npm run candidate:definitions -- --batch-size 100 --batch 1` to build `.artifacts/candidate-definition-batch.json` for the first 100 pending candidates; increment `--batch` for the next 100-word chunk. Descriptor-backed MeSH candidates get source scope-note definitions in bulk, while candidates without machine-readable descriptor IDs get source-review leads. Use `npm run candidate:definitions:check -- --batch-size 100 --batch 1` before relying on a saved batch.
