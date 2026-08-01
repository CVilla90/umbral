import type { Metadata, Viewport } from "next";
import { Archivo, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/auth/google";
import { BRAND, BRAND_NOTE, FACULTY, UNIVERSITY } from "@/lib/site";

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

const DESCRIPTION =
  "Medición de inglés al empezar y al terminar el semestre. Veinte minutos, sin calificación. Solo para cuentas @uach.mx de la Facultad de Ciencias de la Cultura Física.";

export const metadata: Metadata = {
  // Absolute base for the OG image and icons. Relative URLs in a link preview
  // are resolved by the *scraper*, not the browser, and WhatsApp will simply
  // drop an image it cannot resolve — so this has to be the real origin.
  metadataBase: new URL(appUrl()),
  title: {
    default: `${BRAND} — ${BRAND_NOTE}`,
    template: `%s · ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  authors: [{ name: "Carlos Villa" }],
  // The instrument is institutional, not commercial; `publisher` is where a
  // student's browser looks to see who is actually behind the page.
  publisher: `${FACULTY}, ${UNIVERSITY}`,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: BRAND,
    title: `${BRAND} — ${BRAND_NOTE}`,
    description: DESCRIPTION,
  },
  // No Twitter card of its own: the OG tags already cover it, and a second
  // source of the same strings is a second thing to keep in step.
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  // Matches `--color-paper`, so the phone's chrome does not flash a white or
  // black band around a page that is neither.
  themeColor: "#f1f3ef",
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
