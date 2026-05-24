import SlideChrome from "@/components/SlideChrome";
import brandonImg from "@assets/BrandonBB_1779635749106.jpeg";
import juliusImg from "@assets/JuliusB_1779635759805.jpg";

type Founder = {
  name: string;
  role: string;
  img: string;
  objectPos: string;
  credential: string;
  proofPoints: string[];
  conviction: string;
};

const FOUNDERS: Founder[] = [
  {
    name: "Brandon Burrell",
    role: "Founder · CEO",
    img: brandonImg,
    objectPos: "center 20%",
    credential: "Built under pressure on three continents.",
    proofPoints: [
      "Morgan Stanley · institutional finance",
      "Operating leadership · Southeast Asia, Africa, U.S.",
      "Founder-operator across regulated, high-stakes markets",
    ],
    conviction:
      "AForce was built from the discipline of operating where margin for error is zero.",
  },
  {
    name: "Julius Burrell",
    role: "Co-Founder · CTO",
    img: juliusImg,
    objectPos: "center 20%",
    credential: "Systems builder. International operator.",
    proofPoints: [
      "Product + platform engineering",
      "Cross-border operations · U.S., Africa, EU",
      "Architects the behavioral OS underneath the brand",
    ],
    conviction:
      "Performance is not marketing. It is the system you ship and the system you maintain.",
  },
];

export default function Founders() {
  return (
    <SlideChrome slide={14}>
      {/* Ambient red glow — top right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 88% 12%, rgba(226,92,92,0.10) 0%, transparent 70%)",
        }}
      />
      {/* Ambient cool void — bottom left */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 8% 92%, rgba(255,255,255,0.025) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[8vw] pt-[11vh] pb-[10vh]">
        {/* Eyebrow */}
        <div className="flex items-center justify-between">
          <div className="font-body uppercase tracking-[0.4em] text-[0.78vw] text-text/55 font-semibold">
            The Founders · Lived Conviction
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-semibold">
            Three continents · One standard
          </div>
        </div>

        {/* Headline */}
        <h2 className="font-display text-[4.6vw] leading-[0.96] tracking-tighter mt-[2.4vh] max-w-[80vw]">
          <span className="text-text">Built by operators </span>
          <span className="text-primary">who lived under pressure.</span>
        </h2>

        <div className="mt-[2vh] font-body text-[1vw] text-text/65 leading-[1.55] max-w-[58vw]">
          Not a constructed founder story.{" "}
          <span className="text-text">A standard learned in environments where execution was the only acceptable outcome.</span>
        </div>

        {/* Founders */}
        <div className="mt-[5.5vh] grid grid-cols-2 gap-[4vw] flex-1">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="flex gap-[1.8vw] items-start">
              {/* Portrait — taller, editorial */}
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: "11vw",
                  height: "15vw",
                  borderRadius: "2px",
                }}
              >
                <img
                  src={f.img}
                  alt={f.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    objectPosition: f.objectPos,
                    filter: "grayscale(1) contrast(1.12) brightness(0.92)",
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)",
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow:
                      "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 40px rgba(226,92,92,0.06)",
                  }}
                />
              </div>

              {/* Editorial column */}
              <div className="flex-1 min-w-0">
                <div className="font-body uppercase tracking-[0.32em] text-[0.68vw] text-primary font-semibold">
                  {f.role}
                </div>
                <div className="mt-[0.6vh] font-display text-[2vw] leading-[1.02] tracking-tight text-text">
                  {f.name}
                </div>

                {/* Credential — italic editorial */}
                <div className="mt-[1.4vh] font-display text-[1.05vw] leading-[1.35] tracking-tight text-text/90 italic">
                  “{f.credential}”
                </div>

                {/* Proof points — disciplined list, no pills */}
                <ul className="mt-[2vh] flex flex-col gap-[0.7vh] border-l border-primary/40 pl-[1vw]">
                  {f.proofPoints.map((p) => (
                    <li
                      key={p}
                      className="font-body text-[0.78vw] text-text/75 leading-[1.45] tracking-tight"
                    >
                      {p}
                    </li>
                  ))}
                </ul>

                {/* Conviction line */}
                <div className="mt-[2vh] font-body text-[0.78vw] text-text/55 leading-[1.55] italic max-w-[20vw]">
                  {f.conviction}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Closing line */}
        <div className="mt-[4vh] pt-[2.5vh] border-t border-text/12 flex items-baseline justify-between gap-[3vw]">
          <div className="font-display text-[1.4vw] leading-[1.2] tracking-tight text-text max-w-[58vw]">
            They understand performance{" "}
            <span className="text-primary">because they lived it</span> —
            in markets that did not forgive imprecision.
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.68vw] text-text/45 font-semibold text-right shrink-0">
            Discipline · Resilience · Range
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
