import { redirect } from "next/navigation";
import { isAdminEmail } from "./auth/google";
import { getSession, type SessionUser } from "./auth/session";

/**
 * The gate on every admin page and admin route.
 *
 * ⚠️ **`isAdmin` is re-derived from ADMIN_EMAILS here, never read from the
 * session cookie.** The cookie carries the flag only so the student shell can
 * decide whether to render an admin link. A claim inside a token the user holds
 * is a claim, not an authorization — and this dashboard exposes every student's
 * name, matrícula and score in the faculty.
 *
 * Redirects rather than 404s, because unlike the dev routes there is nothing to
 * conceal: `/admin` obviously exists, and an admin who is simply signed out
 * should be sent to sign in rather than told the page is missing.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/acceso");
  if (!isAdminEmail(session.email)) redirect("/inicio");
  return session;
}

/** Same check without the redirect, for route handlers that answer with JSON/CSV. */
export async function isAdminRequest(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session && isAdminEmail(session.email));
}
