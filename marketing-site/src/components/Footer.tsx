import Monogram from "./Monogram";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
        <Monogram className="text-3xl text-bone" />
        <p className="font-display text-lg tracking-[-0.01em] text-bone">
          Performance Is Non-Negotiable.
        </p>
        <p className="max-w-xs font-mono text-[11px] leading-relaxed tracking-[0.16em] text-bone/40 uppercase">
          Composure before performance
        </p>

        <div className="mt-4 flex w-full flex-col items-center gap-3 border-t border-white/[0.06] pt-8 sm:flex-row sm:justify-between">
          <span className="font-mono text-[11px] tracking-[0.16em] text-bone/40 uppercase">
            AForce Hydration, Inc.
          </span>
          <span className="font-mono text-[11px] tracking-[0.16em] text-bone/30 uppercase">
            © {new Date().getFullYear()} · All rights reserved
          </span>
        </div>
      </div>
    </footer>
  );
}
