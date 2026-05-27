import SlideChrome from "@/components/SlideChrome";

export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={1} eyebrow="01 · Executive Summary" invertChrome>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${base}images/cover-bg.png)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 35%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.1) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-7 flex flex-col h-full">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-bg/85">
              Executive Summary
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h1 className="font-display font-black tracking-[-0.035em] text-[7vw] leading-[0.92] text-bg drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
            A behavioral<br />
            <span className="text-red">performance</span><br />
            ecosystem.
          </h1>

          <div className="mt-[5vh] font-display font-bold tracking-tight text-[2vw] leading-[1.1]">
            <span className="text-red">Pause.</span>{" "}
            <span className="text-bg">Hydrate.</span>{" "}
            <span className="text-blue">Lock&nbsp;in.</span>{" "}
            <span className="text-bg">Perform.</span>
          </div>

          <ul className="mt-auto pt-[4vh] space-y-[1.2vh] font-display text-[1.05vw] text-bg/75 font-medium">
            <li><span className="text-bg font-semibold">The product</span> creates entry.</li>
            <li><span className="text-bg font-semibold">The ritual</span> creates behavior.</li>
            <li><span className="text-bg font-semibold">The OS</span> creates retention.</li>
          </ul>
        </div>
      </div>
    </SlideChrome>
  );
}
