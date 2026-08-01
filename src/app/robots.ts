import type { MetadataRoute } from "next";

/**
 * The landing page is public and may be indexed — it explains the instrument to
 * students and professors, and a searchable explanation is a small defence
 * against "is this link real?".
 *
 * Everything behind sign-in is disallowed. Not as a security measure — the
 * session check is that, and `robots.txt` binds nobody — but because indexed
 * item content would be a genuine problem: a question that can be found by
 * searching its own text stops measuring English and starts measuring search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/acceso",
        "/inicio",
        "/ficha",
        "/prueba",
        "/resultado",
        "/admin",
        "/api",
      ],
    },
  };
}
