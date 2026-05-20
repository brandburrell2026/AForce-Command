import SlideChrome from "@/components/SlideChrome";

export default function TheProduct() {
  return (
    <SlideChrome slide={8}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Product
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Two formats.
          <br />
          <span className="text-text/50">One system.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-[3vw] max-w-[70vw]">
          <div className="border-t border-text/15 pt-[2.5vh]">
            <div className="font-body uppercase tracking-[0.35em] text-[0.85vw] text-primary font-semibold mb-[1vh]">
              Format 01
            </div>
            <div className="font-display text-[3vw] leading-[1] tracking-tight">RTD</div>
            <div className="font-body text-[0.95vw] text-text/55 mt-[1vh]">
              Ready-to-drink. Daily readiness.
            </div>
          </div>
          <div className="border-t border-text/15 pt-[2.5vh]">
            <div className="font-body uppercase tracking-[0.35em] text-[0.85vw] text-primary font-semibold mb-[1vh]">
              Format 02
            </div>
            <div className="font-display text-[3vw] leading-[1] tracking-tight">Sticks</div>
            <div className="font-body text-[0.95vw] text-text/55 mt-[1vh]">
              Portable. Built for every moment.
            </div>
          </div>
        </div>

        <div className="mt-[8vh] max-w-[55vw]">
          <div className="font-body text-[1.05vw] text-text/60 leading-[1.6]">
            Premium alkaline hydration. Functional ingredients. Performance-focused formulation.
          </div>
          <div className="mt-[3vh] font-display text-[2vw] leading-[1.15] tracking-tight">
            <span className="text-text/45">But the moat is not the formulation.</span>
            <br />
            <span className="text-text">The moat is the behavior.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
