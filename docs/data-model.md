# Data Model

The corpus is authored in `data/` and compiled into derived modules in `src/generated/`. The build rejects unknown fields, broken references, and non-reconstructing analyses before it writes anything out.

## Authoritative files

| File | Role |
| --- | --- |
| `data/sources.json` | Source register |
| `data/word-parts/prefixes.json` | Prefix part records |
| `data/word-parts/roots.json` | Root part records |
| `data/word-parts/suffixes.json` | Suffix part records |
| `data/word-parts/combining-forms.json` | Combining-form records |
| `data/terms/*.json` | Canonical term records |
| `data/aliases.json` | Alias records |
| `data/relations.json` | Term relations |

## Record shapes

### Source

- `id`
- `publisher`
- `title`
- `url`

Sources are public citations. They support provenance, they do not make a clinical claim.

### Part

- `id`
- `kind`
- `form`
- `meaning`
- `sources`

Part kinds are fixed to `prefix`, `root`, `suffix`, and `combiningForm`.

### Term

- `id`
- `slug`
- `term`
- `normalized`
- `sources`
- `note`
- `analyses`

Each analysis has:

- `id`
- `primary`
- `qualification` is optional
- `segments`

Each segment has:

- `partId`
- `surface`
- `start`
- `end`
- `transformations` is optional

The only transformation in the current corpus is `drop_terminal_vowel` with `vowel: "o"`.

### Alias

- `alias`
- `normalized`
- `termId`
- `sources`

Aliases map a spelling variant to one canonical term.

### Relation

- `kind`
- `from`
- `to`
- `sources`

The current relation kinds are `contrast` and `related`.

## Cross-record validation

`npm run data:validate` enforces these rules:

- unique source, part, and term IDs
- unique term slugs
- unique term normalized values
- no unknown JSON fields
- HTTPS source URLs
- all source references resolve
- all part references resolve
- all alias term references resolve
- all relation term references resolve
- no self relations
- no duplicate relations
- every term has exactly one primary analysis
- segment spans are contiguous and in range
- every segment surface reconstructs the normalized term
- a part transformation must match the part kind and spelling rule it claims

## Generated outputs

`npm run data:build` writes these files into `src/generated/`:

- `corpus.ts`
- `index.ts`
- `routes.ts`
- `segmentation.ts`

Do not edit those files directly. If they change, regenerate them from the authored JSON.

`npm run data:test` checks that the generated data stays stable, sorted, and symmetric where required.

## Editorial notes

Some records intentionally carry qualified or alternative analyses. Examples:

- `adrenal` keeps both the `ad- + ren + -al` reading and the qualified `adren- + -al` alternative.
- `cytokine` keeps `cyt/o` as a combining form and marks `-kine` as lexicalized.
- `hypoglycemia` and `hyperglycemia` record the dropped `o` from `glyc/o` explicitly.
- `hypoglycaemia` and `hyperglycaemia` are alias spellings, not separate canonical terms.

Those notes document authorial judgment and source scope. They are not medical advice.
