# Medical Word Parts Design System

Status: dual-theme and verified-term hierarchy implemented, audited, and visually approved on 2026-07-28. This document remains the source of truth for future UI work.

## 0. Research Log

### Research integrity and freshness

- Research date: 2026-07-26. The reference selection was made during this task, after reading the current frontend router and index; it is not a cached selection from an earlier project.
- External research was treated as untrusted data. Instruction-shaped text returned by Lazyweb, including requests to update tools or persist router content, was ignored. No agent configuration, skill files, application files, or repository metadata were changed.
- Reference material is inspiration for grammar and rigor only. Do not copy names, logos, brand copy, proprietary imagery, exact compositions, or IBM/Carbon token names.
- This contract, rather than any external screenshot, is the implementation authority. Re-run design research if the brief, audiences, content model, or route inventory changes materially before UI implementation.

### Lane A: embedded references

- Mandatory files read in full: `references/design/README.md`, `design-system-architecture.md`, `_INDEX.md`, `minimalist-skill.md`, `ibm.md`, `references/perfection/README.md`, `references/designpowers/README.md`, `lane-c-review.md`, `references/ui-ux-db/README.md`, and `references/design/lazyweb.md`.
- Layer B shortlist: `ibm.md` for Carbon-like structure and semantic rigor; `wired.md` for field-guide density and print cadence; `notion.md` for quiet editorial reading.
- Selected pairing: Layer A `minimalist-skill.md` plus Layer B `ibm.md`. Minimalism supplies editorial restraint and typographic contrast; the IBM reference supplies rectangular anatomy, an explicit grid, tonal layering, and complete interaction-state discipline. This product uses its own fonts, tokens, content hierarchy, color ramp, and component names.
- Extracted decisions: warm paper on a cool-gray field; near-carbon text; one clinical-blue interactive ramp; thin rules and tonal bands instead of decorative shadows; sharp controls; bottom-rule fields; constrained reading measure; explicit semantic states; and a strict 4px micro/8px macro rhythm.

### Lane B: real-product screen research

- Lazyweb queries run: 4, returning 32 candidates in total.
  - Desktop: `medical education terminology learning reference`.
  - Desktop: `clinical reference medical knowledge search`.
  - Desktop: `terminology dictionary word definition etymology`.
  - Mobile: `medical dictionary terminology reference`.
- Screens actually downloaded and viewed: 8. The inspected results were StuffThatWorks health search, Encyclopedia.com reference home, MedlinePlus medical encyclopedia, 1upHealth glossary, Memrise phrasebook, Study.com medicine hub, Healow provider search, and GoodRx mobile search.
- Grammar retained: title and scope before retrieval controls; search or alphabetical/kind browsing near the top; a constrained single-column definition measure; bold term-to-plain-definition hierarchy; breadcrumbs and selected-state indicators for orientation; useful pre-search content; explicit result, source, and editorial context; full-width mobile controls; and one-column mobile stacking.
- Patterns rejected: generic conversion heroes, promotional card grids, anatomy stock art, tiny legal/footer density, unexplained blank result regions, image-heavy taxonomies, desktop-only horizontal controls, trust claims without item-level provenance, and any copied branding or assets.

### Lane C: UI/UX database

- Commands run: one full design-system query for `medical terminology education reference dictionary clinical editorial trustworthy`, one typography query for `medical reference clinical blue paper typography accessible`, and one UX query for `search filters accessibility keyboard cognitive load`.
- Retained: healthcare/education accessibility priority, 16px minimum body text, 44px targets, visible focus, keyboard order matching visual order, skip navigation, useful no-results recovery, `font-display` discipline, and the academic pairing of an editorial serif with Atkinson Hyperlegible.
- Rejected: the database's generic SaaS hero pattern, pink CTA suggestion, generic sun/moon switch treatment, and any recommendation that conflicts with the field-guide brief or this contract.

### Lane D: concept drafts

- Skipped. No Imagen or equivalent image-generation tool was exposed in this environment, so no concept image was generated and no image is being claimed as a reference-fidelity contract.
- The implementation reference is therefore this written system plus the named research findings. Future concept imagery must not supersede this contract without updating the contract first.

### Direction commitment

The application is a distinctive clinical field guide: a warm paper sheet set into a cool-gray work surface, ruled with carbon-like ink and a narrow clinical-blue keyline. The memorable moment is the morphology rail, where a term becomes an ordered, labeled construction that remains fully understandable in grayscale and with every fill removed.

## 1. Atmosphere, Identity, People, and Principles

### Atmosphere and identity

The experience should feel like opening a carefully edited terminology handbook on a clean clinical worktable: calm, exact, readable, and visibly sourced. It is editorial rather than institutional theater, technical without looking like a dashboard, and serious without imitating an electronic health record. Dense information is allowed when its hierarchy is explicit; decoration is not used to disguise weak structure.

The signature is the **morphology rail**: an ordered construction line of numbered word parts, visible operators, explicit kind labels, notation, meanings, and unresolved spans. Color supports scanning but never carries identity or status alone.

### Situational personas

| Persona | Context and constraint | Primary job | Success signal |
|---|---|---|---|
| First-pass learner | A student encounters an unfamiliar term under time pressure and may not know prefix/root/suffix conventions | Decode the term in a predictable order and understand what is verified versus inferred | Can restate the breakdown and identify unresolved material without guessing |
| Returning reference user | An instructor, editor, or healthcare-adjacent learner knows the concept and needs a fast lookup | Search or browse a term/part, then verify its notation, kind, meaning, and source | Reaches the relevant entry quickly and can cite the listed source |
| Evidence checker | A careful reader questions an analysis or wording | Inspect provenance, methodology, alternatives, and limitations | Can distinguish authored, derived, partial, and unsupported results |
| Correction contributor | A reader has evidence for an amendment but may not understand that GitHub issues are public | Open a prefilled correction path without exposing private medical information | Sees the privacy warning, provides evidence, and understands the public destination |
| Access-needs reader | A user may navigate by keyboard or screen reader, use high zoom, have low color perception, dyslexia, cognitive fatigue, or reduced-motion preferences | Complete every lookup, browse, citation, and correction task without relying on color, fine pointing, or motion | No loss of meaning at 200% zoom, with color removed, or through a linear reading order |

These are design hypotheses, not demographic claims. Validate them with representative users once a real interface exists.

### Jobs to be done

1. Analyze a medical term without presenting a generated breakdown as a verified medical fact.
2. Browse prefixes, roots, suffixes, and combining forms without first knowing the exact spelling.
3. Move from a term to its parts, related terms, methodology, and source record without losing context.
4. Understand unsupported and partially analyzed input, including exactly which characters remain unresolved.
5. Verify provenance and submit an evidence-backed correction through a clearly public external workflow.

### Product principles

