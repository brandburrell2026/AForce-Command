import SlideChrome from "@/components/SlideChrome";

const FUTURE = [
  "National expansion",
  "Premium retail",
  "Larger subscription base",
  "Deeper ecosystem engagement",
  "Predictive intelligence",
  "Enterprise / team systems",
  "Wearable integrations",
  "Performance identity / community",
];

export default function TheFuture() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={30}>
      <div className="absolute inset-y-0 right-0 w-[48vw] flex items-center justify-center overflow-hidden">
        <div
          className="absolute w-[36vw] h-[36vw] rounded-full opacity-50 blur-[7vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(84,120,213,0.55) 0%, rgba(182,255,0,0.18) 45%, transparent 72%)",
          }}
        />
        <img
          src={`${base}phantom-hero.png`}
          alt=""
          className="relative max-h-[80vh] max-w-[42vw] object-contain opacity-85"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(84,120,213,0.25))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[58vw] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--slide-bg) 60%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh] pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Future
        </div>

        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter mb-[2vh] max-w-[50vw]">
          Once proof is established
          <span className="text-text/40">…</span>
        </h2>

        <div className="mt-[3vh] max-w-[48vw] grid grid-cols-2 gap-y-[0.9vh] gap-x-[2vw]">
          {FUTURE.map((f, i) => (
            <div
              key={f}
              className="flex items-baseline gap-[0.8vw] border-t border-text/15 pt-[0.8vh]"
            >
              <div className="font-body text-[0.7vw] text-text/35 tabular-nums uppercase tracking-[0.25em]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-[1.2vw] leading-[1.15] tracking-tight text-text/90">
                {f}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[5vh] font-display text-[2vw] leading-[1.1] tracking-tight">
          <span className="text-text/55">But first:</span>{" "}
          <span className="text-primary">Prove the ritual.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
