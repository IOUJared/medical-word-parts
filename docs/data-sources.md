# Corpus Sources And Audit

## Boundary

The version-controlled files in `data/` are the only authored corpus inputs. `src/data/` parses each JSON document with strict Zod schemas at the file boundary, then applies cross-record integrity checks. `src/generated/` is derived output and starts with a generated-file warning.

## Source register

| Key | Publisher | Use |
| --- | --- | --- |
| `source:medlineplus-appendix-a` | National Library of Medicine, NIH | General word-part teaching records and contrast relations. |
| `source:ncbi-medical-terminology` | National Library of Medicine, Open Resources for Nursing | Word-part terminology records and spelling variants. |
| `source:nci-cytokine` | National Cancer Institute | The lexicalized cytokine note and the `-kine` citation. |
| `source:nci-adenoma` | National Cancer Institute | The adenoma term citation. |
| `source:nci-osteoplasty` | National Cancer Institute | The osteoplasty term citation. |
| `source:nlm-snomed-core-subset` | National Library of Medicine | Frequently used clinical problem-list source for the common terms route. |

The canonical URLs live in [`data/sources.json`](../data/sources.json). The corpus does not fetch them at build or runtime.

The common terms route cites the NLM CORE Problem List Subset as the frequency-backed source. The page only displays local terms whose word-part analyses are already verified in this corpus; raw CORE terms are not imported until their parts are source-checked and authored.

## Provenance notes

Every authored term, part, alias, and relation has at least one source key. The validation command rejects dangling citations, unknown JSON fields, duplicate IDs, duplicate slugs, duplicate normalized values, invalid segment spans, non-reconstructing analyses, invalid vowel-drop rules, and invalid relations.

Some records carry editorial notes because the corpus is teaching material, not a universal clinical system:

- `adrenal` keeps both the `ad- + ren + -al` reading and the qualified `adren- + -al` alternative.
- `cytokine` keeps `cyt/o` as a combining form and flags `-kine` as lexicalized.
- `hypoglycemia` and `hyperglycemia` record the dropped `o` from `glyc/o` explicitly.
- `hypoglycaemia` and `hyperglycaemia` are alias spellings, not separate canonical terms.

## Rebuild audit

Run `npm run data:build`, then `npm run data:validate`, then `npm run data:test` after editing authored corpus files. Generation uses lexical ordering only and contains no clock, random, network, or environment-derived content. Re-running the build must leave `src/generated/corpus.ts`, `src/generated/index.ts`, `src/generated/routes.ts`, and `src/generated/segmentation.ts` byte-identical.
