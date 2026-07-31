import Cinta from "@/components/Cinta";
import {
  BRAND,
  BYLINE,
  CONTACT_EMAIL,
  COPYRIGHT_YEAR,
  DEPARTMENT,
  EMAIL_DOMAIN,
  FACULTY,
  FACULTY_SHORT,
  MINUTES,
} from "@/lib/site";
import { CURRENT_SEMESTER, longDate } from "@/lib/calendar";

/**
 * The landing page has exactly one job: a student, usually on a phone, usually
 * sent here by their professor, presses one button. So it is a doorway, not a
 * marketing site — no feature grid, no testimonials, no FAQ. Everything above the
 * fold answers "is this for me, how long, does it hurt my grade".
 */
export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <TopBar />

      <main className="flex-1">
        <section className="pt-14 sm:pt-20">
          <p className="label anim-rise text-graphite">
            Inglés 1&ndash;4 &middot; {CURRENT_SEMESTER.label}
          </p>

          <h1
            className="font-display anim-rise mt-5 max-w-3xl text-[clamp(2.75rem,10vw,5.5rem)] leading-[0.94] font-extrabold text-balance"
            style={{ animationDelay: "0.08s" }}
          >
            Dos marcas,
            <br />
            un semestre.
          </h1>

          <p
            className="anim-rise mt-7 max-w-xl text-lg leading-relaxed text-graphite sm:text-xl"
            style={{ animationDelay: "0.16s" }}
          >
            Una medición cuando empiezas tu curso de inglés y otra cuando lo
            terminas. {MINUTES} minutos cada una, y no afecta tu calificación.
            Queremos saber cómo llegas y cómo sales.
          </p>

          <Cinta />

          <div
            className="anim-rise mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "0.24s" }}
          >
            <a
              href="/api/auth/google/start"
              className="font-display group inline-flex w-full items-center justify-center gap-3 rounded-[3px] bg-mark px-8 py-4 text-lg font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep sm:w-auto"
            >
              Entrar con tu correo @{EMAIL_DOMAIN}
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                &rarr;
              </span>
            </a>
            <p className="text-sm text-graphite">
              Solo cuentas de la {FACULTY_SHORT}.
            </p>
          </div>
        </section>

        <Facts />
        <WhatHappens />
        <PrivacyNote />
      </main>

      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-rule py-6">
      <span className="font-display text-xl font-extrabold tracking-tight">
        {BRAND}
      </span>
      <span className="label text-right text-graphite">
        {FACULTY_SHORT} &middot; <span className="hidden sm:inline">{DEPARTMENT}</span>
        <span className="sm:hidden">Inglés</span>
      </span>
    </header>
  );
}

/**
 * The three objections a student actually has, answered in their own order:
 * how long, does it count, how many times. "Sin reloj en pantalla" is doing real
 * work — the absence of a countdown is a deliberate design decision (PLAN §13)
 * and students read timers as threat.
 */
function Facts() {
  const facts = [
    {
      label: `${MINUTES} minutos`,
      body: "Una sola sentada, y sin reloj en pantalla. Si se te cae el internet, sigues donde te quedaste.",
    },
    {
      label: "Sin calificación",
      body: "Esto no te da ni te quita puntos. Cada profesor decide aparte si lo toma en cuenta.",
    },
    {
      label: "Dos veces",
      body: `La primera desde el ${longDate(CURRENT_SEMESTER.entryOpensAt)}, la segunda a partir del ${longDate(CURRENT_SEMESTER.exitOpensAt)}.`,
    },
  ];

  return (
    <section className="mt-24 grid gap-px overflow-hidden rounded-[3px] bg-rule sm:mt-32 sm:grid-cols-3">
      {facts.map((f) => (
        <div key={f.label} className="bg-paper-lift p-6 sm:p-7">
          <p className="label text-mark-deep">{f.label}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-graphite">{f.body}</p>
        </div>
      ))}
    </section>
  );
}

/**
 * Four blocks, labelled with how long each takes. The minutes are the real §3.2
 * budget, not filler — a label that encodes something true beats a decorative
 * 01/02/03, and here it also quietly proves the 20 minutes adds up.
 */
function WhatHappens() {
  const parts = [
    {
      minutes: "3 min",
      title: "Escuchar",
      body: "Audios cortos, de conversación normal. Los puedes repetir.",
    },
    {
      minutes: "3 min",
      title: "Leer",
      body: "Un texto breve y unas preguntas sobre lo que dice.",
    },
    {
      minutes: "5 min",
      title: "Escribir",
      body: "Frases y palabras sueltas. Nada de ensayos.",
    },
    {
      minutes: "3 min",
      title: "Hablar",
      body: "Grabas unos segundos de audio. Si no tienes micrófono, la puedes saltar.",
    },
  ];

  return (
    <section className="mt-24 sm:mt-32">
      <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
        Qué vas a hacer
      </h2>
      <p className="mt-3 max-w-lg text-graphite">
        Preguntas de opción, relacionar columnas, completar frases, y un par de
        respuestas habladas. Todo en inglés de tu nivel.
      </p>

      <ul className="mt-9 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.title} className="border-t border-ink pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl font-bold">{p.title}</h3>
              <span className="label text-graphite">{p.minutes}</span>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-graphite">
              {p.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrivacyNote() {
  return (
    <section className="mt-24 rounded-[3px] border border-rule bg-card p-6 sm:mt-32 sm:p-8">
      <p className="label text-graphite">Qué hacemos con tus respuestas</p>
      <p className="mt-3 max-w-2xl leading-relaxed">
        Las usamos para entender cómo avanza cada grupo y cada nivel a lo largo del
        semestre. Los reportes que salen de aquí son agregados: nadie publica tu
        nombre ni tu resultado individual. Antes de empezar te pedimos tu
        consentimiento y te explicamos esto otra vez, con calma.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-rule py-8 sm:mt-32">
      <div className="flex flex-col gap-4 text-sm text-graphite sm:flex-row sm:items-center sm:justify-between">
        <p>
          {FACULTY} &middot; {DEPARTMENT}
        </p>
        <p>
          {BYLINE} &middot;{" "}
          <a className="underline underline-offset-2 hover:text-ink" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          &middot; {COPYRIGHT_YEAR}
        </p>
      </div>
    </footer>
  );
}