1. **Evidence before confidence.** A result names its basis (`Verified entry`, `Constructed from known parts`, `Partial match`, or `Unsupported`) and shows citations where the corpus provides them. Never convert a score into a medical-certainty percentage.
2. **Structure before color.** Labels, order, rules, symbols, text, and semantics carry meaning. Hue is redundant reinforcement.
3. **Field guide, not SaaS funnel.** Lead with the lookup task and a useful example, not a marketing hero, metrics theater, or a three-card feature pitch.
4. **Plain language beside exact notation.** Preserve canonical forms and technical labels, then explain them in short, direct sentences. Do not invent definitions, review dates, or source authority beyond the authored corpus.
5. **Browse is a first-class fallback.** Search, kind filters, alphabetical structure, related entries, and clear recovery paths prevent dead ends.
6. **Calm density.** Group related evidence tightly, separate decisions generously, and progressively disclose alternatives or methodology. Do not hide core provenance.
7. **Static and private by default.** Analysis occurs locally in the static application. Do not add analytics, cookies, accounts, remote search, or persistence as incidental UI features. The sole allowed user preference is the explicit light/dark choice stored under `medical-word-parts:theme`; it contains only `light` or `dark` and is never transmitted.

### Voice and claim boundaries

- Voice: concise, specific, neutral, and editorial. Prefer `This entry is verified in the local corpus` over authority-signaling language.
- Never diagnose, recommend treatment, interpret symptoms, or imply clinical decision support. The persistent boundary is: `For terminology learning and reference; not medical advice.`
- Meanings, forms, aliases, relationships, and source details come from authored data. Missing metadata stays missing; the UI must not fabricate author, review, publication, or update information.
- Derived and partial results explain their computational basis. Unsupported input receives a reason and recovery path, never an invented meaning.
- No anatomy stock art, decorative clinical photography, medical-cross branding, copied institutional seals, or emoji icons.

## 2. Color and Semantic Tokens

The field-guide system has complete light and dark palettes. Dark mode preserves the same tonal-paper hierarchy using a cool near-black field, warm charcoal paper, carbon-light text, and a brighter clinical-blue keyline. Raw color values may appear only in this contract and the token definition; components consume semantic tokens.

### Core palette

| Role | Token | Light | Dark | Usage |
|---|---|---:|---:|---|
| Field | `--color-field` | `#F1F4F3` | `#101416` | Cool work-surface viewport and wide section field |
| Paper | `--color-paper` | `#FCFCF8` | `#171C1F` | Primary reading surface |
| Paper strong | `--color-paper-strong` | `#FFFFFF` | `#20272B` | Inputs and the highest local contrast surface; on-action text in dark mode |
| Layer subtle | `--color-layer-subtle` | `#E7ECEB` | `#252D31` | Inset reference bands, neutral notices |
| Layer selected | `--color-layer-selected` | `#DCEEF5` | `#183847` | Selected or focused informational region, never sole indicator |
| Ink | `--color-ink` | `#171A1E` | `#F1F3ED` | Primary text and strong rules |
| Ink secondary | `--color-ink-secondary` | `#37434B` | `#CED6D2` | Explanations and metadata |
| Ink muted | `--color-ink-muted` | `#59666D` | `#AEBBB6` | Hints and nonessential labels |
| Ink disabled | `--color-ink-disabled` | `#7A858A` | `#87938E` | Disabled text only; never required content |
| Rule subtle | `--color-rule-subtle` | `#CBD3D3` | `#465155` | Dividers and passive boundaries |
| Rule strong | `--color-rule-strong` | `#7C898D` | `#7E8A8D` | Active structural rules and morphology boundaries |
| Scrim | `--color-scrim` | `#171A1ECC` | `#000000CC` | Mobile navigation backdrop only |
| Footer surface | `--color-footer-bg` | `#171A1E` | `#101416` | Persistent scope and navigation footer |
| Footer ink | `--color-footer-ink` | `#FCFCF8` | `#F1F3ED` | Footer text and links |

### Clinical blue ramp

| Role | Token | Light | Dark | Usage |
|---|---|---:|---:|---|
| Blue tint | `--color-blue-100` | `#DCEEF5` | `#173844` | Informational/selected background |
| Blue line | `--color-blue-400` | `#55A7C1` | `#68B8D0` | Non-text keyline; never the only state cue |
| Blue primary | `--color-blue-700` | `#005A82` | `#72C7E3` | Links, primary actions, active indicators |
| Blue hover | `--color-blue-800` | `#004667` | `#98D9ED` | Hover |
| Blue active | `--color-blue-900` | `#00344D` | `#BCE9F6` | Pressed and strong focus contrast |
| Focus | `--color-focus` | `#00739D` | `#70D2F2` | External focus ring, paired with paper inner gap |

### Status palette

Every status combines a written label, a structural marker, and the color pair below.

| Status | Foreground token: light / dark | Background token: light / dark | Marker and wording |
|---|---|---|---|
| Success/verified | `--color-success-ink: #27613D / #91D7A8` | `--color-success-bg: #E4F1E6 / #173524` | Check mark SVG plus `Verified entry` |
| Warning/partial | `--color-warning-ink: #6B5000 / #F2CF78` | `--color-warning-bg: #FFF1B8 / #3A2F12` | Triangle SVG plus `Partial match` |
| Error/unsupported | `--color-error-ink: #962F2B / #F0A29D` | `--color-error-bg: #FBE6E4 / #3D2021` | Octagonal alert SVG plus reason |
| Information/derived | `--color-info-ink: #005A82 / #85D2EA` | `--color-info-bg: #DCEEF5 / #173744` | Information SVG plus `Constructed from known parts` |

### Morphology palette

These colors are optional scanning aids. The kind code, ordinal, edge rule, and text label are mandatory.

| Kind | Ink token: light / dark | Fill token: light / dark | Non-color cue |
|---|---|---|---|
| Prefix | `--color-prefix-ink: #005A82 / #85D2EA` | `--color-prefix-bg: #E1F0F5 / #173744` | `PRE` label and leading rule |
| Root | `--color-root-ink: #315D43 / #A2D7AE` | `--color-root-bg: #E4EFE6 / #1D3526` | `ROOT` label and double top rule |
| Combining form | `--color-combining-ink: #2D5F63 / #9AD6D4` | `--color-combining-bg: #DFEEEE / #1B3435` | `C/F` label and diagonal edge hatch |
| Suffix | `--color-suffix-ink: #66501D / #E4C98A` | `--color-suffix-bg: #F3ECD6 / #382F1D` | `SUF` label and trailing rule |
| Unresolved | `--color-unresolved-ink: #962F2B / #F0A29D` | `--color-unresolved-bg: #FBE6E4 / #3D2021` | `? UNRESOLVED` label and crosshatch edge |

### Color rules

