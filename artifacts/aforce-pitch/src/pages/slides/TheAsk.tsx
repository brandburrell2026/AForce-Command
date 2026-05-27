import SlideChrome from "@/components/SlideChrome";

const USES = [
  { tag: "01", label: "Product", body: "Two formats. Phase 1 production at concierge scale." },
  { tag: "02", label: "OS Build", body: "Behavioral engine. Coaching layer. Retention surfaces." },
  { tag: "03", label: "Activation", body: "Brickell event. Curated cohorts. Founder-installed ritual." },
  { tag: "04", label: "Proof", body: "Measurement. Cohort science. Subscription instrumentation." },
];

export default function TheAsk() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-5 flex flex-col">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              The Ask
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h2 className="font-display font-black tracking-[-0.035em] text-[5.4vw] leading-[0.92] text-text">
            A proof-of-concept raise.<br />
            <span className="text-text/55 font-light italic">Not a scale raise.</span>
          </h2>

          <div className="mt-auto pt-[3vh] border-t-2 border-text/85 max-w-[28vw]">
            <div className="font-display font-black tabular-nums text-[6vw] leading-[0.95] tracking-[-0.04em] text-red">
              $1.5M
            </div>
            <div className="mt-[1.5vh] font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/55">
              SAFE · Phase 1
            </div>
            <p className="mt-[2vh] font-display text-[1.05vw] text-text/70 leading-[1.5] font-medium">
              The capital funds <span className="text-text font-semibold">proof of habit.</span> The next round funds <span className="text-text font-semibold">scale.</span>
            </p>
          </div>
        </div>

        <div className="col-span-7 pl-[3vw] flex flex-col justify-center border-l border-divider">
          <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[3vh]">
            Use of Funds
          </div>
          <div className="grid grid-cols-1 gap-y-[1.4vh]">
            {USES.map((u) => (
              <div key={u.label} className="grid grid-cols-12 gap-[1.2vw] items-baseline pb-[1.6vh] border-b border-divider last:border-b-0">
                <div className="col-span-1 font-display tabular-nums text-[0.7vw] text-text/40 tracking-[0.32em] font-semibold">
                  {u.tag}
                </div>
                <div className="col-span-3 font-display font-black text-[1.8vw] tracking-[-0.025em] text-text leading-none">
                  {u.label}
                </div>
                <div className="col-span-8 font-display text-[1vw] font-medium text-text/65 leading-[1.45]">
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
