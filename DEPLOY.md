# Deploying Umbral to Replit

Do these in order. Steps 1–5 must all be done **before** the Google OAuth client
exists, because the redirect URI needs the deployed host's real URL.

🔴 The entry window opens **2026-08-10**.

---

## 1. Import the repo

Replit → Create → Import from GitHub → `CVilla90/umbral`.

`.replit` is committed, so the Run button and the deployment build/run commands
are already configured. If the Replit agent wants to change the **port** lines,
let it — that is the part of Replit config that moves most. Do not let it change
`deploymentTarget` away from `autoscale`, or `build` away from `npm run build`.

## 2. Create the database

Replit → Database → create a **Postgres** instance. It sets `DATABASE_URL` for you.

⚠️ **If you paste a `DATABASE_URL` by hand, do not include
`?connection_limit=1&pgbouncer=true`.** That is a workaround for the local PGlite
socket, which serves exactly one connection. On a real Postgres it throttles the
app to a single connection for no reason.

## 3. Set the Secrets

| Key | Value |
|---|---|
| `SESSION_SECRET` | generate: `node -e "console.log(crypto.randomBytes(48).toString('base64url'))"` |
| `ADMIN_EMAILS` | `cavilla@uach.mx` |
| `GEMINI_API_KEY` | from `../uach_english_progress/.env` |
| `SPEAKING_ENABLED` | `true` |
| `ALLOWED_EMAIL_DOMAIN` | `uach.mx` |
| `NEXT_PUBLIC_APP_URL` | the deployment URL, **no trailing slash** — fill in after step 4 |
| `GOOGLE_CLIENT_ID` | after step 6 |
| `GOOGLE_CLIENT_SECRET` | after step 6 |

⚠️ **`DEV_LOGIN` must NOT be set.** It is the flag that opens `/api/auth/dev`
(sign in as anyone) and `/api/dev/demo` (fabricate students). Both are also gated
on `NODE_ENV`, so they are double-locked — but confirm rather than assume, in
step 5.

⚠️ **`SPEAKING_ENABLED` must be `true`, not absent and not `"false"`.** Shipped
false, the kill switch fires *before* Gemini and records a zero-scoring skip: the
student sees "no están disponibles ahora", finishes normally, and silently loses
**2 of 37 points** — in both windows, with no error anywhere.

## 4. Set up the schema and deploy

In the Replit shell:

```bash
npm run db:push     # creates the tables
npm run db:seed     # semester Ago-Dic 2026 + both windows
```

Then Deploy. Once it is live, set `NEXT_PUBLIC_APP_URL` to the real URL and
redeploy so the OAuth redirect is built against the right origin.

## 5. Confirm the dev doors are shut

```bash
curl -i https://<your-host>/api/auth/dev
curl -i https://<your-host>/api/dev/demo
```

**Both must return 404.** Not 403 — 404, so a prober cannot even learn the route
exists. If either returns anything else, stop and remove `DEV_LOGIN` from Secrets
before going further.

## 6. Register the Google OAuth client

Google Cloud console, inside the **`@uach.mx`** organisation:

- Authorized JavaScript origin: `https://<your-host>`
- Authorized redirect URI: `https://<your-host>/api/auth/google/callback`

It must match `NEXT_PUBLIC_APP_URL` exactly — same scheme, same host, no
trailing slash. Put the client id and secret in Secrets and redeploy.

## 7. Check the real thing

1. Sign in with a `@uach.mx` account. A non-UACH account must be refused — the
   `hd` parameter is only a hint, the server-side domain check is the gate.
2. Fill a ficha, walk a few screens, **play a listening clip**, **record a
   speaking answer**. Those last two are the only legs no automated tool in this
   project can walk; they need a human with a phone.
3. Open `/admin` as `cavilla@uach.mx`.
4. Run the speaking smoke test against the host — a deploy can break the Gemini
   path invisibly:
   ```bash
   node tools/smoke-speaking.mjs
   ```

## 8. Set the real window dates

The local database was left with the entry window widened for testing. In
production, `npm run db:seed` writes the dates from `src/lib/calendar.ts`
(entry 2026-08-10 → 2026-10-03). Adjust from `/admin/administrar` if you want
different ones — that page exists so dates never need a deploy.

⚠️ Dates are **calendar days in Chihuahua time**, and Replit runs in UTC. That
is handled in `src/lib/zone.ts`; the reason it exists is that the seed used to
write UTC midnight, which showed the window opening a day early and would have
opened it six hours early on the host.

## 9. Before you invite anyone

- Add the **professors** and the **group → professor mapping** in
  `/admin/administrar`. Without the mapping, every report says `sin asignar` for
  the whole semester, and it cannot be reconstructed later from student input.
- Upload whichever **class lists** you have in `/admin/lista`. Only a rostered
  group gets a participation percentage; the rest get "who showed up" and no
  denominator, on purpose.

---

## What is NOT in the repo, by design

- No `.env`. Real values live in the Replit Secrets panel.
- No database. `.pgdata/` is local-only and gitignored.
- No demo students. The 48 `DEMO` students exist only in the local dev database;
  a fresh Replit Postgres starts empty. If you ever want them on a staging host,
  `/api/dev/demo` needs `DEV_LOGIN`, which is exactly why it must not be set in
  production.
