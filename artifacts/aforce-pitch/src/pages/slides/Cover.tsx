import SlideChrome from "@/components/SlideChrome";

export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={1} eyebrow="01 · Executive Summary">
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-7 flex flex-col h-full">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              Executive Summary
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h1 className="font-display font-black tracking-[-0.035em] text-[7.2vw] leading-[0.92] text-text">
            A behavioral<br />
            <span className="text-red">performance</span><br />
            ecosystem.
          </h1>

          <div className="mt-[5vh] font-display font-bold tracking-tight text-[2.4vw] leading-[1.1]">
            <span className="text-red">Pause.</span>{" "}
            <span className="text-text">Hydrate.</span>{" "}
            <span className="text-blue">Lock&nbsp;in.</span>{" "}
            <span className="text-text">Perform.</span>
          </div>

          <ul className="mt-auto pt-[4vh] space-y-[1.4vh] font-display text-[1.15vw] text-text/75 font-medium">
            <li><span className="text-text font-semibold">The product</span> creates entry.</li>
            <li><span className="text-text font-semibold">The ritual</span> creates behavior.</li>
            <li><span className="text-text font-semibold">The OS</span> creates retention.</li>
          </ul>
        </div>

        <div className="col-span-5 h-full flex items-center justify-center">
          <div className="relative h-full w-full">
            <img
              src={`${base}images/hero-can.png`}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ objectPosition: "center center" }}
            />
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
