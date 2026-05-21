import SlideChrome from "@/components/SlideChrome";

export default function FinalSlide() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={31} hideChrome>
      <div className="absolute inset-0 bg-black" />

      <div className="absolute inset-y-0 right-[-6vw] w-[40vw] flex items-center justify-center opacity-55">
        <div
          className="absolute w-[30vw] h-[30vw] rounded-full opacity-50 blur-[7vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(84,120,213,0.50) 0%, transparent 72%)",
          }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[80vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.6)) drop-shadow(0 0 60px rgba(84,120,213,0.30))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[65vw] pointer-events-none"
        style={{
          background: "linear-gradient(to right, #000 65%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw] pointer-events-none">
        <div className="font-display text-[5.2vw] leading-[1] tracking-tighter text-text max-w-[50vw]">
          Performance is
          <br />
          <span className="text-primary">non-negotiable.</span>
        </div>
        <div className="mt-[3vh] font-body text-[1.1vw] text-text/65 leading-[1.6] max-w-[40vw]">
          AForce makes sure you are always on.
        </div>

        <div className="mt-[5vh] flex flex-col gap-[0.4vh]">
          <div className="font-display text-[2vw] tracking-tight text-primary">Pause.</div>
          <div className="font-display text-[2vw] tracking-tight text-text">Hydrate.</div>
          <div className="font-display text-[2vw] tracking-tight text-accent">Lock in.</div>
          <div className="font-display text-[2vw] tracking-tight text-text/70">Perform.</div>
        </div>

        <div className="mt-[6vh] max-w-[42vw]">
          <div className="font-body text-[1vw] text-text/55 leading-[1.6]">
            This is not a hydration brand.
          </div>
          <div className="font-display text-[1.6vw] leading-[1.2] tracking-tight text-text mt-[0.6vh]">
            This is a behavioral performance ecosystem.
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
          AForce
        </div>
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
          Phase 1 · Proof of Concept · May 2026
        </div>
      </div>
    </SlideChrome>
  );
}