- Body and UI text must meet WCAG 2.2 AA: at least 4.5:1; large text and meaningful non-text UI boundaries at least 3:1. Validate actual pairs in the browser rather than assuming token intent guarantees contrast.
- Interactive blue is reserved for links, focus, actions, selected controls, and information status. It is not decorative section color.
- Status red, green, amber, and blue never replace the visible status label or marker.
- `:visited` links retain ink legibility and add a dotted underline pattern; visited state is not encoded by a low-contrast hue.
- Disabled appearance is supported by semantics, text, and cursor behavior, not opacity alone. Required content is never disabled-colored.
- High-contrast/forced-colors mode preserves native system colors, borders, underlines, and focus; morphology fills may disappear without loss of information.

### Theme state machine and first paint

- The only persisted user state is `localStorage["medical-word-parts:theme"]`. The parser accepts exactly `light` or `dark`; every other value is invalid and behaves as no explicit choice. No cookie, query parameter, server state, analytics event, or second storage key represents theme.
- With no valid explicit choice, CSS and the wired control follow `prefers-color-scheme`. A live system-preference change updates the page only while this automatic state remains active.
- A valid explicit choice overrides the system preference across every route and reload. Activating `Dark mode` toggles the effective theme, creates the explicit choice, updates `html[data-theme]`, persists when storage is available, and synchronizes `aria-pressed` immediately.
- The local classic `/generated/theme.js` bootstrap is parser-blocking in `head` and executes before body paint. It safely reads the persisted value and sets `html[data-theme]` only for a valid explicit choice. It contains no React, remote request, inline executable, source map, arbitrary delay, or feature behavior beyond first-paint theme selection.
- The existing deferred `/generated/site.js` owns control wiring. It reveals the initially hidden control only after listeners, effective state, and `aria-pressed` are synchronized. Storage read/write failure leaves system fallback intact on load; the wired control still changes the current document without throwing.
- Without JavaScript, the control remains hidden and no `data-theme` attribute is required. `color-scheme: light dark` plus `prefers-color-scheme` selects the complete token palette, including native control colors.
- Explicit `html[data-theme="light"]` and `html[data-theme="dark"]` rules override system preference. Theme selection is immediate: no broad theme transition, crossfade, view transition, animated color, or shadow is permitted. Reduced-motion mode therefore receives the same immediate state without a special delayed path.
- `html` may use `suppressHydrationWarning` solely because the pre-paint bootstrap can set `data-theme` before development hydration. No content, label, or subtree differs between server markup and hydration.

Reference contrast calculations for the declared pairs:

| Pair | Calculated contrast | Contract role |
|---|---:|---|
| Ink / paper | 16.97:1 | Primary text |
| Secondary ink / paper | 9.88:1 | Body metadata |
| Muted ink / paper | 5.76:1 | Supplemental text |
| White / blue primary | 7.54:1 | Primary button text |
| Blue primary / paper | 7.33:1 | Links |
| Focus / paper | 5.18:1 | Focus ring |
| Success ink / success background | 6.29:1 | Verified status |
| Warning ink / warning background | 6.68:1 | Partial status |
| Error ink / error background | 6.41:1 | Unsupported status |
| Prefix, root, combining-form, and suffix inks / respective fills | 6.01:1 minimum | Morphology text |
| Strong rule / paper | 3.51:1 | Meaningful non-text boundary |
| Footer ink / footer surface | 16.97:1 | Footer text and links |

`--color-rule-subtle` is decorative grouping only and is not permitted to carry a meaningful boundary or state. Recalculate contrast in the rendered browser after font rasterization, forced-colors handling, or token changes.

Dark-palette contrast calculations:

| Pair | Calculated contrast | Contract role |
|---|---:|---|
| Ink / paper | 15.37:1 | Primary text |
| Secondary ink / paper | 11.60:1 | Body metadata |
| Muted ink / paper | 8.66:1 | Supplemental text |
| Paper strong / blue primary | 7.93:1 | Primary button text |
| Blue primary / paper | 8.99:1 | Links |
| Focus / paper | 9.97:1 | Focus ring |
| Success ink / success background | 7.95:1 | Verified status |
| Warning ink / warning background | 8.76:1 | Partial status |
| Error ink / error background | 7.26:1 | Unsupported status |
| Information ink / information background | 7.44:1 | Derived status |
| Prefix, root, combining-form, suffix, and unresolved inks / respective fills | 7.26:1 minimum | Morphology text |
| Strong rule / paper | 4.83:1 | Meaningful non-text boundary |
| Footer ink / footer surface | 16.57:1 | Footer text and links |

Both palettes exceed WCAG 2.2 AA for every required text, focus, status, morphology, and meaningful-boundary pairing. There is no accepted dark-theme contrast debt.

## 3. Typography

### Font families

- Editorial/display: `Crimson Pro Variable`, `Georgia`, serif. It gives headings and term forms a scholarly field-guide voice without borrowing IBM branding.
- Body/UI: `Atkinson Hyperlegible`, `Verdana`, sans-serif. It carries paragraphs, controls, labels, metadata, and notation for legibility under zoom and character ambiguity.
- Two families only. There is no decorative or monospace third family; notation gains distinction through weight, rules, and spacing rather than another font payload.
- Self-host authored-glyph WOFF2 subsets only: Atkinson Hyperlegible 400/700 and Crimson Pro variable 500–600. Use `font-display: swap`; preload all three compact faces so the complete field-guide typography is available before first paint without layout shift. No remote font CSS at runtime.

### Type scale

| Role | Token | Size | Family/weight | Line height | Tracking | Usage |
|---|---|---:|---|---:|---:|---|
| Field-guide display | `--type-display` | `clamp(2.5rem, 6vw, 4rem)` | Crimson Pro 500 | 1.02 | `-0.025em` | Home title only; never a generic hero slogan |
| Term display | `--type-term` | `clamp(2.25rem, 5vw, 3.5rem)` | Crimson Pro 600 | 1.05 | `-0.02em` | Canonical term or part notation |
| H1 | `--type-h1` | `clamp(2rem, 4vw, 2.75rem)` | Crimson Pro 600 | 1.1 | `-0.015em` | Page title |
| H2 | `--type-h2` | `1.875rem` | Crimson Pro 600 | 1.2 | `-0.01em` | Major section |
| H3 | `--type-h3` | `1.375rem` | Atkinson Hyperlegible 700 | 1.3 | `0` | Subsection/card title |
| Lead | `--type-lead` | `1.125rem` | Atkinson Hyperlegible 400 | 1.55 | `0` | Scope and short introductions |
| Body | `--type-body` | `1rem` | Atkinson Hyperlegible 400 | 1.625 | `0` | Default reading text and inputs |
| Body strong | `--type-body-strong` | `1rem` | Atkinson Hyperlegible 700 | 1.5 | `0` | Term labels and emphasis |
| Small | `--type-small` | `0.875rem` | Atkinson Hyperlegible 400 | 1.5 | `0.01em` | Metadata and helper text |
| Label | `--type-label` | `0.75rem` | Atkinson Hyperlegible 700 | 1.35 | `0.06em` | Uppercase kind/status labels only |

