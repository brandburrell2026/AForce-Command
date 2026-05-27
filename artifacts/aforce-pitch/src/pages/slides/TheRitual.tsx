import SlideChrome from "@/components/SlideChrome";

const STEPS = [
  { word: "Pause.", caption: "Interrupt the noise." },
  { word: "Hydrate.", caption: "Restore the system." },
  { word: "Lock In.", caption: "Choose the standard." },
  { word: "Perform.", caption: "The outcome follows.", italic: true },
];

export default function TheRitual() {
  return (
    <SlideChrome slide={5}>
      <div className="absolute inset-0 flex flex-col justify-between px-[9vw] py-[15vh]">
        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium">
            The Ritual
          </div>
          <h2 className="mt-[3vh] font-display font-light text-[2.6vw] leading-[1.25] text-text/65 max-w-[50vw]">
            A four-beat operating system for the moment before the moment.
          </h2>
        </div>

        <div className="grid grid-cols-4 gap-x-[3vw]">
          {STEPS.map((s, i) => (
            <div key={s.word} className="border-t border-text/25 pt-[2.5vh]">
              <div className="font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.32em] mb-[2.5vh]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div
                className={`font-display font-light text-[4.2vw] leading-[1] tracking-tight ${
                  s.italic ? "italic text-text/85" : "text-text"
                }`}
              >
                {s.word}
              </div>
              <div className="mt-[3vh] font-body text-[0.85vw] text-text/55 leading-[1.5]">
                {s.caption}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
