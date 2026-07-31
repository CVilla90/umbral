import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { appUrl, googleAuthUrl, googleConfigured } from "@/lib/auth/google";

/**
 * Kicks off the OAuth dance. The `state` value is minted here, stashed in a
 * short-lived httpOnly cookie, and compared on the way back — without it, a third
 * party could hand a student a pre-baked callback URL and log them into someone
 * else's session.
 */
export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/acceso?motivo=sin-configurar", appUrl()));
  }

  const next = request.nextUrl.searchParams.get("next");
  const state = crypto.randomUUID();

  const store = await cookies();
  store.set("umbral_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  if (next) {
    store.set("umbral_oauth_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
  }

  return NextResponse.redirect(googleAuthUrl(state));
}
