import SlideChrome from "@/components/SlideChrome";

const REASONS = [
  "Supports hydration efficiency",
  "Maintains mineral balance",
  "Reduces stress-driven acidity",
  "Sustains performance, not spikes",
  "Cleaner, more stable than stimulants",
];

export default function WhyAlkaline() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={9}>
      <div className="absolute inset-y-0 right-[2vw] w-[40vw] flex items-center justify-center">
        <div
          className="absolute w-[32vw] h-[32vw] rounded-full opacity-55 blur-[6vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(84,120,213,0.65) 0%, rgba(84,120,213,0.18) 45%, transparent 72%)",
          }}
        />
        <div
          className="absolute bottom-[12vh] w-[20vw] h-[2.5vh] rounded-[50%] blur-[2vw] opacity-65"
          style={{
            background:
              "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)",
          }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[72vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(84,120,213,0.35))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[58vw] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--slide-bg) 70%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Why Alkaline
        </div>
        <div className="font-display text-[2.6vw] leading-[1] tracking-tight text-text mb-[1vh]">
          AForce stands for
        </div>
        <h2 className="font-display text-[5.4vw] leading-[0.9] tracking-tighter">
          <span className="text-primary">Alkaline</span>
          <br />
          Force.
        </h2>

        <div className="mt-[4vh] flex items-baseline gap-[1.5vw] border-l-2 border-primary/40 pl-[1.5vw]">
          <div className="font-display text-[4vw] leading-none tracking-tighter text-text">8.8</div>
          <div className="font-display text-[1.4vw] tracking-tight text-text/55">pH</div>
        </div>

        <div className="mt-[4vh] max-w-[42vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
            Why it matters
          </div>
          {REASONS.map((r) => (
            <div
              key={r}
              className="font-body text-[0.95vw] text-text/75 py-[0.5vh] border-b border-text/8"
            >
              — {r}
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
