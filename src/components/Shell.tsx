import Link from "next/link";
import { BRAND, DEPARTMENT, FACULTY_SHORT } from "@/lib/site";

/**
 * The frame every signed-in page sits in. Deliberately thin: during a check-in
 * the only things on screen should be the question and the way forward, so there
 * is no navigation to wander into and nothing to lose your place to.
 */
export default function Shell({
  children,
  email,
  wide = false,
}: {
  children: React.ReactNode;
  email?: string | null;
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex min-h-screen flex-col px-5 sm:px-8 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-rule py-6">
        <Link href="/inicio" className="font-display text-xl font-extrabold tracking-tight">
          {BRAND}
        </Link>
        {email ? (
          <span className="label truncate text-graphite" title={email}>
            {email}
          </span>
        ) : (
          <span className="label text-graphite">
            {FACULTY_SHORT} &middot; <span className="hidden sm:inline">{DEPARTMENT}</span>
          </span>
        )}
      </header>

      <main className="flex-1 py-10 sm:py-14">{children}</main>

      <footer className="border-t border-rule py-6">
        <form action="/api/auth/salir" method="post">
          {/* 44px tap target (it measured 20px). Deliberately left in the footer
              rather than the header: a student who logs out mid-check-in loses
              nothing — every answer is already saved — but they do have to sign
              in again, so the control should be easy to hit ON PURPOSE and hard
              to hit by accident. Distance does that job better than smallness. */}
          <button
            type="submit"
            className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink"
          >
            Cerrar sesión
          </button>
        </form>
      </footer>
    </div>
  );
}
