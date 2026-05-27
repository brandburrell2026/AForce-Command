import SlideChrome from "@/components/SlideChrome";

export default function TheFinal() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={15} hideChrome>
      <div className="absolute inset-0">
        <img
          src={`${base}images/doc-final.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(0.5) contrast(1.05) sepia(0.2) brightness(0.92)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(244,241,234,0.75) 0%, rgba(244,241,234,0.4) 50%, rgba(244,241,234,0.92) 100%)",
          }}
        />

        <div className="absolute inset-0 flex flex-col px-[9vw] py-[7vh]">
          <div className="flex items-center justify-between">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/55 font-medium">
              AForce<span className="text-[0.6em] align-super tracking-normal ml-[0.15em]">™</span>
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium tabular-nums">
              15 / 15
            </div>
          </div>

          <div className="my-auto max-w-[58vw]">
            <h2 className="font-display font-light text-[6vw] leading-[1] tracking-tight">
              Performance is<br />
              <span className="italic">non-negotiable.</span>
            </h2>
            <div className="mt-[5vh] pt-[3vh] border-t border-text/30 max-w-[44vw]">
              <p className="font-display font-light text-[1.7vw] leading-[1.35] text-text/85">
                AForce makes sure you are always on.<br />
                <span className="italic text-text/65">Pause. Hydrate. Lock In. Perform.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-medium max-w-[44vw]">
              Not a hydration brand. A behavioral performance ecosystem.
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium">
              Investor Briefing · 2026
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
