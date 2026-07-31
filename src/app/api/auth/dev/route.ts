import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { devToolsEnabled, notFound } from "@/lib/dev";
import { EMAIL_DOMAIN } from "@/lib/site";

/**
 * Development-only sign-in, so the whole student path can be exercised without a
 * registered OAuth redirect URI. Gated by `devToolsEnabled()` — see `lib/dev.ts`.
 */
export async function GET(request: NextRequest) {
  if (!devToolsEnabled()) return notFound();

  const raw = request.nextUrl.searchParams.get("email") ?? `prueba@${EMAIL_DOMAIN}`;
  const email = raw.trim().toLowerCase();
  const googleId = `dev:${email}`;

  const user = await db().user.upsert({
    where: { googleId },
    update: { email },
    create: { googleId, email, name: "Estudiante de prueba", role: "student" },
  });

  await createSession({ id: user.id, email: user.email, name: user.name });
  console.warn(`[dev-login] session issued for ${email} — never enable this in production`);

  return NextResponse.redirect(new URL("/inicio", appUrl()));
}