### Typography rules

- Body and input text never render below 16px. Small and label roles are supplemental only and never contain essential standalone meaning.
- Long-form measure is `--measure-reading: 68ch`; compact definitions use `--measure-compact: 56ch`. Mobile paragraphs target roughly 35–60 characters per line.
- Headings wrap naturally; never truncate headings, terms, part forms, meanings, source titles, or error explanations.
- Keep one `h1` per page and preserve sequential headings. Visual size may differ from semantic rank without changing document order.
- Use sentence case. Uppercase is limited to short `PRE`, `ROOT`, `C/F`, `SUF`, status, and navigation-overline labels.
- Underlines are real text decorations with offset and thickness; do not fake them with background gradients.
- Medical strings use `overflow-wrap: anywhere` only as a last-resort browser mechanic. Preserve authored hyphens and slashes; never insert semantic punctuation for layout.

## 4. Spacing, Layout, and Page Content Hierarchy

### Spacing, sizing, and layer tokens

The base unit is 4px, with 8px as the dominant macro rhythm.

| Token | Value | Intent |
|---|---:|---|
| `--space-1` | `0.25rem` | Micro separation |
| `--space-2` | `0.5rem` | Inline/icon-label gap |
| `--space-3` | `0.75rem` | Compact inset |
| `--space-4` | `1rem` | Mobile gutter/control inset |
| `--space-5` | `1.25rem` | Comfortable text grouping |
| `--space-6` | `1.5rem` | Standard component/column gap |
| `--space-8` | `2rem` | Tablet gutter/content group |
| `--space-10` | `2.5rem` | Section subsection gap |
| `--space-12` | `3rem` | Major section transition |
| `--space-16` | `4rem` | Page block separation |
| `--space-20` | `5rem` | Desktop opening space |
| `--space-24` | `6rem` | Maximum editorial separation |

| Role | Token | Value |
|---|---|---:|
| Minimum target | `--size-target-min` | `2.75rem` |
| Control regular | `--size-control` | `3rem` |
| Control large | `--size-control-lg` | `3.5rem` |
| Icon small | `--size-icon-sm` | `1rem` |
| Icon regular | `--size-icon-md` | `1.25rem` |
| Icon large | `--size-icon-lg` | `1.5rem` |
| Analyzer loading reserve | `--size-analyzer-reserve` | `52rem` |
| Reading measure | `--measure-reading` | `68ch` |
| Compact measure | `--measure-compact` | `56ch` |
| Content maximum | `--layout-max` | `78rem` |
| Paper maximum | `--layout-paper-max` | `72rem` |

| Role | Token | Value | Rule |
|---|---|---:|---|
| Radius none | `--radius-none` | `0` | Rails, tiles, dividers |
| Radius fine | `--radius-fine` | `0.125rem` | Inputs and buttons |
| Radius small | `--radius-small` | `0.25rem` | Notices and compact groups |
| Radius medium | `--radius-medium` | `0.5rem` | Maximum allowed on a paper panel |
| Rule hairline | `--rule-hairline` | `0.0625rem` | Passive separation |
| Rule active | `--rule-active` | `0.125rem` | Selected/focused edge |
| Rule focus | `--rule-focus` | `0.1875rem` | Keyboard focus ring |
| Layer base | `--layer-base` | `0` | Document |
| Layer sticky | `--layer-sticky` | `10` | Reserved; no sticky element by default |
| Layer menu | `--layer-menu` | `30` | Mobile nav/disclosure |
| Layer overlay | `--layer-overlay` | `50` | Dialog/scrim if later required |

### Grid and spatial grammar

- Mobile-first document scroll. The page owns vertical scroll; avoid nested scrolling regions.
- At 1280px, use a 12-column grid inside `--layout-max`, `--space-6` gutters, and `--space-8` outer margins. The paper reading surface spans 9–10 columns; utility rails may occupy the remainder.
- At 768px, use an 8-column grid with `--space-6` outer gutters and `--space-5` column gaps. Evidence and related-content columns may sit side by side only when each preserves readable measure.
- At 375px, use one column and `--space-4` gutters. Controls, morphology, source records, filters, and footer groups stack without horizontal scrolling.
- The paper surface is asymmetrically anchored at desktop: a narrow clinical-blue keyline and metadata rail occupy the leading edge while reading content remains centered to its own measure. On mobile the keyline becomes a top rule and metadata enters normal flow.
- Prefer native document flow, `minmax()`, `clamp()`, intrinsic sizing, and container queries as browser mechanics. Do not create tokens for `auto`, percentages, viewport units, or intrinsic keywords.
- Major content is never hidden at a breakpoint. Secondary evidence may move into a labeled disclosure, but the status basis, unresolved spans, citations, and correction warning remain available.
- Global routes below are conceptual paths mounted under `NEXT_PUBLIC_BASE_PATH` (`/medical-word-parts/` in GitHub Pages production). Future links must use the project base-path helper; do not hardcode root-relative URLs.

### Global shell hierarchy

1. Skip link (`Skip to main content`).
2. Masthead: wordmark as text, primary navigation (`Analyze`, `Word parts`, `Sources`, `Methodology`), the fixed-label `Dark mode` button, and compact search access.
3. Optional breadcrumb on nested/reference routes.
4. One `main` landmark with page title and scope.
5. Route-specific content in the decision order below.
6. Footer: scope boundary, source/methodology links, correction guidance, and no promotional sitemap wall.

The masthead is not sticky by default. It must not consume reading space at 200% zoom. At narrow widths it becomes a text-labeled `Menu` disclosure, not an icon-only hamburger.

### Route content inventory and decision order

