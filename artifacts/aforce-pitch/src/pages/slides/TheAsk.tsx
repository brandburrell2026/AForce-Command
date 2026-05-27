import SlideChrome from "@/components/SlideChrome";

const USES = [
  { tag: "01", label: "Product & Inventory", body: "Two formats. Phase 1 production at concierge scale." },
  { tag: "02", label: "OS Build", body: "The behavioral engine. Coaching layer. Retention surfaces." },
  { tag: "03", label: "Founder-Led Activation", body: "The Brickell event. Curated cohorts. Hand-installed ritual." },
  { tag: "04", label: "Proof Infrastructure", body: "Measurement. Cohort science. Subscription instrumentation." },
];

export default function TheAsk() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 grid grid-cols-12 px-[9vw] py-[13vh]">
        <div className="col-span-5">
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            The Ask
          </div>
          <h2 className="font-display font-light text-[5vw] leading-[1] tracking-tight">
            A proof-of-concept raise.<br />
            <span className="italic text-text/75">Not a scale raise.</span>
          </h2>
          <div className="mt-[6vh] pt-[3vh] border-t border-divider max-w-[28vw]">
            <div className="font-display font-light tabular-nums text-[4.8vw] leading-[1]">
              $1.5M
            </div>
            <div className="mt-[2vh] font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/50 font-medium">
              SAFE · Phase 1
            </div>
            <p className="mt-[2.5vh] font-display text-[1.15vw] italic text-text/60 leading-[1.5]">
              The capital funds proof of habit. The next round funds scale.
            </p>
          </div>
        </div>

        <div className="col-span-7 pl-[5vw] flex flex-col justify-center border-l border-divider">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[3vh]">
            Use of Funds
          </div>
          <div className="grid grid-cols-1 gap-y-[1.6vh]">
            {USES.map((u) => (
              <div key={u.label} className="grid grid-cols-12 gap-[1.5vw] items-baseline pb-[1.6vh] border-b border-divider last:border-b-0">
                <div className="col-span-1 font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.32em]">
                  {u.tag}
                </div>
                <div className="col-span-4 font-display text-[1.6vw] font-light text-text">{u.label}</div>
                <div className="col-span-7 font-display text-[1.1vw] font-light italic text-text/60 leading-[1.4]">
                  {u.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
