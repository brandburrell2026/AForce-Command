import SlideChrome from "@/components/SlideChrome";

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
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-primary font-semibold mb-[3vh]">
          The Ask
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          This is a
          <br />
          <span className="text-primary">proof-of-concept</span> raise.
        </h2>
        <div className="font-display text-[2vw] leading-[1.15] tracking-tight text-text/55 mt-[2vh]">
          Not a scale raise.
        </div>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              The capital funds
            </div>
            <div className="grid grid-cols-2 gap-y-[0.8vh] gap-x-[1.5vw]">
              {FUNDS.map((f) => (
                <div key={f} className="font-body text-[1.05vw] text-text/85">
                  — {f}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-5 border-l border-text/15 pl-[2vw] flex flex-col justify-end">
            <div className="font-display text-[2.4vw] leading-[1.15] tracking-tight text-text">
              The next round
              <br />
              <span className="text-primary">funds scale.</span>
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
