import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { BRAND } from "@/lib/site";

/**
 * Every `/admin/*` page passes through `requireAdmin()` here, so a new page
 * cannot be added without a gate. The check re-derives admin status from
 * ADMIN_EMAILS server-side rather than trusting the session cookie.
 *
 * Deliberately plainer than the student side: no `la cinta`, no load animation.
 * The student pages are trying to make a measurement feel inviting; this one is
 * a set of numbers Carlos reads at speed during a live window.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdmin();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule py-6">
        <div className="flex items-baseline gap-3">
          <Link href="/admin" className="font-display text-xl font-bold tracking-[-0.02em]">
            {BRAND}
          </Link>
          <span className="label text-mark-deep">Panel</span>
        </div>
        <span className="label text-graphite">{session.email}</span>
      </header>

      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-b border-rule py-4">
        <AdminLink href="/admin">Participación</AdminLink>
        <AdminLink href="/admin/puntajes">Puntajes</AdminLink>
        <AdminLink href="/admin/lista">Listas</AdminLink>
      </nav>

      <main className="flex-1 py-8 sm:py-10">{children}</main>

      <footer className="border-t border-rule py-6">
        <form action="/api/auth/salir" method="post">
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

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="label inline-flex min-h-11 items-center text-graphite hover:text-ink"
    >
      {children}
    </Link>
  );
}
