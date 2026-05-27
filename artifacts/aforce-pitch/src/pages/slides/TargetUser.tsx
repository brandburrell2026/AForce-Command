import SlideChrome from "@/components/SlideChrome";

const TRAITS = [
  "Founders. Operators. Performers.",
  "Finance. Entrepreneurship. Pressure roles.",
  "Do not get to be off.",
  "Already invest in their body.",
  "Buy outcomes, not ingredients.",
];

export default function TargetUser() {
  return (
    <SlideChrome slide={10}>
      <div className="absolute inset-0 grid grid-cols-12 px-[9vw] py-[14vh]">
        <div className="col-span-6">
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            The Target User
          </div>
          <h2 className="font-display font-light text-[4.6vw] leading-[1.02] tracking-tight">
            People who do not<br />
            <span className="italic text-text/75">get to be off.</span>
          </h2>
          <div className="mt-[6vh] pt-[3vh] border-t border-divider max-w-[28vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[1.5vh]">
              Proof Geography
            </div>
            <div className="font-display text-[2.4vw] font-light leading-[1.1]">Miami · Brickell</div>
            <p className="mt-[2vh] font-display text-[1.05vw] italic text-text/55 leading-[1.5]">
              Audience density. Founder access. Finance and performance overlap. Lower category saturation.
            </p>
          </div>
        </div>

        <div className="col-span-6 pl-[5vw] flex flex-col justify-center border-l border-divider">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[3vh]">
            Profile
          </div>
          {TRAITS.map((t, i) => (
            <div key={t} className="flex items-baseline gap-[1.5vw] py-[1.6vh] border-b border-divider last:border-b-0">
              <span className="font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.32em]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[1.7vw] font-light text-text/85">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
