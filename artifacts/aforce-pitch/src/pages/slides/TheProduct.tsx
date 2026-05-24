import SlideChrome from "@/components/SlideChrome";

import canSoursop from "@assets/CAN_3D_Soursop_11oz_1779553713234.png";
import canBerry from "@assets/CAN_3D_Berry_11oz_1779553713236.png";
import canMelon from "@assets/CAN_3D_MELON_11oz_1779553713237.png";
import stickBerry from "@assets/Stick_3D_Berry_nobg.png";
import stickSoursop from "@assets/Stick_3D_Soursop_nobg.png";
import stickWatermelon from "@assets/Stick_3D_Watermelon_nobg.png";

type Flavor = {
  label: string;
  name: string;
  pair: string;
  pairColor: string;
  description: string;
  can: string;
  stick: string;
  border: string;
  glow: string;
  cardBg: string;
};

const FLAVORS: Flavor[] = [
  {
    label: "Flavor 01",
    name: "Berry Blast",
    pair: "+ Dulse",
    pairColor: "#5478D5",
    description:
      "For recovery, minerals, and daily control. A sea vegetable rich in iodine, iron, and potassium.",
    can: canBerry,
    stick: stickBerry,
    border: "rgba(84,120,213,0.55)",
    glow: "rgba(84,120,213,0.35)",
    cardBg:
      "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(84,120,213,0.18) 0%, rgba(10,12,28,0.85) 70%)",
  },
  {
    label: "Flavor 02",
    name: "Watermelon Surge",
    pair: "+ Chlorella",
    pairColor: "#E25C5C",
    description:
      "For heat, stress, and performance correction. Natural electrolytes paired with a green-algae superfood.",
    can: canMelon,
    stick: stickWatermelon,
    border: "rgba(226,92,92,0.55)",
    glow: "rgba(226,92,92,0.35)",
    cardBg:
      "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(226,92,92,0.18) 0%, rgba(28,10,12,0.85) 70%)",
  },
  {
    label: "Flavor 03",
    name: "Soursop Edge",
    pair: "+ Sea Moss",
    pairColor: "#E6C84A",
    description:
      "For deep recovery, minerals, and sustained support. 92 minerals from one ocean-grown botanical.",
    can: canSoursop,
    stick: stickSoursop,
    border: "rgba(230,200,74,0.55)",
    glow: "rgba(230,200,74,0.35)",
    cardBg:
      "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(230,200,74,0.16) 0%, rgba(28,24,8,0.85) 70%)",
  },
];

export default function TheProduct() {
  return (
    <SlideChrome slide={8}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[5vh] pb-[3.5vh]">
        <div className="flex items-baseline gap-[1vw]">
          <span className="font-body uppercase tracking-[0.35em] text-[0.85vw] text-primary font-semibold">
            08 — Product
          </span>
        </div>
        <div className="mt-[1.2vh] flex items-center gap-[1vw]">
          <div className="h-px w-[3vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.4em] text-[0.75vw] text-text/55 font-semibold">
            The Lineup
          </span>
        </div>

        <h2 className="mt-[2.2vh] font-display text-[4.6vw] leading-[1] tracking-tighter">
          One <span className="text-[#E25C5C]">system.</span> Delivered through{" "}
          <span className="text-primary">product.</span>
        </h2>

        <div className="mt-[1.4vh] font-body text-[1vw] text-text/55">
          Three signature flavors. Two formats. One performance loop.
        </div>

        <div className="mt-[2vh] font-body italic text-[1.05vw] text-text/85">
          <span className="text-[#E25C5C] not-italic mr-[0.4vw]">“</span>AForce is the system we
          built to <span className="text-[#E25C5C]">stay sharp</span> when performance wasn&apos;t
          optional.
        </div>

        <div className="flex-1 grid grid-cols-3 gap-[1.6vw] mt-[2.4vh] min-h-0">
          {FLAVORS.map((f) => (
            <div
              key={f.name}
              className="relative flex flex-col rounded-[1.2vw] p-[1.4vw] min-h-0 overflow-hidden"
              style={{
                background: f.cardBg,
                border: `1px solid ${f.border}`,
                boxShadow: `inset 0 0 60px ${f.glow}, 0 20px 50px rgba(0,0,0,0.5)`,
              }}
            >
              <div className="flex-1 flex items-end justify-center gap-[1vw] min-h-0">
                <img
                  src={f.can}
                  alt={`${f.name} can`}
                  className="max-h-full object-contain"
                  style={{
                    maxWidth: "55%",
                    filter: `drop-shadow(0 18px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 32px ${f.glow})`,
                  }}
                />
                <img
                  src={f.stick}
                  alt={`${f.name} stick`}
                  className="max-h-full object-contain"
                  style={{
                    maxWidth: "42%",
                    filter: `drop-shadow(0 14px 22px rgba(0,0,0,0.6)) drop-shadow(0 0 24px ${f.glow})`,
                  }}
                />
              </div>

              <div className="mt-[1.6vh]">
                <div
                  className="font-body uppercase tracking-[0.32em] text-[0.7vw] font-semibold"
                  style={{ color: f.pairColor }}
                >
                  {f.label}
                </div>
                <div className="mt-[0.6vh] font-display text-[1.55vw] leading-[1.05] tracking-tight text-text">
                  {f.name}{" "}
                  <span style={{ color: f.pairColor }}>{f.pair}</span>
                </div>
                <div className="mt-[1vh] font-body text-[0.78vw] text-text/55 leading-[1.5]">
                  {f.description}
                </div>
                <div className="mt-[1.4vh] pt-[1vh] border-t border-text/10 font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/45 font-semibold">
                  325ML Can · 14G Stick
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[2vh] flex items-center justify-between font-body uppercase tracking-[0.32em] text-[0.7vw] font-semibold">
          <div className="text-[#E25C5C]">
            pH 8.8 <span className="text-text/40 mx-[0.6vw]">·</span>
            <span className="text-text/65">Zero Sugar</span>
          </div>
          <div className="text-text/85 tracking-[0.2em] normal-case font-display text-[1.1vw]">
            Every <span className="text-[#5478D5]">format</span> serves the same outcome:{" "}
            <span className="text-[#E25C5C]">sustained performance.</span>
          </div>
          <div className="text-text/55 text-right leading-[1.6]">
            Summer 2026 Launch
            <br />
            <span className="text-text/40">Cans + Sticks · Day One</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
