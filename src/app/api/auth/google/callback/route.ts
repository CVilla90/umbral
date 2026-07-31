import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  appUrl,
  emailAllowed,
  fetchGoogleProfile,
  googleConfigured,
  isAdminEmail,
  safeNext,
} from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * The only way into Umbral.
 *
 * Order matters here: verify state, exchange the code, THEN apply the domain gate
 * — and apply it before any database write, so a non-UACH sign-in never creates a
 * User row. The consequence is that `User` is by construction a table of people
 * entitled to be measured.
 */
export async function GET(request: NextRequest) {
  const base = appUrl();
  const fail = (motivo: string) =>
    NextResponse.redirect(new URL(`/acceso?motivo=${motivo}`, base));

  if (!googleConfigured()) return fail("sin-configurar");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("cancelado");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("incompleto");

  const store = await cookies();
  const expected = store.get("umbral_oauth_state")?.value;
  const next = store.get("umbral_oauth_next")?.value ?? null;
  store.delete("umbral_oauth_state");
  store.delete("umbral_oauth_next");
  if (!expected || expected !== state) return fail("estado");

  const profile = await fetchGoogleProfile(code);
  if (!profile) return fail("google");

  // The gate — before any write.
  if (!emailAllowed(profile)) return fail("dominio");

  const email = profile.email!.trim().toLowerCase();

  const user = await db().user.upsert({
    where: { googleId: profile.sub },
    update: {
      email,
      name: profile.name ?? undefined,
      image: profile.picture ?? undefined,
      role: isAdminEmail(email) ? "admin" : "student",
    },
    create: {
      googleId: profile.sub,
      email,
      name: profile.name ?? null,
      image: profile.picture ?? null,
      role: isAdminEmail(email) ? "admin" : "student",
    },
  });

  await createSession({ id: user.id, email: user.email, name: user.name });

  return NextResponse.redirect(new URL(safeNext(next), base));
}
