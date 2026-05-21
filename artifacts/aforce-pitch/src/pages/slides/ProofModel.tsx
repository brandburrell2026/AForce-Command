import SlideChrome from "@/components/SlideChrome";

const CREATES = ["Retention", "Accountability", "Habit", "Subscription", "Recurring revenue"];

export default function ProofModel() {
  return (
    <SlideChrome slide={22}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Proof of Concept Model
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[80vw]">
          Phase 1.
          <br />
          <span className="text-primary">Miami → NYC.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-3 gap-[2vw] max-w-[75vw]">
          <div className="border-l-2 border-primary pl-[1.4vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              Users
            </div>
            <div className="font-display text-[2.6vw] leading-none tracking-tight text-text">50–100</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.5vh]">Highly selected.</div>
          </div>
          <div className="border-l-2 border-accent pl-[1.4vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              Rollout
            </div>
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">Controlled</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.5vh]">No premature scale.</div>
          </div>
          <div className="border-l-2 border-blue pl-[1.4vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              Activation
            </div>
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">Founder-led</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.5vh]">Direct credibility.</div>
          </div>
        </div>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-6 font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/85">
            The ritual becomes the behavioral loop.
          </div>
          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              The loop creates
            </div>
            <div className="flex flex-wrap gap-[0.5vw]">
              {CREATES.map((c) => (
                <span
                  key={c}
                  className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/75"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
