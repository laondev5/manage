# Manage — repository instructions template

Copy this file to AGENTS.md at the root of the actual Manage application repository, or merge it into existing instructions. This file is a template; it does not change instructions for unrelated projects in the current workspace.

## Product

Manage is a corporate site-attendance system. Staff clock in/out in an Expo mobile app. Site owners use mobile oversight and departure alerts. System administrators use a Next.js web app. Name the product Manage, never KhemSafe.

Read MANAGE_BUILD_PROMPT.md and IMPLEMENTATION_GUIDE.md from the supplied build-spec package before implementation. Once installed in the application repository, keep those specifications under docs/build-spec and update links accordingly. Current explicit user requirements override earlier research suggestions.

## Stack and architecture

- TypeScript strict, Expo + Expo Router + NativeWind, Next.js App Router + shadcn/ui + Tailwind, Node + Express, MongoDB, Resend.
- React Hook Form + Zod for forms. Zustand for local UI state. TanStack Query for client-side server state.
- Better Auth hosted in Express with supported MongoDB/Expo/MFA integrations.
- Express owns domain rules and authorization. Clients and Next.js never access MongoDB directly.
- Mongo transactional outbox with a separate worker. Do not add infrastructure without a concrete need.
- Share schemas, API types, and tokens; do not share DOM shadcn components with native screens.
- Read installed versions and official compatibility docs. Keep web Tailwind and NativeWind configuration separate when needed.
- Prefer established native equivalents for controls where supported; NativeWind styles native wrappers and custom components.
- Preserve existing files and repository layout. Isolate new work if the workspace is not an application repo.

## Non-negotiable product behavior

- Attendance, presence, and sync status are distinct.
- Leaving a site does not clock a worker out or reduce payable time.
- Missing/stale GPS is unknown, not absence.
- Clock-out works without a location fix. Stop device collection immediately on local clock-out.
- Never promise instant alerts or guaranteed tracking after force-quit.
- First-use steppers are functional setup with contextual permissions.
- Display offline records as pending; sync with durable IDs and server validation.
- Preserve original attendance and use audited amendments.
- Enforce one active accepted shift per user atomically.
- Brand colors: navy/cobalt/neutral; no green/teal/mint.
- Make interfaces usable with large text, screen readers, and keyboard on web.

## Security rules

- Centralize deny-by-default authorization; constrain every query, aggregation, export, and job by verified scope.
- Never trust roles, user IDs, organization IDs, site permissions, or presence flags from client state.
- No public admin signup; no owner self-promotion; no correction self-approval.
- Enforce MFA for owners/admins and server-side revocation. Do not equate an enrolled factor with a challenged session.
- Use supported authentication libraries and cryptography. No hardcoded passwords, custom crypto, or bypass mode in production.
- Browser credentials: secure HttpOnly cookies. Native secrets: SecureStore through the auth integration.
- Never store auth secrets/precise coordinates in persisted Zustand or plain AsyncStorage.
- Offline sensitive data requires verified encryption and account isolation.
- Validate request DTOs and construct Mongo filters/updates explicitly. No raw client aggregation or query operators.
- Cookie-authenticated business mutations require CSRF defenses; CORS is not sufficient.
- No secrets in NEXT_PUBLIC_* or EXPO_PUBLIC_* variables.
- No sensitive request bodies, coordinates, tokens, reset links, or MFA secrets in logs.
- Preserve raw webhook bytes for signature verification.
- Recheck recipients and permissions in delayed jobs.
- Keep audit history append-only; describe its real limits honestly.
- Never claim production readiness or regulatory compliance without evidence.

## Implementation workflow

1. Inspect instructions, manifests, current code, and supplied designs.
2. Write a short phased plan and a compatibility record, then implement.
3. Build a vertical slice from UI to API to database before expanding features.
4. Add meaningful tests for authorization, transitions, races, replay, and privacy.
5. Run applicable lint/typecheck/tests/build checks after changes.
6. Record external dependencies and unverified device/provider behavior.
7. Keep docs, .env.example, API contracts, migration scripts, and runbooks current.

Do not rewrite unrelated files, replace working dependencies without cause, expose credentials, send real invitations, or deploy production changes without authorization. Missing credentials allow local adapters, not fake successful integrations.

## Completion evidence

Provide working code, command results, two-organization security fixtures, API documentation, real index verification, offline replay tests, UI journeys, device-test records, and unresolved findings. Security tests must prove denial paths, not only happy paths. A compile or screenshot alone does not complete the task.

