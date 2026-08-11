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

### Medical word-list import

The 2026-08-11 import used `medical_words_fast.txt` (SHA-256 `c32dac685979d48d52413ad06941ccbfe61670f99b5d1d66ff746c01f4143956`) only as a discovery list. Of 58,468 unique lines, deterministic filtering removed 188 entries containing numbers, 1,416 abbreviation-like entries shorter than four letters, 235 all-capital abbreviations, 69 mixed-case abbreviation-like entries, 11,559 phrases, and 1,016 punctuated or non-ASCII entries. Existing terms were not duplicated.

Publication required both an exact NLM MeSH descriptor identity and a complete reconstruction from already cited word parts. Ninety-four new terms met both conditions. Twelve other exact MeSH headwords were withheld because the available segmentation would teach a misleading meaning (for example, interpreting the `angio` in a bile-duct term as “blood vessel”). No definitions or other prose were copied from the discovery list.

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

Run `npm run candidate:triage` to rank the candidate queue by known and unresolved word-part coverage. Run `npm run candidate:decompose -- --batch-size 100 --batch 1` to build `.artifacts/candidate-decomposition-batch.json` for the first 100 decomposition-review candidates; increment `--batch` for the next 100-word chunk. Each decomposition batch includes known word-part segments, unresolved spans, and a review status without inventing meanings for missing parts. Use `npm run candidate:decompose:check -- --batch-size 100 --batch 1` before relying on a saved decomposition batch.

Run `npm run candidate:definitions -- --batch-size 100 --batch 1` to build `.artifacts/candidate-definition-batch.json` for the first 100 pending candidates; increment `--batch` for the next 100-word chunk. Descriptor-backed MeSH candidates get source scope-note definitions in bulk, while candidates without machine-readable descriptor IDs get source-review leads. Use `npm run candidate:definitions:check -- --batch-size 100 --batch 1` before relying on a saved definition batch.

Before beginning a batch run, freeze the active candidate queue with `npm run candidate:manifest -- --output .artifacts/candidate-manifest.json`. The manifest records the source-file SHA-256 and deterministic 100-ID windows. Save each workflow's JSON batches in its own directory, then verify the aggregate coverage against the frozen queue: `npm run candidate:definitions:coverage -- --manifest .artifacts/candidate-manifest.json --batches .artifacts/definition-batches` and `npm run candidate:decompose:coverage -- --manifest .artifacts/candidate-manifest.json --batches .artifacts/decomposition-batches`. Coverage checks reject source drift, malformed batches, stale IDs, duplicates, gaps, and batches larger than 100; candidates already deferred by the corpus are reported as deterministic exclusions.

`data/candidate-dispositions.json` is the authoritative long-term archive for resolved candidate IDs. A disposition copies the original candidate ID, term, and normalized spelling before the active record is removed, records one final outcome, and cites the sources used for review. Promotions must reference an existing verified term; deferred, source-review, phrase-review, schema-incompatible, and out-of-scope outcomes remain archive records rather than verified terms. `npm run data:validate` rejects duplicate IDs, stale active-candidate identity, dangling source or promoted-term references, missing outcome fields, and unfinished `TODO` or draft notes.

Apply complete decomposition promotions with `npm run candidate:promote:apply -- --manifest .artifacts/candidate-manifest.json --decomposition .artifacts/decomposition-batches/001.json --decomposition-sha256 <sha256>`. The command refuses batches larger than 100, stale candidate manifests, stale decomposition files, partial/no-known/phrase/unsupported candidates, collisions with existing terms, and segments that do not reference existing word parts. It writes final term JSON, removes promoted candidates from the active queue, removes their active review decisions, and appends promoted disposition records only after the whole batch validates.

After aggregate coverage passes, regroup the reviewed decomposition entries by frozen manifest window; each apply artifact may contain only non-deferred candidates from its matching window. Archive the non-promotable members with `npm run candidate:dispose:apply -- --manifest .artifacts/candidate-manifest.json --decomposition .artifacts/disposition-batches/001.json --decomposition-sha256 <sha256> --batch 1`. Apply windows in order. The command migrates existing deferred reviews, records source-review, insufficient-evidence, phrase-review, existing-verified-term, or out-of-scope outcomes, removes finalized candidates and their review decisions, and validates the complete planned corpus before writing. Repeating the same batch completes an interrupted disposition-first write or returns an idempotent no-op. A still-active `ready_for_term_draft` candidate is refused and must use the promotion command.

The empty archive remains valid while the queue is still active. Before applying a frozen queue, run `npm run data:validate -- --candidate-disposition-manifest .artifacts/candidate-manifest.json`. This authoritative apply check additionally rejects a manifest whose candidate source hash has drifted and an archive that omits, duplicates, or adds candidate IDs from the frozen manifest.

The current production corpus has completed this review cycle: `data/candidate-terms.json` and `data/candidate-review-decisions.json` are empty, while `data/candidate-dispositions.json` preserves all 1,057 original candidate IDs. Eight candidates became source-backed verified terms; every other candidate remains represented only by its final disposition and provenance. `npm run data:build` therefore emits an empty candidate module and candidate search index without removing verified-term search or browsing.
