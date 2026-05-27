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
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-6 flex flex-col">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              The Target User
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h2 className="font-display font-black tracking-[-0.035em] text-[6.2vw] leading-[0.92] text-text">
            People who do not<br />
            get to be <span className="text-red">off.</span>
          </h2>

          <div className="mt-auto pt-[3vh] border-t border-divider max-w-[30vw]">
            <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[1.5vh]">
              Proof Geography
            </div>
            <div className="font-display font-black text-[3vw] leading-[1] tracking-[-0.03em]">
              <span className="text-text">Miami</span> · <span className="text-blue">Brickell</span>
            </div>
            <p className="mt-[2vh] font-display text-[1vw] text-text/65 leading-[1.5] font-medium">
              Audience density. Founder access. Finance and performance overlap. Lower category saturation.
            </p>
          </div>
        </div>

        <div className="col-span-6 pl-[3vw] flex flex-col justify-center border-l border-divider">
          <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[3vh]">
            Profile
          </div>
          {TRAITS.map((t, i) => (
            <div key={t} className="flex items-baseline gap-[1.5vw] py-[1.6vh] border-b border-divider last:border-b-0">
              <span className="font-display tabular-nums text-[0.7vw] text-text/40 tracking-[0.32em] font-semibold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display font-bold text-[1.5vw] text-text tracking-tight">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
