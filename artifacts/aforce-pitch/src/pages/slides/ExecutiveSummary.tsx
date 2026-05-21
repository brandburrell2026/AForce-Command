import SlideChrome from "@/components/SlideChrome";

export default function ExecutiveSummary() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={1} hideChrome>
      <div className="absolute inset-0 bg-black" />

      <div className="absolute inset-y-0 right-0 w-[48vw] flex items-center justify-center">
        <div
          className="absolute w-[36vw] h-[36vw] rounded-full opacity-50 blur-[6vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(84,120,213,0.55) 0%, rgba(84,120,213,0.15) 45%, transparent 72%)",
          }}
        />
        <div
          className="absolute bottom-[10vh] w-[24vw] h-[3vh] rounded-[50%] blur-[2vw] opacity-65"
          style={{
            background:
              "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)",
          }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[82vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.65)) drop-shadow(0 0 60px rgba(84,120,213,0.30))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[60vw] pointer-events-none"
        style={{
          background: "linear-gradient(to right, #000 64%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-between px-[8vw] py-[8vh] pointer-events-none">
        <div className="flex items-baseline justify-between">
          <div className="font-display text-[2vw] leading-none tracking-tight text-primary">
            AForce
          </div>
          <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
            Investor Deck · Phase 1 · Proof of Concept · May 2026
          </div>
        </div>

        <div className="max-w-[55vw]">
          <div className="font-body uppercase tracking-[0.4em] text-[0.8vw] text-text/45 font-semibold mb-[2vh]">
            Executive Summary
          </div>
          <h1 className="font-display text-[5.6vw] leading-[0.9] tracking-tighter">
            A behavioral
            <br />
            <span className="text-primary">performance</span>
            <br />
            ecosystem.
          </h1>
          <div className="mt-[4vh] flex flex-wrap gap-x-[1.5vw] gap-y-[1vh] font-display text-[1.8vw] leading-none tracking-tight">
            <span className="text-primary">Pause.</span>
            <span className="text-text">Hydrate.</span>
            <span className="text-accent">Lock in.</span>
            <span className="text-text/70">Perform.</span>
          </div>
        </div>

        <div className="max-w-[44vw] flex flex-col gap-[0.8vh]">
          <div className="font-body text-[1vw] text-text/55 leading-[1.6]">
            The product creates <span className="text-text">entry.</span>
          </div>
          <div className="font-body text-[1vw] text-text/55 leading-[1.6]">
            The ritual creates <span className="text-text">behavior.</span>
          </div>
          <div className="font-body text-[1vw] text-text/55 leading-[1.6]">
            The OS creates <span className="text-text">retention.</span>
          </div>
          <div className="mt-[1.5vh] font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/35 font-semibold">
            Before America's Real Deal we build proof. After, we build scale.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
