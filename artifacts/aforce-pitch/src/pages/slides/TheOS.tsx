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
      <div className="absolute inset-0 grid grid-cols-12 px-[9vw] py-[14vh]">
        <div className="col-span-5">
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            The OS
          </div>
          <h2 className="font-display font-light text-[4.4vw] leading-[1.04] tracking-tight">
            Human first.<br />
            <span className="italic text-text/75">System second.</span>
          </h2>
          <p className="mt-[4vh] font-display font-light text-[1.4vw] text-text/60 leading-[1.4] max-w-[28vw]">
            A quiet behavioral layer beneath the product. It does not demand. It returns the moment.
          </p>
        </div>

        <div className="col-span-7 pl-[5vw] flex flex-col justify-center gap-[3vh] border-l border-divider">
          {PRINCIPLES.map((p, i) => (
            <div key={p.tag} className="grid grid-cols-12 gap-[1.5vw] items-baseline pb-[2vh] border-b border-divider last:border-b-0">
              <div className="col-span-1 font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.32em]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-3 font-display text-[2vw] font-light text-text">{p.tag}</div>
              <div className="col-span-8 font-display text-[1.3vw] font-light text-text/65 italic">{p.line}</div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
