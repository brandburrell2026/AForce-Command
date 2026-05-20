import SlideChrome from "@/components/SlideChrome";

const CHANNELS = [
  "Meta",
  "Google",
  "Founder-led content",
  "Referral loops",
  "Event-led acquisition",
  "Ritual onboarding",
];

const NOT = ["No broad retail", "No mass creators", "No scale before proof"];

export default function GoToMarket() {
  return (
    <SlideChrome slide={23}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Go To Market
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter mb-[6vh] max-w-[70vw]">
          Concentrated. Controlled.
          <br />
          <span className="text-text/45">Founder-led.</span>
        </h2>

        <div className="grid grid-cols-12 gap-[3vw]">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-primary font-semibold mb-[1.5vh]">
              Channels
            </div>
            <div className="grid grid-cols-2 gap-y-[1vh] gap-x-[2vw]">
              {CHANNELS.map((c) => (
                <div
                  key={c}
                  className="font-display text-[1.6vw] leading-[1.1] tracking-tight text-text/85 border-b border-text/8 pb-[1vh]"
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-5 border-l border-text/15 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              What we are not doing
            </div>
            {NOT.map((n) => (
              <div
                key={n}
                className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text/50 py-[1vh]"
              >
                {n}.
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
