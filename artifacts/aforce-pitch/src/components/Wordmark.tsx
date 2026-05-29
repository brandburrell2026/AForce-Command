interface WordmarkProps {
  /** Tailwind height utility, e.g. "h-[1.5vw]". Width scales automatically. */
  className?: string;
}

/**
 * The official AFORCE wordmark, rendered from the brand artwork rather than
 * set in a typeface so the custom cut letterforms stay exact across the deck.
 */
export default function Wordmark({ className = "h-[1.5vw]" }: WordmarkProps) {
  const base = import.meta.env.BASE_URL;
  return (
    <img
      src={`${base}images/brand/aforce-wordmark-red.png`}
      alt="AForce"
      draggable={false}
      className={`block w-auto select-none ${className}`}
    />
  );
}
