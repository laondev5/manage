# Manage web console

Standalone Next.js project. Use Node 22 LTS and pnpm 10.20.0.
Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, configure
API_ORIGIN, and run `pnpm dev`.

The environment example points API_ORIGIN to https://manage-backend-sigma.vercel.app.
Set the same variable in Vercel when deploying; local `.env` is Git-ignored.

Deploy as its own repository with Vercel's Next.js preset, Node 22.x, root `.`,
`pnpm install --frozen-lockfile`, and `pnpm build`. Set API_ORIGIN to the API's
HTTPS origin. Leave NEXT_PUBLIC_API_BASE_URL empty to retain first-party cookies
through the `/api/auth/*` and `/api/v1/*` rewrites. On the API, AUTH_BASE_URL and
TRUSTED_WEB_ORIGINS must use the web origin. Use separate preview data/settings.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
Local src/contracts and src/api-client copies must stay compatible with the API.
Never add database credentials to this project.