| Route | Content order | Job of each block |
|---|---|---|
| `/` | Field-guide title and scope → analyzer search → morphology rail example → browse-by-kind index → evidence/method links | **Hook:** identify the reference. **Convert:** start lookup. **Explain/prove:** show the signature grammar without making a medical claim. **Navigate:** browse parts. **Retain trust:** expose sources/methodology and correction route. |
| `/analyze/` | Page title/boundary → labeled term input → result status → morphology rail → segment explanations → alternatives/unresolved detail → citations → correction action | **Orient:** state local analysis limits. **Act:** submit. **Explain:** show basis and construction. **Compare:** alternatives only after primary result. **Prove:** cite. **Correct:** public evidence path. |
| `/term/[slug]/` | Canonical term section with visible `Verified corpus entry` → primary morphology rail → breadcrumb → full verified status → authored note → primary qualification when present → alternative analyses → related parts/terms → source ledger → correction | **Orient:** begin with the canonical word. **Explain:** expose every authored notation, surface, and meaning immediately in canonical order. **Prove:** retain full status and authored context after the rail. **Navigate:** related entries. **Audit/correct:** provenance and amendment. |
| `/parts/` | Title/scope → search → kind filters + result count → grouped/alphabetical part list → no-results recovery → methodology link | **Orient:** define the collection. **Find:** search/filter. **Compare:** scan notation, kind, meaning. **Recover:** reset filters or analyze a term. **Prove:** explain taxonomy. |
| `/parts/[slug]/` | Breadcrumb → notation + explicit kind label → meaning → known surfaces/transformation note → example terms → source ledger → correction | **Orient:** identify the part. **Explain:** notation and authored meaning. **Prove:** show usage and provenance. **Navigate/correct:** examples and public correction. |
| `/sources/` | Title/scope → how citations work → source records → external-link/privacy note → methodology link | **Orient:** explain what a listed source does and does not prove. **Audit:** publisher/title/URL exactly as authored. **Navigate:** open external source knowingly. **Explain:** methodology. |
| `/methodology/` | Scope/not-medical-advice boundary → corpus model → verified/derived/partial/unsupported basis → segmentation/transformation method → citations/limitations → correction process → privacy | **Orient:** set limits. **Explain:** system behavior. **Compare:** result bases. **Prove:** data and source rules. **Correct:** contribution path. **Retain trust:** privacy and known limitations. |
| `404` | `404` status → plain-language message → search/analyze field → links to word parts, methodology, and home | **Explain:** path unavailable. **Recover:** search or navigate. Never imply the medical term itself is invalid merely because a route is absent. |

### Content stress rules

- Test empty strings, longest authored term/form/title/meaning, long URLs, multiple alternatives, one unresolved character, an entirely unsupported token, and 200% text zoom.
- Lists wrap; they do not clip or silently ellipsize authored medical/reference content.
- At 375px, all primary content reflows to one column with no viewport-level horizontal scroll. Morphology never requires a horizontal swipe.
- External source URLs may wrap, but the visible link label should be the authored source title or host, not an unbroken raw URL when avoidable.
- On term pages the canonical opening and primary morphology rail are the first two direct children of the reading sheet. Their separation is `--space-8`; all provenance and navigation blocks after the rail return to the standard `--space-16` page rhythm.

## 5. Primitives and States

Future implementation starts with a development-only primitive showcase. It must exercise every state below at 375px, 768px, and 1280px before product routes are composed. The showcase is not part of the exported public route inventory.

### State language shared by all interactive primitives

- **Default:** clear affordance through label, underline/rule, shape, or native control anatomy.
- **Hover:** pointer-only enhancement using a tonal or underline change; no information appears only on hover.
- **Active/pressed:** immediate stronger tone/rule plus `transform: translateY(var(--motion-press-shift))`; layout bounds stay fixed.
- **Focus-visible:** `--rule-focus` outer `--color-focus` ring with a paper-colored inner gap. It is never removed and never color-only: underline/rule/outline also changes.
- **Disabled:** native `disabled`/`aria-disabled` semantics, explicit unavailable styling, no pointer event, and no required task blocked without explanation.
- **Loading/pending:** reserve geometry, retain the action label, add concise status text, and announce politely. Because this application is static/local, a loading state must not be introduced merely for spectacle.
- **Empty/error:** plain-language reason plus one recovery action. Never render a blank panel.

### SiteNav

- **Structure:** `header > nav[aria-label="Primary"] > home link + route list + search link`; mobile uses a labeled disclosure button and one menu region.
- **Variants:** desktop horizontal, tablet wrapped, mobile disclosed.
- **Spacing/layout:** cluster using `--space-4` and `--space-6`; rows at least `--size-target-min`; document remains the scroll owner.
- **States:** default; hover underline; active route uses `aria-current="page"`, `--rule-active` bottom rule, and stronger weight; focus-visible ring; mobile closed/open with `aria-expanded`; disabled is not used for navigation destinations.
- **Accessibility:** text labels are mandatory; opening moves focus only when necessary, closing returns it to the trigger, `Escape` closes, and route change places focus on `main`/`h1`.
- **Motion:** menu opacity/transform only, standard duration; no motion under reduced-motion.

### TextLink and InlineAction

- **Structure:** native `a` for navigation/external destinations; native `button` for in-page actions.
- **Variants:** inline, standalone, back/breadcrumb, external.
- **States:** default underline for body links; hover thicker underline and blue-hover; active blue-active; focus-visible outlined; visited gains dotted underline; external includes visible `External link` text or a labeled SVG plus accessible name; disabled links are rendered as explanatory text, not inert anchors.
- **Accessibility:** purpose must be understandable from link text and nearby context. No `click here`. New-tab behavior is disclosed in visible and accessible text.
- **Motion:** none beyond immediate state styling.

### Button

- **Structure:** native `button` with text label and optional Phosphor icon after the label.
- **Variants:** primary clinical blue, secondary carbon, quiet text, danger only for a genuinely destructive future action.
- **Spacing/layout:** minimum `--size-control`; asymmetric trailing space is allowed only when an icon occupies it; radius `--radius-fine`.
- **States:** default, hover, pressed, focus-visible, disabled, loading with retained label, success acknowledgement with text, and error with adjacent recovery text.
- **Accessibility:** min 44×44px, no icon-only primary actions, loading exposes `aria-busy` without repeatedly announcing progress.
- **Motion:** micro press transform only.

### ThemeToggle

- **Structure:** exactly one native `<button type="button">` in `AppShell`, with the permanently visible label `Dark mode`, initial server state `inert` and `aria-pressed="false"`, and a stable `data-theme-toggle` hook. No icon, switch facsimile, client component, or duplicated mobile control is permitted.
- **State machine:** `aria-pressed="true"` means dark is the effective theme; `false` means light. Wiring resolves a valid explicit choice first and system preference second, synchronizes the pressed state, installs native click/system listeners, and only then removes `inert`.
- **Layout:** minimum block and inline target is `--size-target-min` (44px). It stays in the masthead utility cluster at every breakpoint without shortening its fixed label or displacing the text-labeled mobile menu.
- **Interaction:** native `Enter` and `Space` activation are retained. Click toggles the effective theme and establishes the explicit stored choice. A system-preference change updates automatic mode only and never overwrites an explicit choice.
- **Focus and contrast:** focus-visible uses the global `--rule-focus`/`--color-focus` outline and offset. Default, pressed, focus, and both theme palettes retain a visible rule and text label; color is not the only state cue because `aria-pressed` carries programmatic state.
- **Forced colors:** use `ButtonFace`, `ButtonText`, and a `currentColor` border; remain visible and operable when author colors and morphology fills are removed.
- **No JavaScript:** the button stays visually and accessibility-tree hidden, while CSS follows the system theme. Its exact intrinsic geometry is reserved in the masthead so successful wiring changes only visibility and creates no layout shift; it never creates an empty focus stop.
- **Motion and material:** theme changes have no transition. The control has no shadow, glow, gradient, icon rotation, crossfade, or decorative animation. The global micro press transform is the only pointer feedback and is removed under reduced motion.

