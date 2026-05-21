import SlideChrome from "@/components/SlideChrome";

const CHANNELS = [
  "Meta",
  "Google",
  "Founder-led content",
  "Referral loops",
  "Event-led acquisition",
  "Ritual onboarding",
];

const NO = ["No broad retail.", "No mass creators.", "No scale before proof."];

export default function GoToMarket() {
  return (
    <SlideChrome slide={23}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Go to Market
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Disciplined channels.
          <br />
          <span className="text-primary">Controlled spend.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[2vh]">
              Channels
            </div>
            <div className="flex flex-wrap gap-[0.7vw]">
              {CHANNELS.map((c) => (
                <span
                  key={c}
                  className="px-[1.2vw] py-[0.8vh] border border-text/15 rounded-full font-body text-[1vw] text-text/80"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[2vh]">
              What we will not do
            </div>
            <div className="flex flex-col gap-[1.2vh]">
              {NO.map((n) => (
                <div
                  key={n}
                  className="font-display text-[1.5vw] leading-[1.1] tracking-tight text-text/85"
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
