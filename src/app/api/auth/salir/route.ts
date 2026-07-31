import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth/google";
import { destroySession } from "@/lib/auth/session";

/** POST-only: a GET logout can be triggered by any image tag on any page. */
export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", appUrl()), { status: 303 });
}
