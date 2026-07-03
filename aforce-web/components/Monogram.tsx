/**
 * The N–И monogram: a standard N, a Signal Red divider, and a horizontally
 * mirrored N. A quiet signature mark, never loud decoration.
 */
export default function Monogram({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center font-display leading-none select-none ${className}`}
      role="img"
      aria-label="AForce N–И monogram"
    >
      <span>N</span>
      <span
        aria-hidden="true"
        className="mx-[0.1em] inline-block h-[0.85em] w-px bg-[var(--color-signal)]"
      />
      <span aria-hidden="true" className="inline-block -scale-x-100">
        N
      </span>
    </span>
  );
}
