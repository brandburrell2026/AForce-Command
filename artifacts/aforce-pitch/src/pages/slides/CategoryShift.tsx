import SlideChrome from "@/components/SlideChrome";

export default function TheShift() {
  return (
    <SlideChrome slide={5}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 70% 50%, rgba(229,51,65,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[4vh]">
          The Shift
        </div>

        <h2 className="font-display text-[5.6vw] leading-[0.92] tracking-tighter max-w-[80vw]">
          AForce is <span className="text-text/45">not</span>
          <br />
          a <span className="text-primary">hydration brand.</span>
        </h2>

        <div className="mt-[8vh] max-w-[68vw] grid grid-cols-3 gap-[2vw]">
          <div className="border-t border-text/15 pt-[2vh]">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              Hydration
            </div>
            <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text">
              is the <span className="text-primary">entry point.</span>
            </div>
          </div>
          <div className="border-t border-text/15 pt-[2vh]">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              Behavior
            </div>
            <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text">
              is the <span className="text-primary">moat.</span>
            </div>
          </div>
          <div className="border-t border-text/15 pt-[2vh]">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              The OS
            </div>
            <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text">
              <span className="text-primary">compounds</span> retention.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
