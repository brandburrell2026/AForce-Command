import SlideChrome from "@/components/SlideChrome";

export default function TheProduct() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={6}>
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-7 flex flex-col">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              The Product
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h2 className="font-display font-black tracking-[-0.035em] text-[6.2vw] leading-[0.92] text-text">
            Two formats.<br />
            <span className="text-red">One ritual.</span>
          </h2>

          <p className="mt-[3vh] font-display font-medium text-[1.4vw] text-text/70 max-w-[34vw] leading-[1.35]">
            Alkaline Force, pH 8.8. The formulation enters. The behavior retains.
          </p>

          <div className="mt-[4vh] pt-[2.5vh] grid grid-cols-2 gap-x-[3vw] border-t border-divider">
            <ProductBlock tag="01 · Format" name="The RTD" line="Sustained daily readiness." meta="Ready to drink · 16oz · pH 8.8" />
            <ProductBlock tag="02 · Format" name="The Stick" line="Travel. Immediate correction." meta="Hydration stick · Single serve · pH 8.8" accent />
          </div>

          <div className="mt-auto pt-[3vh] font-display text-[1.05vw] font-semibold text-text/85 max-w-[42vw]">
            The moat is not the formulation. <span className="text-red">The moat is the behavior.</span>
          </div>
        </div>

        <div className="col-span-5 h-full flex items-center justify-center">
          <img
            src={`${base}images/hero-can.png`}
            alt=""
            className="w-full max-h-[68vh] object-contain"
          />
        </div>
      </div>
    </SlideChrome>
  );
}

function ProductBlock({ tag, name, line, meta, accent }: { tag: string; name: string; line: string; meta: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] font-semibold text-text/45 mb-[1.2vh]">
        {tag}
      </div>
      <div className={`font-display font-black text-[2.4vw] leading-[1] tracking-[-0.03em] ${accent ? "text-blue" : "text-text"}`}>
        {name}
      </div>
      <div className="mt-[1.4vh] font-display text-[0.95vw] font-medium text-text/70 leading-[1.4]">
        {line}
      </div>
      <div className="mt-[1.2vh] font-display uppercase tracking-[0.2em] text-[0.55vw] font-semibold text-text/40">
        {meta}
      </div>
    </div>
  );
}
