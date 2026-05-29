import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";

const MANTRA = ["Pause", "Hydrate", "Lock In", "Perform"];

export default function NonNegotiable() {
  const base = import.meta.env.BASE_URL;
  const slide = 1;
  const { index, name } = sectionFor(slide);
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* ───────── RIGHT — cinematic full-bleed figure ───────── */}
      <div className="absolute inset-y-0 right-0 w-[56%]">
        <img
          src={`${base}images/bg/16-silence-figure.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{
            objectPosition: "62% center",
            filter: "contrast(1.14) brightness(0.92)",
          }}
        />
        {/* depth: darken the far right edge for cinematic falloff */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5) 100%)",
          }}
        />
        {/* top + bottom vignette */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 76%, rgba(0,0,0,0.42) 100%)",
          }}
        />
        {/* ghosted issue numeral — embossed onto the dark image */}
        <div
          aria-hidden
          className="absolute bottom-[6vh] right-[3.5vw] font-display italic leading-none text-white/[0.07] select-none"
          style={{ fontSize: "11vw" }}
        >
          01
        </div>
        {/* soft gradient bleed into cream so the seam disappears */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[12vw] pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(244,241,234,1) 0%, rgba(244,241,234,0.55) 45%, rgba(244,241,234,0) 100%)",
          }}
        />
      </div>

      {/* ───────── MASTHEAD ───────── */}
      <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] z-20 flex items-start justify-between">
        <div className="font-display font-semibold text-[3vw] leading-none tracking-[-0.01em] text-red">
          AForce
        </div>
        <div className="flex flex-col items-end gap-[1vh] pt-[0.6vh]">
          <div className="font-body uppercase tracking-[0.34em] text-[0.62vw] text-text/55 font-medium">
            The Performance Issue · Vol. 01
          </div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
            Patent-Protected
          </div>
        </div>
      </div>
      {/* masthead hairline rule */}
      <div className="absolute top-[12vh] left-[5vw] w-[45%] h-px bg-text/20 z-20" />

      {/* ───────── LEFT — cover lines ───────── */}
      <div className="absolute inset-y-0 left-0 w-[50%] flex flex-col px-[5vw] pt-[18vh] pb-[5vh] z-10">
        {/* eyebrow with red tick */}
        <div className="flex items-center gap-[0.9vw] mb-[3.5vh]">
          <span className="block h-[1.6vh] w-[2px] bg-red" />
          <span className="font-body uppercase tracking-[0.42em] text-[0.72vw] text-text/60 font-semibold">
            The Silence
          </span>
        </div>

        {/* headline — high-contrast serif */}
        <h1 className="font-display font-normal tracking-[0.005em] text-[5.6vw] leading-[0.98] text-text">
          <span className="block whitespace-nowrap">Performance is</span>
          <span className="block whitespace-nowrap text-red italic font-medium">
            non-negotiable.
          </span>
        </h1>

        {/* standfirst — serif italic */}
        <p className="mt-[4vh] max-w-[31vw] font-display italic text-[1.5vw] leading-[1.45] text-text/70">
          It is decided in the quiet, long before the moment ever demands it.
        </p>

        {/* mantra tracker */}
        <div className="mt-[4.5vh] flex items-center gap-[1.1vw]">
          {MANTRA.map((step, i) => (
            <div key={step} className="flex items-center gap-[1.1vw]">
              <span
                className={`font-body uppercase tracking-[0.28em] text-[0.7vw] font-semibold ${
                  i === 0 ? "text-red" : "text-text/35"
                }`}
              >
                {step}
              </span>
              {i < MANTRA.length - 1 && (
                <span className="text-text/20 text-[0.7vw]">→</span>
              )}
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="mt-auto pt-[2.4vh] border-t border-text/20 flex justify-between items-end gap-[2vw]">
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
    </div>
  );
}
