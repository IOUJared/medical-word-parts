# Contributing

Thanks for helping improve the corpus.

## Content standards

- Use only public sources.
- Do not add private medical information, patient details, or personal identifiers.
- Keep the prose factual and narrow. This is an educational corpus, not a clinical reference service.
- Distinguish authored records from generated output.

## What lives where

- `data/` contains authored JSON.
- `src/generated/` contains derived modules. Do not edit them by hand.
- `src/data/` holds parsing, validation, generation, and verification code.
- `docs/` explains the corpus model, analyzer behavior, and deployment paths.

## Schema and relation rules

- Source IDs must resolve.
- Aliases must point to a canonical term.
- Relations must connect existing terms and must not loop back to the same term.
- Term analyses must reconstruct the normalized term.
- Segment spans must stay contiguous and in range.
- A transformation must match the part it claims to transform.

## Edit sequence

1. Edit the authored JSON in `data/`.
2. Run `npm run data:build`.
3. Run `npm run data:validate`.
4. Run `npm run data:test`.
5. Run `npm run browser:validate`.
6. Run `npm run lint`.
7. Run `npm run typecheck`.
8. Run `npm test`.
9. Run `npm run build`.
10. Run `npm run audit:production` when you need a production-path audit.

If the build regenerates files under `src/generated/`, include them in the same change as the authored input.

## Corrections

Use the correction issue flow from the term or part page when the corpus needs a public fix. The issue template asks for the term, current analysis, proposed breakdown, proposed meanings, a supporting source, and an explanation.

Keep correction reports public and free of private medical details. If you need a fallback, copy the template from the page and fill it in with public evidence.

## Code quality

- Prefer small, deterministic changes.
- Keep the static architecture intact.
- Lock behavior with tests before refactoring or expanding analysis.
- Do not add server features, API routes, or database dependencies to support the current site.

If you are unsure whether a source or analysis is strong enough, document the ambiguity in the corpus note or source docs instead of inventing certainty.
