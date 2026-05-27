import SlideChrome from "@/components/SlideChrome";

export default function CategoryShift() {
  return (
    <SlideChrome slide={4}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            The Category Shift
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-black tracking-[-0.035em] text-[5.2vw] leading-[0.95] text-text max-w-[80vw]">
          AForce is not a <span className="text-blue">hydration brand.</span><br />
          It is a <span className="text-red">behavioral performance ecosystem.</span>
        </h2>

        <div className="mt-auto pt-[6vh] grid grid-cols-2 gap-x-[5vw] border-t border-divider">
          <div className="pt-[3vh]">
            <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[2vh]">
              The Category
            </div>
            <p className="font-display font-bold text-[2.2vw] leading-[1.15] text-text/60 tracking-tight">
              Sells moments. <span className="font-medium">A drink. A spike. A scroll.</span>
            </p>
          </div>
          <div className="pt-[3vh] border-l border-divider pl-[4vw]">
            <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-red mb-[2vh]">
              AForce
            </div>
            <p className="font-display font-bold text-[2.2vw] leading-[1.15] text-text tracking-tight">
              Builds readiness. <span className="font-medium">A ritual. A loop. A system.</span>
            </p>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
