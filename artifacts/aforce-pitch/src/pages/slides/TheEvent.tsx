import SlideChrome from "@/components/SlideChrome";

const CREATES = [
  "Content",
  "Testimonials",
  "Founder credibility",
  "NPS data",
  "Emotional storytelling",
  "Community identity",
];

const RITUAL = ["Pause.", "Hydrate.", "Lock in.", "Perform."];

export default function TheEvent() {
  return (
    <SlideChrome slide={24}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Event
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter mb-[2vh] max-w-[70vw]">
          One high-conviction
          <br />
          <span className="text-primary">performance ritual</span> in Brickell.
        </h2>

        <div className="mt-[5vh] grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-7">
            <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/55">
              Not a launch party.
            </div>
            <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text mt-[0.5vh]">
              A preparation experience.
            </div>

            <div className="mt-[3vh] flex items-baseline gap-[1vw] flex-wrap">
              {RITUAL.map((r, i) => (
                <span
                  key={r}
                  className={`font-display text-[2vw] tracking-tight ${i === 0 ? "text-primary" : i === 2 ? "text-accent" : "text-text"}`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-5 border-l border-text/15 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              This creates
            </div>
            {CREATES.map((c) => (
              <div
                key={c}
                className="font-body text-[1vw] text-text/80 py-[0.6vh] border-b border-text/8"
              >
                — {c}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
