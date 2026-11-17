# Manage

Corporate site-attendance system: staff clock in and out with an Expo app, site
owners get departure alerts and oversight on mobile, and platform administrators
run organizations from a Next.js console. Attendance, presence, and sync are
tracked as separate states, and missing location is reported as unknown — never
as absence.

## Requirements

- Node 22+ and pnpm 10 (`corepack enable`)
- MongoDB with replica-set semantics. `pnpm db:dev` starts an in-memory
  single-node replica set on port 27017; any real replica set works too.

## Quick start

```bash
pnpm install
cp .env.example .env
# Set BETTER_AUTH_SECRET:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm db:dev            # terminal 1: in-memory Mongo (data is discarded on stop)
pnpm seed              # terminal 2: creates indexes, two organizations, demo accounts
pnpm dev               # API on :4000 and web console on :3000
pnpm dev:mobile        # Expo dev server; scan the QR with Expo Go
```

Seed accounts all use `SEED_PASSWORD` (default `ManageDemo!2026`):

| Account | Role |
| --- | --- |
| `admin@manage.local` | Platform administrator, Northwind Facilities |
| `owner@northwind.manage` | Site owner, Northwind Facilities |
| `owner@harbor.manage` | Site owner, Harbor Logistics |
| `ada@northwind.manage`, `tunde@northwind.manage`, `grace@northwind.manage` | Staff |
| `femi@northwind.manage` | Suspended membership (denial fixture) |
| `musa@harbor.manage`, `ifeoma@harbor.manage` | Staff, second organization |

The seed prints a pending invitation token and an `/invite/<token>` URL. Site
owners and platform admins must enroll TOTP before owner/admin surfaces unlock;
staff accounts do not need a second factor.

If `RESEND_API_KEY` or `EXPO_ACCESS_TOKEN` is absent, the API and worker write
messages to `LOCAL_NOTIFICATION_DIR` and label them as local adapter output. They
never report a disk write as a provider delivery.

## Layout

See `AGENTS.md` for the package map, invariants, and security rules.

## Checks

```bash
pnpm lint             # ESLint 9 flat config across the workspace
pnpm typecheck        # tsc --noEmit in every package/app
pnpm test             # unit tests
pnpm test:integration # API tests against an in-memory replica set
pnpm build            # API (tsup), worker, web (next build)
pnpm db:indexes:verify
pnpm security:check   # public-env secrets, client/server import boundary, committed URIs
```

Integration tests cover cross-organization denial, suspended memberships, CSRF,
replay, concurrent clock-ins, and the scheduled worker tick. See
`docs/completion-report.md` for what has and has not been verified.

## Deployment

- `docs/deployment-vercel.md` — Vercel API + web, Atlas, Vercel Cron worker
  schedule, secret rotation, rollback, and health checks.
- `docs/operations/` — backup/restore, incident runbook, device test record.
- `apps/api/openapi.yaml` — REST contract for `/api/v1`.
