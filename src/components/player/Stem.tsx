/**
 * The question text itself. Its own module only so that `Question` and `Speaking`
 * can both use it without importing each other in a cycle.
 */
export default function Stem({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-xl leading-snug font-bold sm:text-2xl">{children}</p>
  );
}
