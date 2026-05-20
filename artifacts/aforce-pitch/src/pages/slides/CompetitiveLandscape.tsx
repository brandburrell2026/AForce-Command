import SlideChrome from "@/components/SlideChrome";

export default function CategoryOfOne() {
  return (
    <SlideChrome slide={17}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Category of One
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[6vh]">
          Three categories.
          <br />
          <span className="text-primary">One intersection.</span>
        </h2>

        <div className="relative h-[42vh] max-w-[80vw] mx-auto w-full">
          <div
            className="absolute left-[8%] top-[12%] w-[40%] h-[70%] rounded-full border border-text/30"
            style={{
              background:
                "radial-gradient(circle, rgba(229,51,65,0.10) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute right-[8%] top-[12%] w-[40%] h-[70%] rounded-full border border-text/30"
            style={{
              background:
                "radial-gradient(circle, rgba(84,120,213,0.10) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute left-[30%] top-[35%] w-[40%] h-[70%] rounded-full border border-primary/60"
            style={{
              background:
                "radial-gradient(circle, rgba(182,255,0,0.14) 0%, transparent 70%)",
            }}
          />

          <div className="absolute left-[3%] top-[8%] text-left">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Hydration brands
            </div>
            <div className="font-display text-[1.3vw] leading-[1.15] tracking-tight text-text/85">
              sell <span className="text-text/45">fuel.</span>
            </div>
          </div>

          <div className="absolute right-[3%] top-[8%] text-right">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Wearables
            </div>
            <div className="font-display text-[1.3vw] leading-[1.15] tracking-tight text-text/85">
              read the <span className="text-text/45">body.</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-2%] text-center max-w-[24vw]">
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-primary font-semibold mb-[0.6vh]">
              AForce
            </div>
            <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text">
              creates <span className="text-primary">behavioral infrastructure.</span>
            </div>
          </div>
        </div>

        <div className="mt-[3vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw]">
          <span className="text-text/55">No incumbent owns this space.</span>{" "}
          <span className="text-text">It does not exist yet.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
