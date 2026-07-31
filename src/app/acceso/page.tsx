import Link from "next/link";
import { BRAND, EMAIL_DOMAIN, FACULTY_SHORT } from "@/lib/site";

/**
 * Every way sign-in can fail, in the interface's own voice.
 *
 * The common case by far is a student who tapped "Continue with Google" and
 * picked their personal Gmail out of the account chooser. That is not an error
 * they made, it is an account they picked, so the page says what to do next
 * instead of scolding — and the retry button forces the chooser again.
 */

const REASONS: Record<string, { title: string; body: string; retry: boolean }> = {
  dominio: {
    title: `Esa cuenta no es de ${EMAIL_DOMAIN}`,
    body: `Entraste con una cuenta personal. Umbral solo acepta el correo institucional que termina en @${EMAIL_DOMAIN} — es la forma de saber que eres de la ${FACULTY_SHORT}. Vuelve a intentarlo y elige tu cuenta de la universidad en la lista.`,
    retry: true,
  },
  cancelado: {
    title: "Cancelaste el inicio de sesión",
    body: "No pasó nada. Cuando quieras entrar, vuelve a intentarlo.",
    retry: true,
  },
  estado: {
    title: "El enlace ya no era válido",
    body: "Pasó demasiado tiempo entre que abriste la página y elegiste tu cuenta, o llegaste aquí desde un enlace viejo. Empieza de nuevo.",
    retry: true,
  },
  google: {
    title: "Google no respondió",
    body: "No pudimos confirmar tu cuenta con Google. Suele ser pasajero: espera un momento y vuelve a intentarlo.",
    retry: true,
  },
  incompleto: {
    title: "Faltó información en la respuesta",
    body: "El regreso desde Google llegó incompleto. Empieza el acceso otra vez.",
    retry: true,
  },
  "sin-configurar": {
    title: "El acceso todavía no está configurado",
    body: "Umbral aún no tiene sus credenciales de Google en este servidor. No es algo que puedas resolver desde aquí — avisa a la Coordinación de Inglés.",
    retry: false,
  },
};

const FALLBACK = {
  title: "No pudimos iniciar tu sesión",
  body: "Algo se interrumpió en el camino. Vuelve a intentarlo.",
  retry: true,
};

export default async function Acceso({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const reason = (motivo && REASONS[motivo]) || FALLBACK;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <header className="border-b border-rule py-6">
        <Link href="/" className="font-display text-xl font-extrabold tracking-tight">
          {BRAND}
        </Link>
      </header>

      <main className="flex flex-1 items-center py-16">
        <div className="max-w-xl">
          {/* A stopped mark: the instrument's own vocabulary for "this did not
              take a measurement", rather than a generic warning triangle. */}
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-3 w-3 rounded-[2px] bg-mark" />
            <span className="h-px flex-1 bg-rule" />
          </div>

          <h1 className="font-display mt-8 text-4xl leading-tight font-extrabold sm:text-5xl">
            {reason.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-graphite">{reason.body}</p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            {reason.retry && (
              <a
                href="/api/auth/google/start"
                className="font-display inline-flex items-center gap-3 rounded-[3px] bg-mark px-7 py-3.5 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep"
              >
                Intentar de nuevo
              </a>
            )}
            <Link
              href="/"
              className="text-sm text-graphite underline underline-offset-4 hover:text-ink"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
