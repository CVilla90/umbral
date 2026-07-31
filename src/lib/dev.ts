/**
 * The one gate for every development-only route.
 *
 * DOUBLE-GATED, and both gates are checked on every request:
 *   1. NODE_ENV must not be "production"
 *   2. DEV_LOGIN must be set
 *
 * It lives here, alone, on purpose. Every dev route calls this and nothing else,
 * so the go-live check is a single question ("is DEV_LOGIN unset on the host?")
 * instead of one question per route — and adding a dev route later cannot
 * accidentally ship with a weaker gate than the ones already written.
 *
 * `.env.example` does not ship DEV_LOGIN. The deploy checklist in HANDOFF.md §3
 * says to confirm these routes 404 on the deployed host before the window opens.
 */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && Boolean(process.env.DEV_LOGIN);
}

/** 404, never 403 — a probe of a deployed instance must not learn the route exists. */
export function notFound(): Response {
  return new Response("Not found", { status: 404 });
}
