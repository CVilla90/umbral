# Replit agent — read this first

**Do not migrate, port, or restructure this project.** It is a Next.js 16 App
Router app on npm with a committed `.replit`. It is already configured and it
runs as-is.

Specifically, do not:

- create a pnpm workspace, `pnpm-workspace.yaml`, `artifacts/`, or `artifact.toml`
- convert it to Vite, Express, or any other stack
- rewrite `package.json`, `next.config.ts`, or `.replit`
- switch the package manager away from npm
- set `output: "standalone"` in `next.config.ts` — it breaks Prisma's query
  engine at runtime in production, where it is most expensive to discover

A previous import was restructured into a multi-artifact pnpm workspace and had
to be discarded. The app was never broken; it was already deployable. If a
migration seems necessary here, it is not — stop and ask.

## What to actually do

1. Provision a Postgres database (this sets `DATABASE_URL`).
2. Set the secrets listed in `DEPLOY.md` §3.
3. Run `npm run db:push`, then `npm run db:seed`.
4. Deploy. `.replit` already specifies `autoscale`, `npm run build`, `npm run start`.

Port lines in `.replit` may be adjusted if Replit's conventions require it.
`deploymentTarget = "autoscale"` and the build command must not change.

## Two settings that fail silently

- **`DEV_LOGIN` must NOT be set.** It opens sign-in-as-anyone and a route that
  fabricates student records. Both must return **404** on the deployed host —
  verify it, do not assume it.
- **`SPEAKING_ENABLED` must be `true`.** Anything else silently costs every
  student 2 of 37 points, in both measurement windows, with no error shown.

## Context

This app measures real students' English at the start and end of a semester and
compares the two. A silent behaviour change corrupts data that cannot be
recollected after the window closes.

Full guidance: `AGENTS.md` → `DEPLOY.md` → `HANDOFF.md`.
