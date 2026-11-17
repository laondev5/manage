# Threat model

Scope: the Manage API, web console, mobile app, worker, and their data stores.
This is a working threat model, not a certification. It records what the code
actually enforces, what it assumes, and what remains unverified.

## Assets

| Asset | Why it matters |
| --- | --- |
| Attendance events, shifts, corrections | Pay and disciplinary evidence; must be attributable and tamper-evident |
| Precise location samples | Sensitive personal data; exposed only to scoped roles |
| Session cookies, SecureStore keys, TOTP secrets, backup codes | Account takeover |
| Invitation tokens | Account creation for a specific organization/site |
| Worker trigger secret | Ability to make the API deliver email/push |
| Provider credentials (Resend, Expo) | Spoofed or abusive notifications |
| Audit chain | Accountability and forensic reconstruction |

## Trust boundaries

1. **Browser ↔ Next.js** — same origin; HttpOnly cookies. The browser is untrusted
   for roles, organization ids, coordinates, and user ids.
2. **Browser/Next.js ↔ API** — CORS allowlist + `Origin`-bound CSRF token for
   cookie mutations.
3. **Expo app ↔ API** — bearer-like cookie transport from SecureStore, no CSRF
   token (native client marker), TLS in production.
4. **API/worker ↔ MongoDB** — credentials are server-only; the database is trusted
   for availability but not for authorization decisions.
5. **API ↔ Resend webhook** — unauthenticated network input; verified with HMAC
   over raw bytes.
6. **Scheduler ↔ tick endpoint** — shared `WORKER_TRIGGER_SECRET` over HTTPS;
   GitHub Actions is trusted to hold the secret and run the schedule. Any
   scheduler can call the same endpoint with `CRON_SECRET` instead.
7. **Device OS ↔ encrypted queue** — SecureStore key is device-bound
   (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); the ciphertext in AsyncStorage is not
   useful without it.

## Threats and mitigations

