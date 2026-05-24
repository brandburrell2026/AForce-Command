import SlideChrome from "@/components/SlideChrome";
import operatorImg from "@assets/generated_images/surgeon_scrub_B.png";

const TRAITS = [
  "Operate under pressure",
  "Do not get to be off",
  "Already live with discipline",
  "Value readiness over stimulation",
  "See performance as part of identity",
];

const FOCUS = ["Finance", "Entrepreneurship", "Performance operators"];

export default function TargetUser() {
  return (
    <SlideChrome slide={17}>
      {/* Right-hand portrait panel */}
      <div className="absolute inset-y-0 right-0 w-[42vw]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${operatorImg})`,
            filter: "grayscale(1) contrast(1.08)",
            opacity: 0.95,
          }}
        />
        {/* Left-edge fade into black */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 14%, rgba(0,0,0,0.25) 32%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)",
          }}
        />
        {/* Top + bottom vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        {/* Soft red ember in the corner */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 35% 28% at 78% 70%, rgba(229,51,65,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Text — confined to the left ~58vw */}
      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-[44vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Target User
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.98] tracking-tighter">
          High-performance
          <br />
          <span className="text-primary">professionals.</span>
        </h2>

        <div className="mt-[5vh]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
            People who
          </div>
          <div className="flex flex-col gap-[0.9vh]">
            {TRAITS.map((t) => (
              <div key={t} className="flex items-baseline gap-[0.8vw]">
                <span className="font-display text-[0.9vw] text-primary">—</span>
                <span className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/90">
                  {t}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[5vh] grid grid-cols-2 gap-[2vw] max-w-[44vw]">
          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              Initial focus
            </div>
            <div className="flex flex-wrap gap-[0.4vw]">
              {FOCUS.map((f) => (
                <span
                  key={f}
                  className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.8vw] text-text/80"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Launch market
            </div>
            <div className="font-display text-[1.9vw] leading-none tracking-tight text-accent">
              Miami / Brickell
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
