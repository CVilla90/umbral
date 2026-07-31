/**
 * Descriptive statistics for the dashboard.
 *
 * Pure functions over plain numbers, deliberately: the numbers this instrument
 * produces will end up in a thesis or a faculty meeting, and every one of them
 * has to be defensible and reproducible. Anything computed inline inside a React
 * component is neither testable nor quotable.
 */

export interface Summary {
  n: number;
  mean: number | null;
  /** Sample standard deviation (n−1). Null when n < 2. */
  sd: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

export const EMPTY_SUMMARY: Summary = {
  n: 0,
  mean: null,
  sd: null,
  median: null,
  min: null,
  max: null,
};

/**
 * ⚠️ **Sample SD (n−1), not population SD (n).** These students are a sample of
 * the cohort we want to describe, not the entire population, and n is small
 * enough per group that the difference is visible rather than academic — at
 * n = 10 the population formula understates spread by about 5 %.
 *
 * ⚠️ **n < 2 yields `null`, never 0.** A single student has no spread, and
 * printing "0" would read as "everyone scored identically" rather than "we can't
 * say". Same reasoning as the participation percentage in `exports.ts`: the
 * honest answer to an unanswerable question is nothing, not a number.
 */
export function describe(values: number[]): Summary {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return EMPTY_SUMMARY;

  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd =
    n < 2
      ? null
      : Math.sqrt(xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n - 1));

  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];

  return { n, mean, sd, median, min: xs[0], max: xs[n - 1] };
}

/**
 * Percentage of a raw score, or null when the denominator is missing.
 *
 * ⚠️ `maxTotal` is stored **per attempt**, so an attempt taken when the
 * instrument was 34 points is scored out of 34 forever. Never divide by a
 * constant here — that would retroactively rescale historical attempts and
 * silently corrupt the one comparison this whole project exists to make.
 */
export function pct(raw: number | null, max: number | null): number | null {
  if (raw === null || max === null || max <= 0) return null;
  return (raw / max) * 100;
}

/**
 * Counts per fixed-width bin across 0–100.
 *
 * Bin edges are half-open `[lo, hi)` except the last, which includes 100 — so a
 * perfect score lands in the top bin instead of falling off the end.
 */
export function histogram(values: number[], binCount = 10): number[] {
  const bins = new Array<number>(binCount).fill(0);
  const width = 100 / binCount;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const clamped = Math.min(100, Math.max(0, v));
    const i = clamped === 100 ? binCount - 1 : Math.floor(clamped / width);
    bins[i] += 1;
  }
  return bins;
}

/**
 * Pearson correlation, or null when it is undefined.
 *
 * Undefined here is not an edge case to paper over: if every student scored the
 * same on an item, that item has no variance and its correlation with anything
 * is genuinely undefined, not zero. Returning 0 would print "this item does not
 * discriminate" — a real finding — for what is actually "we cannot tell yet".
 */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;

  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Group items by a derived key, preserving first-seen order. */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** One decimal, or an em dash — so a table never prints "null" or "NaN". */
export function fmt1(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(1);
}
