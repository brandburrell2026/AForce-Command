import SlideChrome from "@/components/SlideChrome";

export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={1} hideChrome>
      <div className="absolute inset-0 flex bg-bg text-text overflow-hidden">
        <div className="w-5/12 px-[5vw] py-[7vh] flex flex-col justify-between h-full">
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-text/70 font-medium">
            AForce
          </div>

          <div>
            <h1 className="font-display font-light leading-[1.04] tracking-tight text-[5.6vw]">
              Pause.<br />
              Hydrate.<br />
              Lock&nbsp;In.<br />
              <span className="italic text-text/80">Perform.</span>
            </h1>
            <div className="mt-[4vh] pt-[2.5vh] border-t border-divider max-w-[26vw]">
              <p className="font-display font-light text-[1.6vw] leading-[1.35] text-text/75">
                A real-time human performance operating system.
              </p>
            </div>
          </div>

          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium">
            Investor Briefing · 2026
          </div>
        </div>

        <div className="w-7/12 py-[5vh] pr-[5vw] h-full">
          <div className="w-full h-full overflow-hidden bg-bg-elev">
            <img
              src={`${base}images/doc-cover.png`}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: "saturate(0.55) contrast(1.08) sepia(0.18)", objectPosition: "center 30%" }}
            />
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
