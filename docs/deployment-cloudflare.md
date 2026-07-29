# Cloudflare Pages deployment

This repository produces a zero-runtime static export. The build output is `out/`, and the manual deployment script publishes that directory with Wrangler. This guide describes configuration only. It does not claim that a deployment is live.

The manual GitHub Actions workflow is `.github/workflows/deploy-cloudflare.yml`.

## Pages project setup

1. In Cloudflare, open **Workers & Pages** and choose **Create application**.
2. Create a Pages project for direct upload named `medical-word-parts`.
3. Do not add a second Git build pipeline. This repository's supported Cloudflare path is the manually dispatched GitHub Actions workflow, which validates and builds before Wrangler uploads `out/`.

The Cloudflare workflow is intentionally not triggered by pushes. Run it manually only after reviewing the branch and confirming both repository secrets are configured.

## Public build variables

Set `NEXT_PUBLIC_BASE_PATH` to `/medical-word-parts`. The value must start with `/` and must not end with `/`.

The manual Cloudflare workflow sets:

- `NEXT_PUBLIC_BASE_PATH=/medical-word-parts`
- `NEXT_PUBLIC_SITE_URL=https://medical-word-parts.pages.dev/medical-word-parts`

The workflow deliberately fixes the canonical URL to the Cloudflare Pages project rather than falling back to the GitHub Pages host. Change the workflow value explicitly when a reviewed custom-domain deployment becomes canonical. This is public build configuration, not a secret.

Do not put Cloudflare credentials in these variables.

## Secrets

The manual workflow expects both repository secrets under **Settings > Secrets and variables > Actions > Secrets**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

If either secret is missing, manual dispatch fails with an error naming the missing secret. The deployment step is unconditional after validation, so a green workflow always means Wrangler ran.

## Manual GitHub Actions deployment

1. Open **Actions** in the repository.
2. Select **Deploy Cloudflare Pages**.
3. Choose **Run workflow** on the reviewed branch.
4. Confirm the credential check, validation gates, and Wrangler deployment all pass.

The workflow builds the `/medical-word-parts` artifact with the Cloudflare canonical URL, validates the finalized export, and publishes `out/` to the `medical-word-parts` Pages project.

## Optional local Wrangler deployment

```text
NEXT_PUBLIC_BASE_PATH=/medical-word-parts NEXT_PUBLIC_SITE_URL=https://medical-word-parts.pages.dev/medical-word-parts npm run build
npm run static:validate
npm run deploy:cloudflare
```

This is an operator-only alternative to the canonical GitHub Actions manual dispatch. The script runs `wrangler pages deploy out --project-name medical-word-parts`; run the validation list below and build the Cloudflare canonical artifact before invoking it.

Authenticate Wrangler with its local login flow or provide credentials through a secure environment. Never print a token in shell output.

## Same artifact path behavior

Cloudflare and GitHub Pages both use the same exported `out/` directory. The final static files are the same, so a Cloudflare deployment should not need any artifact rewrite of its own.

## Custom domains

In the Cloudflare Pages project, open **Custom domains**, add the hostname, and finish the DNS and certificate steps. Keep `NEXT_PUBLIC_BASE_PATH=/medical-word-parts` if the site should remain under that path. Set `NEXT_PUBLIC_SITE_URL` to the absolute public URL for the domain, including the base path.

If you need the app at `/`, build a separate artifact with a different base path. Do not change the base path for this artifact without also changing redirect rules and generated URLs.

## Troubleshooting

### Assets 404

Check that the build used `NEXT_PUBLIC_BASE_PATH=/medical-word-parts`. Confirm that the exported artifact still contains the redirects from `public/_redirects`, and verify that asset URLs keep the `/medical-word-parts/` prefix.

### Build fails

Run the local checks in order:

```text
npm ci
npm run data:validate
npm run data:test
npm run browser:validate
npm run lint
npm run typecheck
npm test
npm run build
```

Fix the first failure before trying to deploy again.

### URL points at the wrong host

Verify the workflow's `NEXT_PUBLIC_SITE_URL` value and the build environment. The canonical URL should be `https://medical-word-parts.pages.dev/medical-word-parts`, not the GitHub Pages host or a private preview host.

## Static limits

This deployment has no server runtime, API routes, server actions, runtime secrets, or runtime database. Build-time public variables are baked into the artifact. If the project ever needs server-backed features, keep them in a separate layer such as Workers, D1, or KV.
