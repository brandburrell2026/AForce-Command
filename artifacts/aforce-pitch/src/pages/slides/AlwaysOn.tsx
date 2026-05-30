import Wordmark from "@/components/Wordmark";
import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";

const SLIDE = 2;

const PERSONAS = ["Founders", "Athletes", "Operators", "Creators"];

export default function AlwaysOn() {
  const { index, name } = sectionFor(SLIDE);
  const topLabel = `Section ${index} — ${name}`;
  const pageLabel = `${String(SLIDE).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* TOP CHROME — wordmark + patent badge */}
      <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] z-20 flex justify-between items-start pointer-events-none">
        <Wordmark className="h-[1.5vw]" />
        <div className="uppercase tracking-[0.22em] text-[0.62vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
          Patent-Protected
        </div>
      </div>

      {/* BODY — split: statement left, audience ledger right */}
      <div className="absolute inset-0 z-10 grid grid-cols-[1.05fr_0.95fr] gap-[5vw] px-[5vw] pt-[20vh] pb-[12vh]">
        {/* LEFT — eyebrow + headline + support */}
        <div className="flex flex-col">
          <div className="mb-[5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              Who We Serve
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.2vw] leading-[1.02] text-text">
            <div>Built for people</div>
            <div>who don't get</div>
            <div className="text-red font-normal">to be off.</div>
          </h1>

          <p className="mt-auto max-w-[26vw] font-body text-[1.1vw] leading-[1.55] text-text/70 font-normal">
            People whose performance matters every single day.
          </p>
        </div>

        {/* RIGHT — numbered audience ledger */}
        <div className="flex flex-col justify-center">
          {PERSONAS.map((persona, i) => (
            <div
              key={persona}
              className={`flex items-baseline gap-[1.6vw] py-[2.4vh] ${
                i === 0 ? "border-y" : "border-b"
              } border-text/15`}
            >
              <span className="font-display font-light tabular-nums text-[1.1vw] text-text/35 w-[3vw] shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display font-light tracking-[-0.02em] text-[2.9vw] leading-none text-text">
                {persona}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM CHROME — footer */}
      <div className="absolute bottom-[5vh] left-[5vw] right-[5vw] z-20 pt-[2.2vh] border-t border-text/15 flex justify-between items-end gap-[2vw]">
        <div className="flex flex-col gap-[1vh] min-w-0">
          <div className="font-body uppercase tracking-[0.28em] text-[0.6vw] text-text/50 font-medium whitespace-nowrap">
            Confidential · For discussion purposes only
          </div>
          <div className="font-body uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold whitespace-nowrap">
            {topLabel} · Phase 1 — Proof of Concept
          </div>
        </div>
        <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-medium tabular-nums shrink-0">
          {pageLabel}
        </div>
      </div>
    </div>
  );
}
