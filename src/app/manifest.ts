import type { MetadataRoute } from "next";
import { BRAND, BRAND_NOTE, FACULTY, UNIVERSITY } from "@/lib/site";

/**
 * Web app manifest — metadata only. Umbral is NOT a PWA and deliberately has no
 * service worker; see `PLAN.md §16` for what one would have to respect before it
 * could be. Without a service worker Chrome will not raise an install prompt, so
 * this file cannot accidentally promise an offline experience that does not
 * exist. What it does do is give the name, colours and icon that Android and iOS
 * use if a student adds the page to their home screen anyway.
 *
 * `icons` points at `/icon.svg` in `public/` rather than the App Router's
 * `src/app/icon.svg`, which Next serves from a content-hashed path that a static
 * manifest cannot name. Real installability additionally needs 192px and 512px
 * PNGs — a task for the PWA phase, not a gap to paper over here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} — ${BRAND_NOTE}`,
    short_name: BRAND,
    description: `Medición de inglés de entrada y salida. ${FACULTY}, ${UNIVERSITY}.`,
    start_url: "/",
    display: "standalone",
    lang: "es",
    // Both `--color-paper`, and both matching the `viewport.themeColor` in
    // `layout.tsx`: the page ground is paper, so a dark chrome or splash would
    // be a flash of a colour the app never actually shows.
    background_color: "#f1f3ef",
    theme_color: "#f1f3ef",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
