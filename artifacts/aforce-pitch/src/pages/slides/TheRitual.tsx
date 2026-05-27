import SlideChrome from "@/components/SlideChrome";

const STEPS = [
  { word: "Pause.", caption: "Interrupt the noise.", color: "text-red" },
  { word: "Hydrate.", caption: "Restore the system.", color: "text-text" },
  { word: "Lock In.", caption: "Choose the standard.", color: "text-blue" },
  { word: "Perform.", caption: "The outcome follows.", color: "text-text" },
];

export default function TheRitual() {
  return (
    <SlideChrome slide={5}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            The Ritual
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-bold tracking-tight text-[2.4vw] leading-[1.15] text-text/75 max-w-[58vw] mb-[6vh]">
          A four-beat operating system<br />
          for the <span className="text-text font-black">moment before the moment.</span>
        </h2>

        <div className="my-auto grid grid-cols-4 gap-x-[2.5vw]">
          {STEPS.map((s, i) => (
            <div key={s.word} className="border-t-2 border-text/85 pt-[2.5vh]">
              <div className="font-display tabular-nums text-[0.7vw] text-text/45 tracking-[0.32em] mb-[2vh] font-semibold">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className={`font-display font-black text-[4.6vw] leading-[0.95] tracking-[-0.035em] ${s.color}`}>
                {s.word}
              </div>
              <div className="mt-[3vh] font-display text-[0.95vw] text-text/70 leading-[1.4] font-medium">
                {s.caption}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
