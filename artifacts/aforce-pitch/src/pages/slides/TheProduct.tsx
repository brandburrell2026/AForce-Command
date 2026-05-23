import SlideChrome from "@/components/SlideChrome";

import canSoursop from "@assets/CAN_3D_Soursop_11oz_1779553713234.png";
import canBerry from "@assets/CAN_3D_Berry_11oz_1779553713236.png";
import canMelon from "@assets/CAN_3D_MELON_11oz_1779553713237.png";
import stickBerry from "@assets/Stick_3D_Berry_(6)_1779553713238.jpg";
import stickSoursop from "@assets/Stick_3D_Soursop_(5)_1779553713238.jpg";
import stickWatermelon from "@assets/Stick_3D_Watermelon_(7)_1779553713238.jpg";

const CANS = [
  { src: canSoursop, name: "Soursop Edge", sub: "+ Seamoss", tint: "rgba(214,191,69,0.22)" },
  { src: canBerry, name: "Berry Blast", sub: "+ Dulse", tint: "rgba(84,120,213,0.22)" },
  { src: canMelon, name: "Watermelon Surge", sub: "+ Chlorella", tint: "rgba(217,80,80,0.22)" },
];

const STICKS = [
  { src: stickSoursop, name: "Soursop Edge", sub: "+ Seamoss", tint: "rgba(214,191,69,0.22)" },
  { src: stickBerry, name: "Berry Blast", sub: "+ Dulse", tint: "rgba(84,120,213,0.22)" },
  { src: stickWatermelon, name: "Watermelon Surge", sub: "+ Chlorella", tint: "rgba(217,80,80,0.22)" },
];

export default function TheProduct() {
  return (
    <SlideChrome slide={8}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(84,120,213,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[8vh] pb-[6vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2vh]">
          The Product
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Two formats. <span className="text-primary">Six SKUs.</span>
          <br />
          <span className="text-text/55 text-[2.6vw] font-body tracking-normal leading-[1.4] block mt-[1.5vh]">
            One behavioral system.
          </span>
        </h2>

        <div className="flex-1 grid grid-cols-[1.15fr_1fr] gap-[3vw] mt-[3vh] min-h-0">
          <div className="border-l-2 border-primary pl-[1.6vw] flex flex-col min-h-0">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.4vh]">
              Format 01 · RTD
            </div>
            <div className="font-display text-[1.5vw] leading-none tracking-tight text-text mb-[2vh]">
              Sustained daily readiness.
            </div>
            <div className="flex-1 grid grid-cols-3 gap-[1.2vw] items-end min-h-0">
              {CANS.map((p) => (
                <div key={p.name} className="flex flex-col items-center min-h-0">
                  <div className="flex-1 flex items-end justify-center w-full min-h-0">
                    <img
                      src={p.src}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain"
                      style={{
                        filter: `drop-shadow(0 20px 30px rgba(0,0,0,0.55)) drop-shadow(0 0 36px ${p.tint})`,
                      }}
                    />
                  </div>
                  <div className="font-display text-[1vw] tracking-tight text-text mt-[1.2vh] text-center leading-[1.1]">
                    {p.name}
                  </div>
                  <div className="font-body text-[0.72vw] text-text/55 mt-[0.3vh] text-center">
                    {p.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-accent pl-[1.6vw] flex flex-col min-h-0">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.4vh]">
              Format 02 · Sticks
            </div>
            <div className="font-display text-[1.5vw] leading-none tracking-tight text-text mb-[2vh]">
              Travel. Immediate correction.
            </div>
            <div className="flex-1 grid grid-cols-3 gap-[1vw] items-end min-h-0">
              {STICKS.map((p) => (
                <div key={p.name} className="flex flex-col items-center min-h-0">
                  <div className="flex-1 flex items-end justify-center w-full min-h-0">
                    <img
                      src={p.src}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain"
                      style={{
                        filter: `drop-shadow(0 20px 30px rgba(0,0,0,0.55)) drop-shadow(0 0 30px ${p.tint})`,
                      }}
                    />
                  </div>
                  <div className="font-display text-[0.95vw] tracking-tight text-text mt-[1.2vh] text-center leading-[1.1]">
                    {p.name}
                  </div>
                  <div className="font-body text-[0.7vw] text-text/55 mt-[0.3vh] text-center">
                    {p.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[3vh] font-display text-[1.6vw] leading-[1.15] tracking-tight text-text max-w-[60vw]">
          The moat is not the formulation.
          <br />
          <span className="text-primary">The moat is the behavior.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
