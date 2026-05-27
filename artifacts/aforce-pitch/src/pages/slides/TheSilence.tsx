import SlideChrome from "@/components/SlideChrome";

export default function TheSilence() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={3}>
      <div className="absolute inset-0">
        <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
          <div className="col-span-7 flex flex-col">
            <div className="flex items-center gap-[1vw] mb-[3.5vh]">
              <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
                The Truth
              </span>
              <span className="block h-[2px] w-[3vw] bg-red" />
            </div>

            <h2 className="font-display font-black tracking-[-0.035em] text-[6.6vw] leading-[0.92] text-text">
              Performance is<br />
              <span className="italic font-light">not built</span><br />
              in <span className="text-red">noise.</span>
            </h2>

            <p className="mt-auto pt-[5vh] font-display text-[1.6vw] font-semibold leading-[1.3] text-text max-w-[36vw]">
              It is built in the <span className="text-blue">silence</span> before the moment.
            </p>
          </div>

          <div className="col-span-5 h-full">
            <div className="w-full h-full overflow-hidden bg-bg-elev">
              <img
                src={`${base}images/doc-silence.png`}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: "saturate(0.55) contrast(1.05) sepia(0.16)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
