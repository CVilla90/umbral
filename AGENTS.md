# Working on Umbral

`HANDOFF.md` is the state of the project. `PLAN.md` is the design of record.
`DEPLOY.md` is the deploy procedure. Read this file before changing anything.

## What this is

Umbral measures the English proficiency of UACH FCCF students at the start of a
semester and again at the end, and compares the two. That comparison is the
entire point, and it is what makes silent changes expensive: any difference
between the entry instrument and the exit instrument is indistinguishable from
student learning, and the data cannot be recollected once a window closes.

## Do not restructure this repo

This is a **Next.js 16 App Router** app on **npm**, deployed on **Replit
Autoscale**. It is already configured and it already runs. Do not:

- convert it to Vite, Express, or any other framework or runtime
- move it into a workspace, monorepo, or "artifact" layout
- change the package manager, or replace `package-lock.json`
- rewrite `package.json`, `next.config.ts`, `.replit`, or `prisma/schema.prisma`
- set `output: "standalone"` — the standalone tracer routinely misses Prisma's
  query engine, and that failure appears at runtime in production, not at build
- add a dependency to solve a problem that has not been demonstrated

If a migration or port appears necessary, stop and ask. It is not.

## What deploying actually requires

Provision Postgres, set the secrets in `DEPLOY.md` §3, run `npm run db:push` and
`npm run db:seed`, deploy. Nothing else.

## Rails that exist to protect students

- **`DEV_LOGIN` must never be set in production.** It opens `/api/auth/dev`
  (sign in as anyone) and `/api/dev/demo` (fabricate students). Both return 404
  when the flag is absent. Confirm the 404 rather than assuming the gate is on.
- **`SPEAKING_ENABLED` must be `true`.** Anything else makes the kill switch fire
  *before* Gemini and record a zero-scoring skip: the student sees a polite
  message, finishes normally, and silently loses **2 of 37 points** — in both
  windows, with no error anywhere.
- **Never commit real secrets.** `.env.example` holds placeholders only; real
  values live in the platform's secrets panel.
- **Dates are calendar days in `America/Chihuahua`**, never server-local — see
  `src/lib/zone.ts`. The host runs UTC, and getting this wrong opens the window a
  day early. `closesAt` is inclusive.
- **The instrument is 37 points and is locked for the semester.** An instrument
  whose maximum differs between its entry and exit windows cannot compare them.
- **Forms are counterbalanced AB/BA**, never per-student random sampling. The
  form-effect check on `/admin/avance` depends on it.

## Before calling anything done

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

All four must pass. The suite is 227 tests and it asserts the things above.
