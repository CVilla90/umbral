/**
 * Brand and institutional strings — the single source of truth, so renaming the
 * product is a one-line change here rather than a hunt.
 *
 * `umbral.replit.app` may collide (Umbral is also an Ethereum privacy protocol);
 * the agreed fallbacks are Delta, Pulso and Cota (PLAN §11).
 */

export const BRAND = "Umbral";

/** Said once, on the landing page, under the wordmark. */
export const BRAND_NOTE = "Medición de inglés · entrada y salida";

export const FACULTY = "Facultad de Ciencias de la Cultura Física";
export const FACULTY_SHORT = "FCCF";
export const UNIVERSITY = "Universidad Autónoma de Chihuahua";
export const DEPARTMENT = "Coordinación de Inglés";

/** Umbrella byline for Carlos's free UACH tools. Quiet footer, never a header. */
export const BYLINE = "CV Labs for Education";
export const CONTACT_EMAIL = "cavilla@uach.mx";
export const COPYRIGHT_YEAR = 2026;

/** Sign-in is restricted to this domain, server-side. */
export const EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "uach.mx";

/** Minutes, as promised to the student. Keep it honest — §3.2 budgets to this. */
export const MINUTES = 20;
