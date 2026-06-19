export const PROJECTION_DISCLAIMER =
  "Projected targets based on comparable subscription wellness brands, industry benchmarks, vendor quotations, management assumptions, and commercialization models. Actual results may vary materially.";

/**
 * Standardized lender-grade projection disclaimer. Single source of the exact
 * verbatim footnote text and the deck's institutional fine-print style. Pass
 * positioning utilities (in-flow margins or absolute placement) via `className`.
 */
export default function ProjectionDisclaimer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p
      className={`font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] ${className}`}
    >
      {PROJECTION_DISCLAIMER}
    </p>
  );
}
