import SlideChrome from "@/components/SlideChrome";

export default function TheFinal() {
  return (
    <SlideChrome slide={15} eyebrow="15 · The Final Word">
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            The Final Word
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <div className="my-auto">
          <h2 className="font-display font-black tracking-[-0.04em] text-[10vw] leading-[0.88] text-text">
            Performance is<br />
            <span className="text-red">non-negotiable.</span>
          </h2>

          <div className="mt-[6vh] pt-[3vh] border-t-2 border-text/85 max-w-[58vw]">
            <p className="font-display text-[1.7vw] font-semibold leading-[1.3] text-text">
              AForce makes sure you are always on.
            </p>
            <div className="mt-[3vh] font-display font-black text-[3vw] tracking-[-0.03em] leading-[1.1]">
              <span className="text-red">Pause.</span>{" "}
              <span className="text-text">Hydrate.</span>{" "}
              <span className="text-blue">Lock&nbsp;In.</span>{" "}
              <span className="text-text">Perform.</span>
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
