# GitHub Pages deployment

This repository builds a static export. The expected Pages URL is `https://ioujared.github.io/medical-word-parts/`, but this guide does not claim that the site is live.

## Activation

1. Open the repository settings in GitHub.
2. Go to **Pages**.
3. Set the source to **GitHub Actions**.
4. Keep the repository name as `IOUJared/medical-word-parts` if you want the expected URL to remain valid.
5. Make sure the workflow can use the `github-pages` environment.
6. Push to `main` or run the deployment workflow manually, then wait for the workflow to publish the `out/` artifact.

## Workflow behavior

The deployment workflow is `.github/workflows/deploy-github-pages.yml`.

- It runs on pushes to `main` and on manual dispatch.
- It uses Node 22 and `npm ci`.
- It validates current generated data, runs data tests, checks committed browser bundles, lints, typechecks, tests, and builds before deployment.
- It runs `actions/configure-pages` before upload.
- It uploads `out/` with `actions/upload-pages-artifact`.
- It deploys with `actions/deploy-pages`.

The workflow is intentionally least-privileged. It only asks for the permissions needed to publish Pages.

## Environment defaults

Production builds use these public values unless you override them:

- `NEXT_PUBLIC_BASE_PATH=/medical-word-parts`
- `NEXT_PUBLIC_SITE_URL=https://ioujared.github.io/medical-word-parts`

Those values are public build settings, not secrets.

## Verification checklist

Before you call a deployment complete, check all of the following:

- `npm ci`
- `npm run data:validate`
- `npm run data:test`
- `npm run browser:validate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- the built artifact exists at `out/`
- the published site uses the expected base path

## Troubleshooting

### Assets 404

Check that the build used the `/medical-word-parts` base path and that the exported files in `out/` kept their trailing slash structure. Also confirm that the deployed artifact still contains the redirect rules from `public/_redirects`.

### Build fails

Run the validation commands in the checklist in order. If one fails, fix that layer before retrying the workflow.

### URL looks wrong

Verify the expected Pages URL, the base path, and the site URL value used at build time. The deployment artifact should stay aligned with the repo path.

## Manual review notes

After deployment, verify a few representative pages:

- `/`
- `/analyze/`
- `/parts/`
- `/term/hypoglycemia/`
- `/sources/`

If the repository name or base path changes, update the workflow, redirects, and docs together.
