/**
 * Google OAuth 2.0 (authorization-code flow) on plain `fetch` — no auth library,
 * so it can't break on the next NextAuth/Next major. Ported from VillaAula, with
 * the domain restriction added.
 *
 * Umbral has NO password path at all (PLAN §6.1). That removes signup, reset and
 * email verification entirely, and it is what makes the `@uach.mx` restriction
 * airtight rather than advisory.
 */

import { EMAIL_DOMAIN } from "@/lib/site";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Public origin, no trailing slash. Drives the OAuth redirect URI. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

/**
 * `hd` pre-filters the account chooser to the institutional domain. It is a UX
 * hint and NOTHING ELSE — a hostile client can strip it, so the real gate is the
 * server-side check in `emailAllowed` on the callback. Never treat `hd` as
 * security.
 */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    hd: EMAIL_DOMAIN,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  hd?: string;
}

/** Exchange an auth code for an access token, then fetch the user's profile. */
export async function fetchGoogleProfile(code: string): Promise<GoogleProfile | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileRes.ok) return null;
  const profile = (await profileRes.json()) as GoogleProfile;
  return profile.sub ? profile : null;
}

/**
 * THE gate. Both conditions are required:
 *
 *  - `email_verified`, because an unverified Google account can carry an address
 *    its owner does not control;
 *  - an exact `@domain` suffix match on the lowercased address, because
 *    `evil@notuach.mx` contains "uach.mx" and a naive `includes` would admit it.
 *
 * An empty ALLOWED_EMAIL_DOMAIN disables the check. That is deliberate for local
 * development and is called out in `.env.example` as something never to ship.
 */
export function emailAllowed(profile: GoogleProfile): boolean {
  if (!EMAIL_DOMAIN) return true;
  if (profile.email_verified === false) return false;
  const email = profile.email?.trim().toLowerCase();
  if (!email) return false;
  return email.endsWith(`@${EMAIL_DOMAIN.toLowerCase()}`);
}

/** Only same-origin relative redirects, so `?next=` can't become an open redirect. */
export function safeNext(next: string | null | undefined, fallback = "/inicio"): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

/** Comma-separated allowlist from env. The real admin gate, checked server-side. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