### SearchField and AnalyzerForm

- **Structure:** `form[role="search"] > label + helper + input[type="search"] + clear button + submit button + message region`.
- **Variants:** compact global search, full analyzer, collection filter.
- **Anatomy:** `--color-paper-strong` field on `--color-layer-subtle`, `--rule-active` bottom rule, visible persistent label, `--type-body` input text, no placeholder-only labeling.
- **States:** empty with example/helper; hover with strong bottom rule; focus with focus ring and active rule; has-value with 44px clear action; valid ready state; submitting/pending only if work exceeds perceptual immediacy; unsupported/invalid with reason adjacent to input; suggestions open with result count; no results with spelling/browse/reset options; internal error with retry and methodology link; disabled only with a visible reason.
- **Keyboard:** `Enter` submits; `Escape` closes suggestions/clears only when behavior is announced; arrow keys operate a real ARIA combobox only if suggestions are implemented. Do not apply combobox roles to a plain form.
- **Screen reader:** result count uses a polite live region after user action; error uses an alert; focus moves to the result heading after submit while preserving a predictable return path.
- **Privacy:** helper text states not to enter names, symptoms, or private medical details. Search history, recent terms, telemetry, and remote autocomplete are out of scope.

### FilterSet

- **Structure:** `fieldset > legend + native checkboxes` or pressed buttons with accurate `aria-pressed`; use one approach consistently.
- **Variants:** kind (`Term`, `Prefix`, `Root`, `Suffix`, `Combining form`) and alphabetical index if corpus scale warrants it.
- **States:** unselected; hover; selected with checkmark, weight, and `--rule-active` in addition to blue tint; focus-visible; disabled with reason; all-selected/reset; no-results with visible count and `Clear filters` action.
- **Responsive:** wraps into rows at 768/1280 and stacks or uses a labeled disclosure at 375. Never require horizontal scrolling.
- **Motion:** result replacement may crossfade with standard duration; counts update immediately and politely.

### MorphologyRail

- **Structure:** a heading and basis label followed by an ordered list. Each `MorphologySegment` contains ordinal, kind code and full kind name, authored notation/surface, meaning, transformation note when present, and citation links. Visible `+` operators separate resolved parts; an arrow leads to the reconstructed term. The accessible name reads the same order in plain language.
- **Variants:** verified, derived, partial, alternative, and compact example. `Unsupported` replaces the rail with a status panel rather than drawing a false construction.
- **Segment non-color anatomy:**
  - Prefix: ordinal + `PRE / Prefix`, leading `--rule-active` rule.
  - Root: ordinal + `ROOT / Root`, double `--rule-hairline` top rule.
  - Combining form: ordinal + `C/F / Combining form`, diagonal hatch edge and visible slash notation.
  - Suffix: ordinal + `SUF / Suffix`, trailing `--rule-active` rule.
  - Unresolved span: ordinal + `? / Unresolved`, crosshatch edge and literal unresolved characters.
- **States:** default; linked segment hover underline; focus-visible outline; current/selected segment adds `Current` text and active rule; derived displays information status; partial leaves unresolved spans in sequence; alternative is collapsed behind a labeled disclosure; empty is impossible for a valid result and becomes an internal-error status; unsupported never invents segments.
- **Responsive:** horizontal ordered construction only when all segments fit naturally. At 375 and under content stress, it becomes a vertical ledger with operators in their own rows. It never horizontally scrolls or truncates.
- **Motion:** after analysis, segments may enter together with a single standard opacity/translate transition; no stagger. Reduced motion renders the final state immediately.
- **Accessibility:** `<ol>` order is canonical; decorative hatch is hidden from accessibility APIs; kinds and unresolved status are text; the reconstruction has a complete text summary before any visual rail.

### ReferenceEntry

- **Structure:** source identifier, publisher, authored title, external link, and `Used for` relationships where available from data.
- **Variants:** source-list record, compact related source.
- **States:** default; hover/active/focus on the link; visited pattern; missing optional metadata is omitted rather than replaced with invented text; invalid/missing URL becomes an error status during build and must not ship as an inert card; empty source collections are build errors for citeable entries.
- **Accessibility:** source title is the link label; destination host and new-tab behavior are visible; long text wraps.
- **Motion:** none.

### CitationLink and CitationLedger

- **Structure:** visible source chips adjacent to the supported statement and an ordered source ledger below. Chips use labels such as `Source 1`, not color-coded dots or hover-only superscripts.
- **States:** default underlined; hover; active; focus-visible; visited dotted underline; target citation uses a strong leading rule and `Selected source` text; missing citation is an authored-data/build error; multiple citations preserve authored order.
- **Target size:** standalone source chips meet 44×44px. Avoid tiny inline citation controls; if an inline text-link exception is unavoidable, preserve generous line height and provide the same target in the nearby source chip group.
- **Screen reader:** links announce source number and title; in-page jumps move focus to the source heading without trapping the reader.
- **Motion:** target emphasis is immediate; no pulsing or decorative highlight animation.

### StatusPanel

- **Structure:** semantic heading/label, SVG marker, concise message, optional details, and one recovery action.
- **Variants:** verified/success, derived/info, partial/warning, unsupported/error, neutral/empty, privacy notice.
- **States:** static default; details collapsed/expanded; focus-visible on disclosure/action; dismissible only for nonessential transient notices; error recovery; loading/pending when real work exists.
- **Semantics:** routine status uses `role="status"` after an action; blocking error uses `role="alert"`; persistent explanatory panels receive no live role on initial page load.
- **Motion:** disclosure opacity/transform only; reduced motion immediate.

### CorrectionFlow

- **Structure:** correction introduction → persistent public-issue/privacy warning → `Propose a correction on GitHub` external link → copyable fallback template.
- **States:** default; hover/active/focus; external destination disclosed; preparing state only while constructing the URL; ready; copied fallback with polite acknowledgement; copy failure with selectable plain text and instructions; unavailable external link with fallback still visible.
- **Content:** prefill term/part, current analysis, proposed change fields, and evidence request. Never prefill user-entered private text. State that GitHub issues are public and prohibit names, symptoms, record numbers, or other private medical information.
- **Accessibility:** warning precedes the external action in reading and focus order; copy status does not steal focus; all text remains selectable.
- **Motion:** micro press only; no celebratory animation.

### Icons and visual assets

