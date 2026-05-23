import SlideChrome from "@/components/SlideChrome";
import VideoBackdrop from "@/components/VideoBackdrop";

const STEPS = [
  { word: "Pause.", color: "text-primary" },
  { word: "Hydrate.", color: "text-text" },
  { word: "Lock in.", color: "text-accent" },
  { word: "Perform.", color: "text-text/70" },
];

const CREATES = [
  "Content",
  "Testimonials",
  "Founder credibility",
  "NPS data",
  "Emotional storytelling",
  "Community identity",
];

export default function TheEvent() {
  return (
    <SlideChrome slide={24}>
      <VideoBackdrop
        src="video/s24-event.mp4"
        opacity={0.55}
        overlay="linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 50%, rgba(0,0,0,0.55) 100%)"
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Event
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          Not a launch party.
          <br />
          <span className="text-primary">A preparation experience.</span>
        </h2>

        <div className="mt-[6vh] font-body text-[1.1vw] text-text/55 leading-[1.6] max-w-[55vw]">
          One high-conviction performance ritual experience in Brickell, centered on the loop.
        </div>

        <div className="mt-[5vh] grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-5 flex flex-col gap-[0.4vh]">
            {STEPS.map((s) => (
              <div
                key={s.word}
                className={`font-display text-[2.4vw] leading-[1] tracking-tight ${s.color}`}
              >
                {s.word}
              </div>
            ))}
          </div>

          <div className="col-span-7 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              What it creates
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {CREATES.map((c) => (
                <span
                  key={c}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/75"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
