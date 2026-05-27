import SlideChrome from "@/components/SlideChrome";

const PHASES = [
  {
    tag: "Phase 01",
    title: "Miami",
    window: "Months 1–3",
    body: "50 highly selected users. Founder-led activation. The ritual installed by hand.",
  },
  {
    tag: "Phase 02",
    title: "Miami + NYC",
    window: "Months 4–6",
    body: "100 users across two markets. Retention measured. Loop validated under variance.",
  },
  {
    tag: "Phase 03",
    title: "Controlled Expansion",
    window: "Months 7–9",
    body: "Selected referral. Subscription conversion proven. Scale criteria met before media.",
    italic: true,
  },
];

export default function ProofBeforeScale() {
  return (
    <SlideChrome slide={12}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[13vh]">
        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            Proof Before Scale
          </div>
          <h2 className="font-display font-light text-[4.4vw] leading-[1.04] tracking-tight max-w-[68vw]">
            Not about awareness.<br />
            <span className="italic text-text/75">About validation.</span>
          </h2>
          <p className="mt-[3vh] font-display font-light text-[1.4vw] text-text/55 italic leading-[1.4] max-w-[44vw]">
            Do people want this. Do they come back. Earn scale through evidence.
          </p>
        </div>

        <div className="my-auto py-[5vh] grid grid-cols-3 gap-x-[3vw]">
          {PHASES.map((p) => (
            <div key={p.tag} className="pt-[3vh] border-t border-text/25">
              <div className="flex items-baseline justify-between mb-[2vh]">
                <span className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40 font-medium">
                  {p.tag}
                </span>
                <span className="font-body uppercase tracking-[0.24em] text-[0.65vw] text-text/35">
                  {p.window}
                </span>
              </div>
              <div
                className={`font-display font-light text-[2.6vw] leading-[1.05] tracking-tight ${
                  p.italic ? "italic text-text/85" : "text-text"
                }`}
              >
                {p.title}
              </div>
              <p className="mt-[3vh] font-display text-[1.05vw] text-text/60 italic leading-[1.5]">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-divider pt-[3vh] font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium flex justify-between">
          <span>Controlled rollout · Founder-led</span>
          <span>No broad retail before proof</span>
        </div>
      </div>
    </SlideChrome>
  );
}
