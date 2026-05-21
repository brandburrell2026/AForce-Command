import SlideChrome from "@/components/SlideChrome";

export default function TheProduct() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={8}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 70% 50%, rgba(84,120,213,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-y-0 right-[2vw] w-[40vw] flex items-center justify-center pointer-events-none">
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="h-[75vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 50px rgba(84,120,213,0.20))",
          }}
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Product
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[55vw]">
          Two formats.
          <br />
          <span className="text-primary">One system.</span>
        </h2>

        <div className="mt-[5vh] grid grid-cols-2 gap-[2vw] max-w-[42vw]">
          <div className="border-l-2 border-primary pl-[1.4vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              Format 01
            </div>
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">RTD</div>
            <div className="font-body text-[0.9vw] text-text/55 mt-[0.5vh]">Sustained daily readiness.</div>
          </div>
          <div className="border-l-2 border-accent pl-[1.4vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              Format 02
            </div>
            <div className="font-display text-[2vw] leading-none tracking-tight text-text">Sticks</div>
            <div className="font-body text-[0.9vw] text-text/55 mt-[0.5vh]">Travel. Immediate correction.</div>
          </div>
        </div>

        <div className="mt-[6vh] font-body text-[1vw] text-text/55 leading-[1.6] max-w-[40vw]">
          Premium alkaline hydration. Functional ingredients. Performance-focused formulation.
        </div>

        <div className="mt-[3vh] font-display text-[2.2vw] leading-[1.1] tracking-tight text-text max-w-[42vw]">
          But the moat is not the formulation.
          <br />
          <span className="text-primary">The moat is the behavior.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
