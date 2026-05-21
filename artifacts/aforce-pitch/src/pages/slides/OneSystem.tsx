import SlideChrome from "@/components/SlideChrome";

const RTD_USES = ["Office", "Gym", "Recovery", "Performance days"];
const STICK_USES = ["Travel", "Portability", "Immediate correction", "Convenience"];

export default function OneSystem() {
  return (
    <SlideChrome slide={10}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          One System. Multiple Formats.
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          One system.
          <br />
          <span className="text-primary">Every moment.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-[3vw] max-w-[70vw]">
          <div className="border-l-2 border-primary pl-[1.5vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              The RTD
            </div>
            <div className="font-display text-[2.2vw] leading-none tracking-tight text-text mb-[1vh]">
              Sustained daily readiness
            </div>
            <div className="flex flex-wrap gap-[0.5vw] mt-[1.5vh]">
              {RTD_USES.map((u) => (
                <span
                  key={u}
                  className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/70"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-accent pl-[1.5vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              The Sticks
            </div>
            <div className="font-display text-[2.2vw] leading-none tracking-tight text-text mb-[1vh]">
              Portable correction
            </div>
            <div className="flex flex-wrap gap-[0.5vw] mt-[1.5vh]">
              {STICK_USES.map((u) => (
                <span
                  key={u}
                  className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/70"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[8vh] font-body text-[1vw] text-text/45 leading-[1.6] max-w-[40vw]">
          Built to support every moment of the day.
        </div>
      </div>
    </SlideChrome>
  );
}
