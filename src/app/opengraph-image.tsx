import { ImageResponse } from "next/og";
import { BRAND, FACULTY_SHORT, UNIVERSITY, MINUTES } from "@/lib/site";

/**
 * The card that renders when the link is pasted into WhatsApp, which is how
 * students actually receive it. Without one, the link previews as a bare URL on
 * an unfamiliar `.replit.app` domain — and a student being asked to sign in with
 * their institutional account has every reason to distrust that.
 *
 * Deliberately no custom font. Loading Archivo here would mean a network fetch
 * at build time, and a build that can fail for a decorative reason is a bad
 * trade against a card that reads perfectly well in the default grotesque. The
 * brand carries on colour and layout instead.
 *
 * Satori (which renders this) supports a subset of CSS: flex only, no grid, and
 * every element with more than one child needs an explicit `display: flex`.
 */

export const alt = `${BRAND} — medición de inglés de entrada y salida, ${UNIVERSITY}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#101a24";
const PAPER = "#f1f3ef";
const MARK = "#ff5a1f";
const GRAPHITE = "#8c9aa6";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          padding: "72px 80px",
        }}
      >
        {/* Eyebrow — the institution, stated before the product name, because the
            first question a student has about this link is whether it is real. */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: "0.18em",
            color: GRAPHITE,
            textTransform: "uppercase",
          }}
        >
          {UNIVERSITY} · {FACULTY_SHORT}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 148,
              fontWeight: 800,
              color: PAPER,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {BRAND}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              color: PAPER,
              opacity: 0.8,
              marginTop: 24,
            }}
          >
            Medición de inglés · entrada y salida
          </div>
        </div>

        {/* La cinta: two marks and the span between them — the same figure as the
            favicon and the landing hero, so the card, the tab and the page agree. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 64,
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 64, background: MARK }} />
            <div style={{ display: "flex", flexGrow: 1, height: 8, background: "#2a3a49" }} />
            <div style={{ display: "flex", width: 12, height: 64, background: MARK }} />
          </div>
          <div style={{ display: "flex", fontSize: 30, color: GRAPHITE }}>
            {MINUTES} minutos · sin calificación · cuentas @uach.mx
          </div>
        </div>
      </div>
    ),
    size,
  );
}
