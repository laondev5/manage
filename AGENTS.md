# Manage web

Independent Next.js project: install/run pnpm here. No workspace or sibling imports.
Local contracts and API transport must stay compatible with the separate API.
Express remains the only business backend; never add database credentials or
server domain code here. Proxy API/auth requests through the configured API_ORIGIN
to preserve first-party cookies. Preserve CSRF and MFA flows; client roles never
grant access. No secrets in NEXT_PUBLIC variables and no sensitive logging.

Attendance, presence and sync are distinct. Unknown GPS is never absence, and
departure alerts are review prompts. Keep the console keyboard-usable with large
text. Brand: navy #101D35, cobalt #2457D6, canvas #F5F7FB, ink #14213D, muted
#526078; amber/red warnings, blue checks, no green/mint/teal. Name: Manage.

Read relevant code first, plan nontrivial work, and run pnpm lint, typecheck,
test and build after changes. Do not deploy or send real invitations without
authorization. Document unverified deployment/provider behavior honestly.
