import SlideChrome from "@/components/SlideChrome";

const PRINCIPLES = [
  { tag: "Human", line: "The OS adapts to the person. Never the reverse." },
  { tag: "Quiet", line: "It reinforces ritual without demanding attention." },
  { tag: "Honest", line: "Only completed behavior moves the score." },
  { tag: "Compounding", line: "Every cycle strengthens the next." },
];

export default function TheOS() {
  return (
    <SlideChrome slide={7}>
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-5 flex flex-col">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              The OS
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h2 className="font-display font-black tracking-[-0.035em] text-[6vw] leading-[0.92] text-text">
            <span className="text-red">Human</span> first.<br />
            <span className="text-blue">System</span> second.
          </h2>

          <p className="mt-[4vh] font-display font-medium text-[1.25vw] text-text/65 leading-[1.4] max-w-[26vw]">
            A quiet behavioral layer beneath the product. It does not demand. It returns the moment.
          </p>
        </div>

        <div className="col-span-7 pl-[3vw] flex flex-col justify-center gap-[2vh] border-l border-divider">
          {PRINCIPLES.map((p, i) => (
            <div key={p.tag} className="grid grid-cols-12 gap-[1.2vw] items-baseline pb-[1.8vh] border-b border-divider last:border-b-0">
              <div className="col-span-1 font-display tabular-nums text-[0.7vw] text-text/40 tracking-[0.32em] font-semibold">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-4 font-display font-black text-[1.9vw] leading-none tracking-[-0.03em] text-text">
                {p.tag}
              </div>
              <div className="col-span-7 font-display text-[1.05vw] font-medium text-text/70 leading-[1.4]">
                {p.line}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
