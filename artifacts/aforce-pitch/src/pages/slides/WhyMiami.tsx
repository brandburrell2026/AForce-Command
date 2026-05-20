import SlideChrome from "@/components/SlideChrome";

const ATTRIBUTES = [
  "Audience density",
  "Founder access",
  "Finance + performance overlap",
  "Lower category saturation",
  "Strong founder credibility",
];

export default function WhyMiami() {
  return (
    <SlideChrome slide={18}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Why Miami / Brickell
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          A concentrated
          <br />
          <span className="text-primary">proof engine.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-6">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Miami / Brickell provides
            </div>
            {ATTRIBUTES.map((a) => (
              <div
                key={a}
                className="font-body text-[1.05vw] text-text/80 py-[0.7vh] border-b border-text/8"
              >
                — {a}
              </div>
            ))}
          </div>
          <div className="col-span-6 flex flex-col justify-end">
            <div className="font-display text-[2.2vw] leading-[1.2] tracking-tight text-text">
              This is not a national launch.
            </div>
            <div className="font-display text-[2.2vw] leading-[1.2] tracking-tight text-text/55 mt-[1vh]">
              This is a concentrated proof engine.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
