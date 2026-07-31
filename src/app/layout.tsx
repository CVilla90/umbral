import type { Metadata } from "next";
import { Archivo, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BRAND, BRAND_NOTE } from "@/lib/site";

// Archivo (Omnibus-Type, Buenos Aires) — an industrial grotesque with scoreboard
// and jersey lineage, set heavy and tight. A Latin American face on a Mexican
// university instrument is a reason, not a default.
const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Karla keeps the instrument from reading clinical; its slightly odd lowercase is
// the warmth that makes a measurement feel like an invitation.
const body = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

// Utility face for anything that behaves like an engraved scale: tick labels,
// eyebrows, scores, timestamps.
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: `${BRAND} — ${BRAND_NOTE}`,
  description:
    "Medición de inglés al empezar y al terminar el semestre. Veinte minutos, sin calificación. Solo para cuentas @uach.mx de la Facultad de Ciencias de la Cultura Física.",
};

// The interface is in Spanish on purpose (PLAN §8): if the chrome were in English,
// a level-1 student would be handicapped before the measurement started. English
// appears only inside the items themselves.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink">{children}</body>
    </html>
  );
}