- Prefer text labels and typographic marks. Where an icon materially improves scanning, use Phosphor Regular from one consistent set at the declared icon tokens, with accessible text for any nondecorative meaning.
- SVG stroke/fill follows semantic color tokens. Decorative SVGs use `aria-hidden="true"`; meaningful icons are never the sole accessible label.
- The locally served app icon uses the paper, ink, blue-line, and blue-primary palette values directly because standalone favicon SVGs cannot inherit document custom properties.
- No emoji, copied brand marks, generic anatomy diagrams, stock medical photography, faux medical seals, gradients, glass, or illustrative dashboard charts.

## 6. Responsive Behavior, Motion, and Interaction

### Responsive contract

| Viewport | Layout contract | Navigation | Morphology and evidence |
|---|---|---|---|
| 375px | One column, `--space-4` gutters, paper fills available width, 35–60 character reading lines | Text-labeled menu disclosure; no icon-only navigation; all rows at least `--size-target-min` | Vertical morphology ledger; filters stack/disclose; citations and source records stack; no horizontal overflow |
| 768px | Eight-column grid, `--space-6` outer gutters, `--space-5` gaps; reading content spans 6–8 columns | Wrapped or compact horizontal nav when it fits; disclosure remains acceptable | Rail may be horizontal only after fit test; two-column evidence only when each column keeps readable measure |
| 1280px | Twelve-column grid inside `--layout-max`, `--space-8` outer margins, `--space-6` gutters; asymmetric metadata rail | Full horizontal nav | Morphology may run horizontally; source ledger can use a narrow metadata column plus reading column |

- Breakpoints respond to content fit, not device names. The three widths above are mandatory QA evidence points.
- At 200% browser zoom, the interface must reflow without loss of content/function and without two-dimensional scrolling. Treat the effective layout as narrow, even on a desktop monitor.
- Support portrait and landscape. Do not lock orientation, disable pinch zoom, or use fixed-height content regions.
- Use `min-block-size: 100dvh` only where a full-page shell requires it; never `100vh` or a fixed viewport height for content.
- Preserve browser back behavior, URL deep links, query state, and scroll restoration. A direct refresh under `/medical-word-parts/` must retain usable layout and assets.

### Motion tokens

| Type | Token | Duration | Easing | Use |
|---|---|---:|---|---|
| Immediate | `--motion-immediate` | `0ms` | none | Text/status/rule changes where delay harms clarity |
| Micro | `--motion-micro` | `120ms` | `cubic-bezier(0.2, 0, 0, 1)` | Press feedback and focus-adjacent transform |
| Standard | `--motion-standard` | `180ms` | `cubic-bezier(0.2, 0, 0, 1)` | Disclosure/menu/rail result entry |
| Exit | `--motion-exit` | `120ms` | `cubic-bezier(0.4, 0, 1, 1)` | Closing a disclosure/menu |

`--motion-press-shift` is `0.0625rem`. It is the only permitted pressed-state translation distance.

### Motion rules

- Motion explains a state change or spatial relationship. There are no scroll reveals, ambient blobs, parallax, pulsing status, decorative stagger, or automatic carousels.
- Animate only `transform`, `opacity`, or `filter`; never layout properties. Tonal, border, and text state changes may be immediate.
- Transitions are interruptible and never block input. `will-change` exists only during an active transition.
- Under `prefers-reduced-motion: reduce`, set motion durations to immediate, disable smooth scrolling and transforms, and preserve every final state and focus move.
- Hover is an enhancement. Touch and keyboard users receive the same content and state information through focus, labels, and pressed/selected semantics.

### Interaction and feedback rules

- All controls meet a 44×44px minimum target with at least 8px between adjacent targets where practical.
- Preserve native keyboard conventions. `Tab` follows DOM/visual order; `Enter` submits/activates; `Space` toggles buttons/checkboxes; `Escape` closes only the current transient layer.
- Validation occurs after submit or blur, not on every keystroke. Error messages state what happened and how to recover.
- Results render in stable reserved flow so status changes do not jump controls away from the pointer or focus.
- No action relies on drag, swipe, long press, precise pointing, or hover.

## 7. Depth, Surface, and Material

### Strategy: tonal paper plus rules

Depth comes from material zoning, not simulated elevation. The cool-gray field holds a warm paper reading surface; inset evidence bands use a cooler gray; selected information uses a pale blue wash. A narrow blue keyline and carbon rules establish the field-guide grid.

### Surface recipe

| Level | Tokens/treatment | Use |
|---|---|---|
| Field | `--color-field` | Viewport and full-width utility bands |
| Paper | `--color-paper` + leading blue keyline | Main reading sheet and page sections |
| Paper strong | `--color-paper-strong` | Inputs and local high-contrast cells |
| Inset | `--color-layer-subtle` + strong leading rule | Method notes, source ledgers, neutral states |
| Selected/info | `--color-layer-selected` + active rule + visible text label | Current filter, source target, derived status |
| Overlay | `--color-paper-strong` + `--rule-active` ink rule + `--color-scrim` | Mobile menu/dialog only if it truly overlaps content |

### Depth constraints

- No decorative `box-shadow` token exists. Cards, tiles, morphology segments, buttons, hover states, and paper surfaces have no shadow.
- Overlays are separated by scrim and strong rules, not drop shadows or blur.
- No gradients, glassmorphism, translucent cards, glow, bevel, skeuomorphic notebook chrome, or animated grain.
- Radii stay within the declared scale. Large rounded rectangles and pill-shaped primary buttons are forbidden. Status/kind labels use small rectangular tabs, not pills.
- Thin rules must remain visible in high contrast and at zoom. Decorative rules are hidden from screen readers; meaningful boundaries have semantic grouping.
- The paper/cool-gray contrast and alternating bands should be perceivable but never substitute for headings, landmarks, or group labels.
- Theme switching preserves this strategy exactly. Dark mode is not a flat black recolor: field, paper, paper-strong, inset, selected, footer, and overlay remain distinct semantic zones, with no new shadow, gradient, translucency, or blur.

## 8. Accessibility, Privacy, Validation, and Accepted Debt

### Accessibility constraints

