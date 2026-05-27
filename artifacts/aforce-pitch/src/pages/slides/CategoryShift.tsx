import SlideChrome from "@/components/SlideChrome";

export default function CategoryShift() {
  return (
    <SlideChrome slide={4}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[14vh]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[4vh]">
          The Category Shift
        </div>

        <h2 className="font-display font-light text-[4.6vw] leading-[1.05] tracking-tight max-w-[70vw]">
          AForce is not a hydration brand.<br />
          It is a <span className="italic">behavioral performance ecosystem.</span>
        </h2>

        <div className="mt-auto pt-[6vh] grid grid-cols-2 gap-x-[6vw] border-t border-divider">
          <div className="pt-[4vh]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[2vh]">
              The Category
            </div>
            <p className="font-display font-light text-[2vw] leading-[1.3] text-text/55">
              Sells moments.<br />
              <span className="italic">A drink. A spike. A scroll.</span>
            </p>
          </div>
          <div className="pt-[4vh] border-l border-divider pl-[5vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[2vh]">
              AForce
            </div>
            <p className="font-display font-light text-[2vw] leading-[1.3] text-text">
              Builds readiness.<br />
              <span className="italic">A ritual. A loop. A system.</span>
            </p>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
