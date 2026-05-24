import SlideChrome from "@/components/SlideChrome";
import Disclosure from "@/components/Disclosure";

const FUNDS = [
  "Proof of habit",
  "Onboarding validation",
  "Retention validation",
  "OS engagement",
  "Ecosystem adoption",
  "Customer acquisition testing",
  "Ritual adoption",
  "Operational proof",
];

export default function TheAsk() {
  return (
    <SlideChrome slide={29}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Ask
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[80vw]">
          A proof-of-concept raise.
          <br />
          <span className="text-text/45">Not a scale raise.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              The capital funds
            </div>
            <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[1vh]">
              {FUNDS.map((f, i) => (
                <div key={f} className="flex items-baseline gap-[0.8vw]">
                  <span className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/35 font-semibold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/90">
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              The next round
            </div>
            <div className="font-display text-[2.6vw] leading-[1.1] tracking-tight text-primary">
              Funds scale.
            </div>
            <div className="mt-[3vh] font-body text-[1vw] text-text/55 leading-[1.55]">
              This phase is engineered to produce the validated metrics required for the scale round.
            </div>
          </div>
        </div>
      </div>

      <Disclosure
        label="Securities notice"
        body="This presentation does not constitute an offer to sell or a solicitation of an offer to buy any securities. Any offer or sale will be made only to qualified investors pursuant to definitive transaction documents and applicable exemptions under U.S. and other securities laws."
      />
    </SlideChrome>
  );
}
