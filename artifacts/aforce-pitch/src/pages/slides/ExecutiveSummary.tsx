import SlideChrome from "@/components/SlideChrome";

export default function ExecutiveSummary() {
  return (
    <SlideChrome slide={1}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 75% 30%, rgba(84,120,213,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-between px-[6vw] py-[14vh]">
        <div>
          <div className="font-display text-[2.6vw] leading-none tracking-tight text-primary mb-[2vh]">
            AForce
          </div>
          <h1 className="font-display text-[6.2vw] leading-[0.92] tracking-tighter max-w-[70vw]">
            A behavioral performance ecosystem,
            <br />
            <span className="text-text/55">not another hydration brand.</span>
          </h1>
        </div>

        <div className="grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-7">
            <div className="font-body text-[1.15vw] leading-[1.6] text-text/75 max-w-[42vw]">
              The category is loud — stimulation, hype, spikes. AForce operates in the opposite emotional territory: quiet focus, control, preparation before performance.
            </div>
            <div className="mt-[3vh] font-display text-[1.7vw] leading-[1.15] tracking-tight text-text">
              <span className="text-primary">Pause.</span>{" "}
              <span className="text-text">Hydrate.</span>{" "}
              <span className="text-accent">Lock in.</span>{" "}
              <span className="text-text/75">Perform.</span>
            </div>
          </div>
          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.8vw] text-text/45 font-semibold mb-[1.2vh]">
              The immediate objective
            </div>
            <div className="font-display text-[1.5vw] leading-[1.2] tracking-tight text-text mb-[2vh]">
              Build proof. Then build scale.
            </div>
            <div className="font-body text-[0.95vw] leading-[1.5] text-text/55">
              Before America's Real Deal we build proof. After America's Real Deal we build scale.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
