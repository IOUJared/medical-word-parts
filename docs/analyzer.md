# Analyzer

The analyzer is a pure local function over the generated corpus. It does not depend on React, Next.js, or any server runtime.

## Entry points

- `analyzeTerm(input)` returns one of four result kinds.
- `searchCorpus(input)` returns deterministic ranked matches for terms and parts.

## Normalization

Input is normalized with NFKC, trimmed, and lowercased.

For term analysis, the normalized value must also match the supported pattern. Otherwise the analyzer returns `unsupported` with one of these reasons:

- `empty`
- `too_long`
- `multiple_words`
- `unsupported_characters`
- `no_known_parts`

## Result kinds

### exact

Returned when the normalized input matches a canonical term or an alias.

- canonical matches carry provenance `{ kind: "canonical" }`
- alias matches carry the alias spelling and its citations
- confidence is always `{ basis: "verified", score: 1 }`
- the result includes the authored primary analysis and any authored alternatives

### derived

Returned when the analyzer can cover the full normalized input with known parts, but there is no authored term record.

- confidence basis is `complete_coverage`
- confidence score is `0.9`
- the result includes the chosen segmentation plus ranked alternatives

### partial

Returned when the analyzer can segment some, but not all, of the normalized input.

- confidence basis is `partial_coverage`
- confidence score is `Math.round((covered / inputLength) * 90) / 100`, which scales the covered fraction to a maximum of `0.9` and rounds to two decimals
- unresolved spans stay visible as literal gaps

### unsupported

Returned when the input cannot be analyzed locally.

## Segmentation and ranking

The browser and server code share the same deterministic segmentation logic.

Candidate segmentations are ranked in this order:

1. complete coverage first
2. more covered characters
3. fewer unmatched characters
4. fewer segments
5. longer leftmost segments
6. lexicographic part IDs

That ranking makes ties stable and repeatable.

## Transformations

The current transformation model is narrow on purpose. A combining form ending in `o` may drop that terminal vowel before a suffix. The transformation is recorded explicitly instead of being hidden.

Examples:

- `glyc/o` can surface as `glyc`
- `cyt/o` can surface as `cyt` or `cyto`, depending on the analysis path

## Search

Search uses the same corpus and the same normalized query rules, but it returns evidence-ranked matches instead of analysis states.

Match kinds are ranked from strongest to weakest:

- `exact`
- `prefix`
- `token_prefix`
- `substring`

Search field order is:

1. term or alias for term results
2. notation, surface, then meaning for parts

When two results still tie, the analyzer keeps the order stable by match kind, field, then ID.

The current search path is framework independent. UI pages only consume the result.
