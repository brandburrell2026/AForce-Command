import SlideChrome from "@/components/SlideChrome";

export default function TheProduct() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={9}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(84,120,213,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-baseline">
        <div>
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2vh]">
            The Product
          </div>
          <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter">
            Two formats. <span className="text-text/45">One system.</span>
          </h2>
        </div>
      </div>

      <div className="absolute top-[36vh] bottom-[20vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[4vw]">
        <div className="relative flex flex-col items-center justify-end">
          <div
            className="absolute inset-x-[15%] top-[5%] bottom-[20%] rounded-full opacity-45 blur-[5vw]"
            style={{
              background:
                "radial-gradient(circle, rgba(229,51,65,0.45) 0%, transparent 70%)",
            }}
          />
          <div className="flex items-end gap-[1.5vw] relative">
            <img
              src={`${base}can-berry.png`}
              alt=""
              className="h-[38vh] object-contain"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
            <img
              src={`${base}can-soursop.png`}
              alt=""
              className="h-[34vh] object-contain opacity-90"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
            <img
              src={`${base}can-watermelon.png`}
              alt=""
              className="h-[34vh] object-contain opacity-90"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
          </div>
          <div className="relative mt-[3vh] text-center">
            <div className="font-body uppercase tracking-[0.32em] text-[0.8vw] text-primary font-semibold">
              Format 01
            </div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight mt-[0.6vh]">
              RTD
            </div>
            <div className="font-body text-[0.9vw] text-text/55 mt-[0.6vh]">
              Ready-to-drink. Daily readiness.
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-end">
          <div
            className="absolute inset-x-[15%] top-[5%] bottom-[20%] rounded-full opacity-35 blur-[5vw]"
            style={{
              background:
                "radial-gradient(circle, rgba(245,214,55,0.40) 0%, transparent 70%)",
            }}
          />
          <div className="flex items-end gap-[1vw] relative">
            <img
              src={`${base}stick-berry.png`}
              alt=""
              className="h-[34vh] object-contain"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
            <img
              src={`${base}stick-soursop.png`}
              alt=""
              className="h-[34vh] object-contain opacity-90"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
            <img
              src={`${base}stick-watermelon.png`}
              alt=""
              className="h-[34vh] object-contain opacity-90"
              style={{ filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.6))" }}
            />
          </div>
          <div className="relative mt-[3vh] text-center">
            <div className="font-body uppercase tracking-[0.32em] text-[0.8vw] text-primary font-semibold">
              Format 02
            </div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight mt-[0.6vh]">
              Sticks
            </div>
            <div className="font-body text-[0.9vw] text-text/55 mt-[0.6vh]">
              Portable. Built for every moment.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] max-w-[60vw]">
        <div className="font-display text-[1.5vw] leading-[1.2] tracking-tight">
          <span className="text-text/45">The moat is not the formulation.</span>{" "}
          <span className="text-text">The moat is the behavior.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