- Target WCAG 2.2 AA across all routes, states, and breakpoints. Accessibility outranks aesthetic fidelity when they conflict.
- Text contrast: at least 4.5:1 for normal text and 3:1 for large text. Non-text controls, focus, morphology boundaries, and status markers: at least 3:1 against adjacent colors.
- Every interactive element has visible keyboard focus, correct native semantics, an accessible name, and a predictable reading/focus order.
- Include skip navigation, semantic landmarks, one `h1`, sequential headings, labeled forms, fieldset/legend for filter groups, ordered lists for morphology/citations, and native links/buttons.
- Screen readers receive the result basis before details, a linear morphology summary before the visual rail, literal unresolved characters, citation titles, expanded/collapsed state, result counts after user actions, and privacy warnings before correction actions.
- Color removal, forced colors, grayscale, and common color-vision differences must preserve morphology kinds, selected state, status, links, errors, and focus through labels, rules, shapes/patterns, and semantics.
- At 200% zoom, all content and controls reflow without clipping, overlap, or viewport-level horizontal scrolling. At 400% text zoom where applicable, core reading and actions remain available in one dimension.
- Body/input text remains 16px or larger; users may override fonts, spacing, colors, and line height without loss of function.
- `prefers-reduced-motion` yields an immediate, complete interface. No feature depends on animation or timing.
- No time limits, auto-advancing content, flashing, autoplay, or unexpected context changes.
- Keep instructions adjacent to actions, use one primary action per decision region, limit initial alternatives, maintain consistent vocabulary, and place recovery where an error occurs to reduce cognitive load.
- Future browser QA must exercise keyboard-only navigation, VoiceOver or equivalent screen reader output, forced colors, reduced motion, 200% zoom, 375/768/1280 widths, long content, and no-overflow checks.
- Browser QA must exercise the theme control by click, `Enter`, and `Space`; valid, invalid, missing, and unavailable storage; opposite system and persisted preferences before first paint; live system changes in automatic versus explicit mode; route navigation and reload persistence; and axe scans in both light and dark palettes.

### Privacy and safety constraints

- Analyzer and corpus search remain client-side/static. Do not add remote requests, accounts, cookies, telemetry, session replay, stored search history, or recent-search UI without a separately reviewed privacy change. The sole persistence exception is `medical-word-parts:theme`, whose complete value space is `light | dark` and which contains no user content.
- Query text may appear in `/analyze/?term=` and therefore in browser history or a copied URL. State this near the form and tell users not to enter names, symptoms, record identifiers, or other private medical information.
- Correction links open a public GitHub issue. The warning must appear before the action and in the prefilled template. Do not prefill private free text.
- External source links leave the site; disclose the destination/new-tab behavior. Do not imply that external privacy practices are controlled by this application.
- Persistent scope copy: `For terminology learning and reference; not medical advice.`

### Performance and implementation gates

- Static/reference routes should ship no client JavaScript unless interaction requires it. Isolate analyzer, search/filter, mobile menu, copy feedback, and theme selection as small local vanilla enhancements. The pre-paint classic theme bootstrap is at most 2KB; the deferred site enhancer remains at most 8KB; analyzer and parts remain separate ES modules.
- No stock imagery is planned. If meaningful media is later approved, it needs intrinsic dimensions, responsive formats, accurate alt text, and a contract update before implementation.
- Self-host and subset fonts; preload the three compact authored faces required above the fold. Avoid third-party scripts and remote font requests.
- Production browser audits, once UI exists, target 100 in Performance, Accessibility, Best Practices, and SEO on mobile and desktop, using real Playwright-controlled Chrome, 3–5 runs, and the median. Do not remove useful states or content to gain points.
- React implementation must complete the frontend React tooling gate and render-quality audit at that time; this document does not claim those implementation checks have run.
- Primitive showcase QA at 375/768/1280 is a blocker before composing product pages. Full `/visual-qa` and post-implementation review are blockers before visual sign-off.

### Accepted debt

| Item | Location | Why accepted | Owner / exit condition |
|---|---|---|---|
| None | All routes | No accessibility, persona, privacy, or interaction debt is accepted at the contract stage | Any future debt requires explicit user approval, affected-user impact, exact location, mitigation, owner, and exit date/condition recorded here before sign-off |

Dark mode has no accepted contrast, accessibility, persona, motion, first-paint, or visual debt. Concept imagery remains outside the implementation because this established field-guide contract, not an external visual target, is the authority.

### Color-removal morphology proof

Use the structural fixture `hypo- + glyc/o + -emia` only to test presentation grammar; displayed meanings and source claims must still come from the authored corpus.

1. Render three ordered segments with every morphology background and morphology ink color replaced by paper and primary ink.
2. Confirm segment 1 still reads `01 — PRE / Prefix — hypo-` and begins with the prefix leading rule.
3. Confirm segment 2 still reads `02 — C/F / Combining form — glyc/o` and retains its diagonal edge hatch and visible slash notation.
4. Confirm segment 3 still reads `03 — SUF / Suffix — -emia` and ends with the suffix trailing rule.
5. Confirm visible `+` operators preserve construction order and the reconstruction arrow points to the whole term.
6. Replace any segment with literal characters labeled `? / Unresolved`; confirm crosshatch, text, order, and screen-reader summary identify the unresolved span without red.
7. Navigate each segment, source chip, and alternative disclosure by keyboard; confirm focus and selected/current state remain visible without hue.
8. Read the ordered list with a screen reader; confirm ordinal, full kind name, notation, meaning, transformation if present, unresolved text, and citations are announced in visual order.

**Proof result at contract level:** PASS. Every morphology distinction has at least two non-color carriers: explicit text plus a rule/pattern/position cue. Rendered proof remains an implementation blocker and is not claimed complete.

### Contract completion checklist

- [x] Sections 0–8 are present and define research, identity/personas/jobs, principles, color, typography, spacing/layout, primitives/states, responsive/motion, surfaces, accessibility/privacy, route hierarchy, and accepted debt.
- [x] All mandated references were read in full; exactly one Layer A (`minimalist-skill.md`) and one Layer B (`ibm.md`) were selected after a three-reference shortlist.
- [x] All greenfield research lanes are recorded, including 4 Lazyweb queries, 8 viewed screens, UI/UX DB findings, untrusted-output handling, and the unavailable concept-draft lane.
- [x] Paper/cool-gray surfaces, carbon-like ink, clinical blue, semantic colors, restrained radii, tonal depth, and the no-decorative-shadow rule have named tokens.
- [x] The non-generic Crimson Pro/Atkinson Hyperlegible pairing and complete type scale are defined.
- [x] Navigation, links, buttons, search, filters, morphology, references, status, citations, and correction flows have structure, variants, states, accessibility, layout, and motion rules.
- [x] `/`, `/analyze/`, `/term/[slug]/`, `/parts/`, `/parts/[slug]/`, `/sources/`, `/methodology/`, and `404` have explicit content decision hierarchies.
- [x] 375px, 768px, 1280px, keyboard/focus, 44px targets, 200% zoom, reduced motion, no overflow, WCAG 2.2 AA, screen reader, cognitive-load, privacy, and base-path constraints are explicit.
- [x] The morphology rail has an explicit color-removal and screen-reader proof with no medical meaning invented by the contract.
- [x] No copied branding, SaaS hero, anatomy stock art, emoji icon, purple default, decorative motion, or decorative shadow is specified; both theme palettes preserve the field-guide material.
- [x] Primitive showcase, both-theme browser accessibility checks, rendered morphology proof, Lighthouse, and dual-review `/visual-qa` passed against the production export at 375px, 768px, and 1280px. The fresh 12-state x 2-theme x 3-viewport matrix is generated under the ignored `.artifacts/` directory.
