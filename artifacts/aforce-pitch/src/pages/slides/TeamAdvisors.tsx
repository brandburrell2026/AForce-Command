import SlideChrome from "@/components/SlideChrome";
import markImg from "@assets/Mark_Mendel_1779635902137.jpeg";
import kristelImg from "@assets/Kristel_1779635919034.jpeg";
import peterImg from "@assets/Peter_1779635986945.jpeg";
import tomImg from "@assets/Tom_Mastrobuoni_1779635998807.jpeg";
import adamImg from "@assets/Adam_Sobol_1779636043341.jpeg";

const ADVISORS = [
  { name: "Mark Mendel", img: markImg, objectPos: "center 30%" },
  { name: "Kristel van Kleef", img: kristelImg, objectPos: "center 25%" },
  { name: "Peter Ingwersen", img: peterImg, objectPos: "center 30%" },
  { name: "Thomas Mastrobouni", img: tomImg, objectPos: "center 25%" },
  { name: "Adam Sobol", img: adamImg, objectPos: "center 25%" },
];

const DOMAINS = [
  "Pressure",
  "Scaling",
  "Performance",
  "Behavior",
  "Global brand building",
  "Retention systems",
  "Recurring consumer ecosystems",
];

export default function TeamAdvisors() {
  return (
    <SlideChrome slide={16}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw] py-[9vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2.5vh]">
          Team &amp; Advisors
        </div>

        <h2 className="font-display text-[3.6vw] leading-[1.02] tracking-tighter max-w-[75vw]">
          Built by people who
          <br />
          <span className="text-primary">understand pressure.</span>
        </h2>

        {/* Advisor row */}
        <div className="mt-[5vh] max-w-[84vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[2vh]">
            Advisors
          </div>
          <div className="grid grid-cols-5 gap-[1.6vw]">
            {ADVISORS.map((a) => (
              <div key={a.name} className="flex flex-col">
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 5",
                    borderRadius: "2px",
                  }}
                >
                  <img
                    src={a.img}
                    alt={a.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      objectPosition: a.objectPos,
                      filter:
                        "grayscale(1) contrast(1.08) brightness(0.9)",
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      boxShadow:
                        "inset 0 0 0 1px rgba(255,255,255,0.06)",
                    }}
                  />
                </div>
                <div className="mt-[1.2vh] border-l-2 border-primary pl-[0.8vw]">
                  <div className="font-display text-[1.05vw] leading-[1.15] tracking-tight text-text">
                    {a.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Domain expertise */}
        <div className="mt-[5vh] max-w-[80vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
            Domain expertise
          </div>
          <div className="flex flex-wrap gap-x-[1.4vw] gap-y-[1vh]">
            {DOMAINS.map((d, i) => (
              <div key={d} className="flex items-baseline gap-[0.5vw]">
                <span className="font-body text-[0.65vw] tracking-[0.4em] uppercase text-text/35 font-semibold tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[1.05vw] leading-[1.2] tracking-tight text-text/85">
                  {d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