| # | Threat | Mitigation in code | Residual risk |
| --- | --- | --- | --- |
| T1 | Public admin signup / self-promotion | `/api/auth/sign-up*` returns 404; invitations only create `STAFF` memberships; no route grants `PLATFORM_ADMIN` to self | Provisioning mistakes by an existing admin |
| T2 | Cross-organization or cross-site read/write | `requireAuth` rebuilds actor scope from MongoDB; every route filters by verified organization/site ids; cross-org reads return 404 (test: `authz.integration.test.ts`) | A new route that forgets the scope check — reviewed in code review, not machine-enforced |
| T3 | Stolen session cookie | HttpOnly + Secure cookies, short session lifetime from Better Auth, Origin allowlist, CSRF token on browser mutations, pino redaction of cookies | Cookie theft on a compromised device remains account takeover until revocation |
| T4 | CSRF | Allowlisted `Origin` + HMAC(session id) token from `/api/v1/csrf`; native header bypass is explicit | Requests with no `Origin` skip the token check. Browsers send `Origin` on cross-site writes, but this relies on browser behavior; a proxy that strips `Origin` weakens it. Do not strip it. |
| T5 | MFA bypass / owner surfaces without a second factor | `requiresMfa(roles)` + enrolled factor; `requireMfaComplete` on owner/admin routes; UI states are advisory | An enrolled-but-unverified session is blocked, but backup-code handling depends on Better Auth defaults and has not been exercised end-to-end in this repo |
| T6 | Concurrent or replayed clock-in creating two shifts | Partial unique index `userId` where `status: 'WORKING'`; unique `(userId, deviceId, clientEventId)`; transaction inserts shift + event (tests: replay, concurrent clock-in) | Two devices for the same user with different client ids still race — the index allows only one winner by design |
| T7 | Offline queue tampering or cross-account replay | AES-256-GCM with SecureStore key; queue keys cleared on sign-out; server revalidates assignment and organization on every event | Rooted/jailbroken device with key extraction; server-side duplicate detection still applies |
| T8 | Forged or replayed Resend webhook | Signature verified over raw body before JSON parsing; replay window on timestamp/signature | Resend's delivery reports are informational; a missed webhook only affects `lastError` metrics, not attendance |
| T9 | Forged worker tick (unauthorized delivery / cost abuse) | 32+ char secret, constant-time compare, 404 when unset, Mongo-backed rate limit, secrets masked in Actions logs | Secret leakage; rotate per `docs/operations/incident-runbook.md`. The in-memory tick limiter is per instance, but each instance still enforces 120/min |
| T10 | Duplicate notifications | `outbox.logicalKey` unique; leases with expiry; Resend `Idempotency-Key`; concurrency test asserts no double delivery | At-least-once semantics: a crash after provider acceptance but before `SENT` can duplicate. Resend idempotency limits this; push has no provider idempotency |
| T11 | Alerting on GPS noise / punishing absence falsely | Entry/exit buffers, accuracy ceiling, freshness window, grace interval; unknown ≠ absent; recipient and incident state rechecked at delivery | OS throttling can delay samples; alerts are best-effort and labelled as review prompts |
| T12 | Self-approved timesheet changes | Server rejects `reviewerId === workerId`; corrections are amendments with audit entries | A second colluding reviewer is out of scope of technical controls |
| T13 | SQL/NoSQL injection via query operators | Zod DTOs, explicit Mongo filters, no client-supplied operators or aggregation pipelines | Future code could interpolate unsafely; grep for `$` in route code during review |
| T14 | Log leakage of coordinates, tokens, secrets | pino redaction of auth/cookie/CSRF/worker headers; no request-body logging; worker logs ids not payloads | Application `logger.info` calls added later could leak; keep the redaction list current |
| T15 | Secrets exposed to clients | No secret in `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*`; `API_ORIGIN` is server-only; `security:check` scans the repo | Build-time env mistakes; the check runs in CI/local, not enforced by the platform |
| T16 | Audit tampering | Append-only `auditEvents` with hash chain and sequence unique index; admin audit UI verifies chain | A database administrator can rewrite the whole chain; export/retain audit logs off-box for stronger evidence |
| T17 | Abuse/DoS on auth and writes | Mongo-backed rate limits per IP/user on invites, attendance, sync, observations, corrections, exports, and ticks | Distributed attacks against the auth library rely on Better Auth's own protections; no WAF is configured |
| T18 | Serverless filesystem pretending delivery | Local adapter disabled when `isProduction`; sent state requires a provider id | Misconfigured `NODE_ENV` on Vercel would enable disk writes; the deployment checklist pins `NODE_ENV=production` |
| T19 | Index drift causing slow or unsafe queries | `ensureIndexes` additive; `db:indexes:verify` fails on missing indexes; deployment runbook requires it | Verification is manual in CI/CD; add it to release checklists |
| T20 | Stale worker silently stops delivering | Heartbeat document + admin health page; scheduled threshold derived from `WORKER_SCHEDULE_SECONDS`; the tick endpoint returns 503 on partial failure and the next scheduled run retries the durable outbox | Schedulers do not retry indefinitely: GitHub Actions disables scheduled workflows after 60 days of repository inactivity, and a long outage only shows as an overdue heartbeat; pair with external uptime monitoring |

## Verification status

Proven by automated tests in this repository:

- Unauthenticated reads → 401; cross-organization site read → 404; staff blocked
  from owner/admin surfaces; suspended membership loses site access.
- Browser mutation without CSRF token → 403.
- Replayed clock-in → `DUPLICATE`; concurrent clock-ins → exactly one active
  shift; clock-out without location; new clock-in after clock-out.
- Tick endpoint: 404 when unconfigured, 401 for missing/wrong/prefix secrets,
  422 for invalid batch size, successful delivery with scheduled heartbeat,
  second tick delivers nothing, two concurrent ticks do not double-deliver,
  cancelled incidents do not send.

Not verified here: penetration testing, real-provider webhook signature replay
against Resend, device-level key extraction resistance, load/DoS behavior, and
browser MFA enrolment end-to-end. Treat the table above as design intent until
those are exercised in the target environment.

## Explicitly out of scope

- Regulatory compliance claims (GDPR/NDPR/SOC 2) — no audit has been performed.
- Malicious platform administrators with database access.
- Supply-chain compromise of npm packages or the Expo/Resend/GitHub platforms.
- Physical device seizure of an unlocked phone.
