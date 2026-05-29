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
        {/* ghosted index numeral — embossed onto the dark image */}
        <div
          aria-hidden
          className="absolute top-[7vh] right-[3.5vw] font-display font-extrabold leading-none text-white/[0.06] select-none"
          style={{ fontSize: "13vw" }}
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

      {/* hairline seam */}
      <div
        aria-hidden
        className="absolute inset-y-[10vh] left-[44%] w-px bg-text/[0.08] z-[5]"
      />

      {/* ───────── LEFT — editorial typography ───────── */}
      <div className="absolute inset-y-0 left-0 w-[50%] flex flex-col px-[5vw] pt-[15vh] pb-[5vh] z-10">
        {/* eyebrow with red tick */}
        <div className="flex items-center gap-[0.9vw] mb-[5vh]">
          <span className="block h-[1.6vh] w-[3px] bg-red" />
          <span className="font-display uppercase tracking-[0.4em] text-[0.78vw] text-text/70 font-semibold">
            The Silence
          </span>
        </div>

        {/* headline */}
        <h1 className="font-display font-light tracking-[-0.03em] text-[5.3vw] leading-[1.0] text-text">
          <span className="block whitespace-nowrap">Performance is</span>
          <span className="block whitespace-nowrap text-red font-normal">
            non-negotiable.
          </span>
        </h1>

        {/* support */}
        <p className="mt-[4.5vh] max-w-[30vw] font-display text-[1.25vw] leading-[1.55] text-text/65 font-normal">
          It is decided in the quiet — long before the moment ever demands it.
        </p>

        {/* mantra tracker */}
        <div className="mt-[4.5vh] flex items-center gap-[1.1vw]">
          {MANTRA.map((step, i) => (
            <div key={step} className="flex items-center gap-[1.1vw]">
              <span
                className={`font-display uppercase tracking-[0.28em] text-[0.72vw] font-semibold ${
                  i === 0 ? "text-red" : "text-text/35"
                }`}
              >
                {step}
              </span>
              {i < MANTRA.length - 1 && (
                <span className="text-text/20 text-[0.72vw]">→</span>
              )}
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="mt-auto pt-[2.4vh] border-t border-text/20 flex justify-between items-end gap-[2vw]">
          <div className="flex flex-col gap-[1vh] min-w-0">
            <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text/50 font-medium whitespace-nowrap">
              Confidential · For discussion purposes only
            </div>
            <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold whitespace-nowrap">
              Section {index} — {name} · Phase 1 — Proof of Concept
            </div>
          </div>
          <div className="font-display uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-medium tabular-nums shrink-0">
            {pageLabel}
          </div>
        </div>
      </div>

      {/* ───────── TOP CHROME — wordmark + patent badge ───────── */}
      <div className="absolute top-[4.5vh] left-[5vw] z-20 flex flex-col items-start gap-[1.4vh] pointer-events-none">
        <div className="font-display font-extrabold tracking-tight text-[1.4vw] text-red leading-none">
          AForce
        </div>
        <div className="uppercase tracking-[0.22em] text-[0.62vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
          Patent-Protected
        </div>
      </div>
    </div>
  );
}
