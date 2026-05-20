import SlideChrome from "@/components/SlideChrome";

const REASONS = [
  "Supports hydration efficiency",
  "Maintains mineral balance",
  "Reduces stress-driven acidity",
  "Sustains performance, not spikes",
  "Cleaner, more stable than stimulants",
];

export default function WhyAlkaline() {
  return (
    <SlideChrome slide={9}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 70% at 78% 50%, rgba(84,120,213,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 grid grid-cols-12 gap-[3vw] px-[6vw] py-[14vh]">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
            Why Alkaline
          </div>
          <div className="font-display text-[3vw] leading-[1] tracking-tight text-text mb-[1vh]">
            AForce stands for
          </div>
          <h2 className="font-display text-[6vw] leading-[0.9] tracking-tighter">
            <span className="text-primary">Alkaline</span>
            <br />
            Force.
          </h2>
          <div className="mt-[4vh] font-body text-[1.05vw] text-text/65 leading-[1.6] max-w-[40vw]">
            The name is intentional. Most hydration and energy products focus on stimulation. AForce focuses on{" "}
            <span className="text-text">balance, readiness, and sustained performance under pressure</span>.
          </div>
        </div>

        <div className="col-span-5 flex flex-col justify-center">
          <div className="border border-text/15 rounded-sm p-[2.5vw] mb-[3vh]">
            <div className="font-body uppercase tracking-[0.35em] text-[0.75vw] text-text/45 font-semibold mb-[1.5vh]">
              The Foundation
            </div>
            <div className="flex items-baseline gap-[1vw]">
              <div className="font-display text-[6vw] leading-none tracking-tighter text-text">
                8.8
              </div>
              <div className="font-display text-[1.6vw] tracking-tight text-text/55">pH</div>
            </div>
            <div className="font-body text-[0.85vw] text-text/45 mt-[1.5vh] uppercase tracking-[0.25em]">
              Premium alkaline hydration
            </div>
          </div>

          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.2vh]">
              Why it matters
            </div>
            {REASONS.map((r) => (
              <div
                key={r}
                className="font-body text-[0.95vw] text-text/75 py-[0.6vh] border-b border-text/8"
              >
                — {r}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[14vh] right-[6vw] text-right max-w-[35vw]">
        <div className="font-display text-[1.5vw] leading-[1.2] tracking-tight italic text-text/80">
          "Others spike performance.
          <br />
          <span className="text-primary not-italic">AForce stabilizes it."</span>
        </div>
      </div>
    </SlideChrome>
  );
}
