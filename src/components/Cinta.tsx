import { CURRENT_SEMESTER, monthTicks, semesterDays, pctOfSemester } from "@/lib/calendar";

/**
 * `la cinta` — the signature element.
 *
 * A measuring tape whose scale is the actual semester: day ticks, month labels,
 * two marks where the check-ins happen, and the span between them. It is the
 * whole product in one object, it needs no data to be truthful, and it doubles as
 * the schedule — a student reading it learns when the windows are.
 *
 * The audience is Ciencias de la Cultura Física, where "measure at preseason,
 * train, measure again" is already the native way of thinking about progress.
 * This is that idea, drawn.
 *
 * Two details carry it, and both are load-bearing rather than decorative:
 *
 *  - The full-width hairline is the axis the measurement is read against. Without
 *    it the blue band is just a bar; with it the band is visibly *a portion of the
 *    semester*, which is the actual claim.
 *  - Tick density. At one tick per week the tape read as a progress bar. Every two
 *    days, with a longer tick each week, is what makes the eye call it an
 *    instrument.
 *
 * Motion is a single orchestrated load sequence — tape, ticks, mark, mark, span —
 * with the marks overshooting and settling like a needle on a gauge. Nothing else
 * on the page moves on load, so this reads as the instrument coming to rest.
 * Every element carries its final geometry, so reduced-motion users get the
 * finished tape with the animation stripped (see globals.css).
 */

// Illustrative marks: a student who checks in during week two and checks out in
// early November. Derived from the real calendar so they can never drift outside
// the windows they depict.
const ENTRY_AT = pctOfSemester("2026-08-21");
const EXIT_AT = pctOfSemester("2026-11-06");

const TICK_EVERY_DAYS = 2;
const MAJOR_EVERY_DAYS = 14;

export default function Cinta() {
  const months = monthTicks();
  const days = semesterDays();
  const ticks = Array.from(
    { length: Math.floor(days / TICK_EVERY_DAYS) + 1 },
    (_, i) => {
      const day = i * TICK_EVERY_DAYS;
      return { pct: (day / days) * 100, major: day % MAJOR_EVERY_DAYS === 0 };
    },
  );

  return (
    <figure className="mt-11 sm:mt-12">
      {/* Month labels ride above the tape, aligned to their gridline. */}
      <div className="relative h-4 anim-fade" style={{ animationDelay: "0.55s" }}>
        {months.map((m) => (
          <span
            key={m.label}
            className="label absolute top-0 text-graphite"
            style={{
              left: `${m.pct}%`,
              transform: m.pct === 0 ? "none" : "translateX(-50%)",
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="relative mt-2 h-[4.25rem] select-none sm:h-[4.75rem]">
        {/* The tape body. */}
        <div
          className="anim-tape absolute inset-0 rounded-[3px] bg-card ring-1 ring-rule"
          style={{ animationDelay: "0.1s" }}
        />

        {/* The scale: ticks hanging from the top edge. */}
        <div
          className="anim-fade pointer-events-none absolute inset-x-0 top-0"
          style={{ animationDelay: "0.5s" }}
        >
          {ticks.map((t) => (
            <span
              key={t.pct}
              className="absolute top-0 w-px"
              style={{
                left: `${t.pct}%`,
                height: t.major ? "17px" : "8px",
                background: t.major ? "var(--color-graphite)" : "var(--color-rule)",
              }}
            />
          ))}
        </div>

        {/* The axis the blue band is read against: dotted for the part of the
            semester that isn't measured, solid for the part that is. A solid
            hairline here read as a second box edge and split the tape in two. */}
        <div
          className="anim-tape absolute inset-x-0 h-px"
          style={{
            top: "64%",
            animationDelay: "0.4s",
            backgroundImage:
              "repeating-linear-gradient(to right, var(--color-rule) 0 3px, transparent 3px 8px)",
          }}
        />

        {/* The span: the number this instrument exists to produce. */}
        <div
          className="anim-span absolute h-2.5 rounded-full bg-span"
          style={{
            left: `${ENTRY_AT}%`,
            width: `${EXIT_AT - ENTRY_AT}%`,
            top: "calc(64% - 5px)",
            animationDelay: "1.5s",
          }}
        />

        {/* Sits on top of the band it names, not stranded under the tape where it
            would form a third row of labels competing with the two marks. */}
        <span
          className="label anim-fade absolute whitespace-nowrap text-span"
          style={{
            left: `${(ENTRY_AT + EXIT_AT) / 2}%`,
            transform: "translateX(-50%)",
            top: "26%",
            animationDelay: "2s",
          }}
        >
          tu avance
        </span>

        {/* The two marks. Chalk on tape: a squared head over a heavy stem. */}
        <Mark pct={ENTRY_AT} label="entrada" delay="0.75s" />
        <Mark pct={EXIT_AT} label="salida" delay="1.15s" />
      </div>

      <figcaption className="mt-12 text-sm text-graphite">
        El semestre completo, de {CURRENT_SEMESTER.label.toLowerCase()}. Te medimos
        dos veces y la diferencia es tuya.
      </figcaption>
    </figure>
  );
}

function Mark({ pct, label, delay }: { pct: number; label: string; delay: string }) {
  return (
    <div
      className="anim-mark absolute inset-y-0 flex flex-col items-center"
      style={{ left: `${pct}%`, animationDelay: delay }}
    >
      <span className="h-3 w-3 rounded-[2px] bg-mark" />
      <span className="w-[3px] flex-1 bg-mark" />
      <span className="label absolute top-full mt-2 whitespace-nowrap text-mark-deep">
        {label}
      </span>
    </div>
  );
}
