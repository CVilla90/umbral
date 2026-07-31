import { redirect } from "next/navigation";
import { isAdminEmail } from "./auth/google";
import { getSession, type SessionUser } from "./auth/session";
import { db } from "./db";

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

/**
 * Write an audit row for anything that changes data (PLAN §9).
 *
 * ⚠️ Never throws. An audit failure must not roll back the change the admin
 * actually asked for — the log is evidence, not a gate. It does shout to the
 * server console, because a silently dead audit log is worse than none: it looks
 * like nothing happened.
 *
 * The actor's email is read from the session here rather than accepted as an
 * argument, so a caller cannot attribute an action to somebody else.
 */
export async function audit(
  action: string,
  target?: { type?: string; id?: string; payload?: unknown },
): Promise<void> {
  try {
    const session = await getSession();
    await db().adminAudit.create({
      data: {
        actorEmail: session?.email ?? "desconocido",
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        payload: (target?.payload ?? null) as never,
      },
    });
  } catch (error) {
    console.error("[audit] could not record admin action", action, error);
  }
}
