import SlideChrome from "@/components/SlideChrome";

const OUTCOMES = [
  "Retention",
  "Accountability",
  "Habit",
  "Subscription",
  "Recurring revenue",
];

export default function ProofModel() {
  return (
    <SlideChrome slide={22}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Proof of Concept Model
        </div>

        <div className="grid grid-cols-12 gap-[3vw] items-start mb-[7vh]">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-primary font-semibold mb-[1.5vh]">
              Phase 1
            </div>
            <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter">
              Miami <span className="text-text/40">→</span> NYC
            </h2>
          </div>
          <div className="col-span-5 border-l border-text/15 pl-[2vw] flex flex-col gap-[1.5vh]">
            <div>
              <div className="font-display text-[4vw] leading-none tracking-tight text-text">50–100</div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/45 mt-[0.5vh]">Highly selected users</div>
            </div>
            <div className="font-body text-[0.95vw] text-text/65">Controlled rollout.</div>
            <div className="font-body text-[0.95vw] text-text/65">Founder-led activation.</div>
          </div>
        </div>

        <div>
          <div className="font-display text-[2vw] tracking-tight text-text mb-[2vh]">
            The ritual becomes <span className="text-primary">the behavioral loop</span>.
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
            The loop creates
          </div>
          <div className="flex flex-wrap gap-[0.6vw]">
            {OUTCOMES.map((o) => (
              <span
                key={o}
                className="px-[1.2vw] py-[0.7vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/80"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
