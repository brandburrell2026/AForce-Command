import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";
import Wordmark from "@/components/Wordmark";

const MANTRA = ["Pause", "Hydrate", "Lock In", "Perform"];

export default function NonNegotiable() {
  const base = import.meta.env.BASE_URL;
  const slide = 1;
  const { index, name } = sectionFor(slide);
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* ───────── MASTHEAD ───────── */}
      <div className="absolute top-[5vh] left-[5vw] right-[5vw] z-20 flex items-start justify-between">
        <Wordmark className="h-[2.2vw]" />
        <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
          Patent-Protected
        </div>
      </div>

      {/* ───────── RIGHT — inset framed editorial figure (full image) ───────── */}
      <div className="absolute top-[11vh] bottom-[8vh] right-[4vw] aspect-[1196/1438] max-w-[45%] z-0">
        <img
          src={`${base}images/bg/16-silence-hooded3.png`}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* ───────── LEFT — cover lines (vertically centered) ───────── */}
      <div className="absolute inset-y-0 left-[5vw] w-[44%] flex flex-col justify-center z-10">
        {/* eyebrow + red underline */}
        <div className="mb-[3.5vh]">
          <span className="font-body uppercase tracking-[0.42em] text-[0.78vw] text-text/65 font-semibold">
            The Silence
          </span>
          <div className="mt-[1.4vh] h-[2px] w-[2.6vw] bg-red" />
        </div>

        {/* headline — bold sans, accent in red */}
        <h1 className="font-display font-extrabold tracking-[-0.02em] text-[5.4vw] leading-[0.98] text-text">
          <span className="block whitespace-nowrap">Performance is</span>
          <span className="block whitespace-nowrap text-red">non-negotiable.</span>
        </h1>

        {/* standfirst */}
        <p className="mt-[4vh] max-w-[30vw] font-body text-[1.32vw] leading-[1.5] text-text/60">
          It is decided in the quiet, long before the moment ever demands it.
        </p>

        {/* mantra tracker */}
        <div className="mt-[5vh] flex items-center gap-[1.1vw]">
          {MANTRA.map((step, i) => (
            <div key={step} className="flex items-center gap-[1.1vw]">
              <span
                className={`font-body uppercase tracking-[0.3em] text-[0.72vw] font-semibold ${
                  i === 0 ? "text-red" : "text-text/35"
                }`}
              >
                {step}
              </span>
              {i < MANTRA.length - 1 && (
                <span className="text-text/20 text-[0.72vw]">—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ───────── FOOTER ───────── */}
      <div className="absolute bottom-[5vh] left-[5vw] right-[5vw] z-20 pt-[2.2vh] border-t border-text/15 flex justify-between items-end gap-[2vw]">
        <div className="flex flex-col gap-[1vh] min-w-0">
          <div className="font-body uppercase tracking-[0.28em] text-[0.6vw] text-text/50 font-medium whitespace-nowrap">
            Confidential · For discussion purposes only
          </div>
          <div className="font-body uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold whitespace-nowrap">
            Section {index} — {name} · Phase 1 — Proof of Concept
          </div>
        </div>
        <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-medium tabular-nums shrink-0">
          {pageLabel}
        </div>
      </div>
    </div>
  );
}
