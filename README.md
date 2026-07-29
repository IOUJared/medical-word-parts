# Medical Word Parts

Educational note: this is a sourced terminology guide, not medical advice. It helps readers study how public medical terms are built from parts, and it keeps authored evidence visible.

## Architecture

- Next.js App Router with build-time rendering.
- Strict TypeScript and deterministic generated data.
- Tailwind for styling.
- Authored JSON in `data/` is parsed with Zod, then converted into generated modules in `src/generated/`.
- The analyzer runs on the client from pure local data. There is no runtime database or server API.
- Production export is finalized to static HTML in `out/`, with local enhancement bundles for search, analysis, and page behavior.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home, search, and example analysis |
| `/analyze/` | Local term analyzer |
| `/parts/` | Browse the part catalog |
| `/parts/[slug]/` | Part detail page |
| `/term/[slug]/` | Term detail page |
| `/sources/` | Source ledger and provenance |
| `/methodology/` | Editorial and analysis method |

## Prerequisites

- Node.js 22
- npm

## Local setup

```bash
npm install
npm run dev
```

Use `npm ci` when you want a clean, reproducible install that matches CI.

Development runs at `http://localhost:3000/`.

## Validation

Run these checks in this order when the committed generated files are already current:

```bash
npm run data:validate
npm run data:test
npm run browser:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run static:validate
npm run test:e2e
npm run audit:production
```

## Data editing flow

1. Edit the authored JSON in `data/`.
2. Keep `src/generated/` untouched. Those files are derived and start with a generated-file warning.
3. Run `npm run data:build`.
4. Run `npm run data:validate`.
5. Run `npm run data:test`.
6. If the generated output changed, commit the authored `data/` edits plus the regenerated files together.

## Correction flow

Each term and part page links to a GitHub correction issue. The issue form is public and asks for a term, the current analysis, a proposed breakdown, proposed meanings, a supporting source, and an explanation. If a contributor cannot use the form, the page provides a copyable fallback template.

Do not include names, symptoms, record numbers, or other private medical information in a correction.

## Deployment

GitHub Pages is the expected static host, with repository `IOUJared/medical-word-parts` and expected public URL `https://ioujared.github.io/medical-word-parts/`. That URL is an expected target, not a live claim.

Cloudflare Pages is also supported at the canonical target `https://medical-word-parts.pages.dev/medical-word-parts`. See `docs/deployment-cloudflare.md` for the manual workflow and required secrets.

## Static limits

This project does not provide:

- private accounts
- server-saved searches
- a correction database
- secret browser calls
- server-only AI
- a runtime database
- API routes or server actions

If a future version needs Workers, D1, or KV, keep that as a separate server-backed layer. It should not change the core static build.

## Environment variables

Only public build-time values are used.

- `NEXT_PUBLIC_BASE_PATH`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS`

Anything that starts with `NEXT_PUBLIC_` is public by design and becomes part of the built client and metadata output. Do not place secrets there.

`.env.example` shows the local defaults.
