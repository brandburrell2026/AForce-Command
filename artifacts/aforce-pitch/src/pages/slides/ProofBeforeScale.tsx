import SlideChrome from "@/components/SlideChrome";

const PHASES = [
  { tag: "Phase 01", title: "Miami", window: "Months 1–3", body: "50 highly selected users. Founder-led activation. The ritual installed by hand.", color: "text-text" },
  { tag: "Phase 02", title: "Miami + NYC", window: "Months 4–6", body: "100 users across two markets. Retention measured. Loop validated under variance.", color: "text-blue" },
  { tag: "Phase 03", title: "Controlled Expansion", window: "Months 7–9", body: "Selected referral. Subscription conversion proven. Scale criteria met before media.", color: "text-red" },
];

export default function ProofBeforeScale() {
  return (
    <SlideChrome slide={12}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            Proof Before Scale
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-black tracking-[-0.035em] text-[5.6vw] leading-[0.92] text-text max-w-[75vw]">
          Not about awareness.<br />
          About <span className="text-red">validation.</span>
        </h2>

        <p className="mt-[3vh] font-display font-medium text-[1.3vw] text-text/65 leading-[1.4] max-w-[44vw]">
          Do people want this. Do they come back. Earn scale through evidence.
        </p>

        <div className="my-auto py-[4vh] grid grid-cols-3 gap-x-[3vw]">
          {PHASES.map((p) => (
            <div key={p.tag} className="pt-[2.5vh] border-t-2 border-text/85">
              <div className="flex items-baseline justify-between mb-[2vh]">
                <span className="font-display uppercase tracking-[0.28em] text-[0.6vw] font-semibold text-text/50">
                  {p.tag}
                </span>
                <span className="font-display uppercase tracking-[0.22em] text-[0.6vw] font-semibold text-text/45">
                  {p.window}
                </span>
              </div>
              <div className={`font-display font-black text-[2.6vw] leading-[1] tracking-[-0.03em] ${p.color}`}>
                {p.title}
              </div>
              <p className="mt-[2.5vh] font-display text-[1vw] text-text/70 leading-[1.5] font-medium">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-divider pt-[2.5vh] font-display uppercase tracking-[0.28em] text-[0.65vw] text-text/50 font-semibold flex justify-between">
          <span>Controlled rollout · Founder-led</span>
          <span>No broad retail before proof</span>
        </div>
      </div>
    </SlideChrome>
  );
}
