import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { isAdminEmail } from "./google";

/**
 * Stateless session in a signed, httpOnly cookie (JWT via jose). No session table:
 * a student signs in, fills a ficha and answers items — there is nothing to
 * invalidate server-side that a 30-day expiry doesn't handle.
 *
 * `isAdmin` is deliberately NOT read from the cookie by admin routes. The cookie
 * carries it only so the UI can render the right nav; every admin route re-derives
 * it from ADMIN_EMAILS server-side. A claim in a token the user holds is a claim,
 * not an authorization.
 */

const COOKIE = "umbral_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export function authConfigured(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function createSession(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** The signed-in user, or null. Never throws — a bad or expired token is "signed out". */
export async function getSession(): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!payload.sub || !email) return null;
    return {
      userId: payload.sub,
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      // Re-derived from env on every read rather than trusted from the token, so
      // revoking an admin is an env change and not a session-expiry wait.
      isAdmin: isAdminEmail(email),
    };
  } catch {
    return null;
  }
}

/** For pages that require a session; callers redirect on null. */
export async function requireSession(): Promise<SessionUser | null> {
  return getSession();
}
