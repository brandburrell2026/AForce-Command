import SlideChrome from "@/components/SlideChrome";
import Disclosure from "@/components/Disclosure";

import waBg from "@assets/hydration_science_B.png";

const WHY = [
  "Supports hydration efficiency",
  "Helps maintain mineral balance",
  "Reduces acidity from stress and high-output environments",
  "Supports sustained performance rather than short spikes",
  "Cleaner, more stable feeling than stimulant-driven energy",
];

export default function WhyAlkaline() {
  return (
    <SlideChrome slide={9}>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${waBg})`,
          filter: "contrast(1.08) brightness(1.05)",
          opacity: 0.85,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.35) 100%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Why Alkaline
        </div>

        <div className="grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-7">
            <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter">
              AForce stands for
              <br />
              <span className="text-primary">Alkaline Force.</span>
            </h2>

            <div className="mt-[4vh] font-display text-[2.2vw] leading-[1.15] tracking-tight text-text/90 max-w-[40vw]">
              The foundation is premium alkaline hydration at
              <span className="text-accent"> pH 8.8.</span>
            </div>

            <div className="mt-[5vh] flex items-baseline gap-[2vw] font-display text-[2vw] tracking-tight">
              <span className="text-text/40">Others chase spikes.</span>
              <span className="text-primary">AForce supports sustained performance.</span>
            </div>
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Why it matters
            </div>
            <div className="flex flex-col gap-[1.2vh]">
              {WHY.map((w) => (
                <div key={w} className="flex items-start gap-[0.8vw]">
                  <span className="font-display text-[0.9vw] text-primary mt-[0.3vh]">—</span>
                  <span className="font-body text-[0.95vw] text-text/75 leading-[1.45]">{w}</span>
                </div>
              ))}
            </div>
            <div className="mt-[3vh] font-display text-[1.4vw] leading-[1.2] tracking-tight text-text">
              Balance under pressure.
            </div>
          </div>
        </div>
      </div>

      <Disclosure
        label="Wellness disclosure"
        body="AForce is a performance and wellness product. It is not a medical device and is not intended to diagnose, treat, cure, or prevent any disease. Statements have not been evaluated by the FDA. Consult a qualified physician before changing hydration, supplementation, or training routines."
      />
    </SlideChrome>
  );
}
