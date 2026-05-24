import SlideChrome from "@/components/SlideChrome";
import markImg from "@assets/Mark_Mendel_1779635902137.jpeg";
import kristelImg from "@assets/Kristel_1779635919034.jpeg";
import peterImg from "@assets/Peter_1779635986945.jpeg";
import tomImg from "@assets/Tom_Mastrobuoni_1779635998807.jpeg";
import adamImg from "@assets/Adam_Sobol_1779636043341.jpeg";

const ADVISORS = [
  {
    name: "Mark Mendel",
    role: "Investment Banker · Finalis",
    img: markImg,
    objectPos: "center 30%",
    bio: "Investment banker at Finalis serving as AForce's banker on the $4M Seed raise. Brings 30+ years across venture capital, life sciences, and company building — advising early-stage companies on capital strategy, fundraising structure, and scaling innovation into durable businesses.",
  },
  {
    name: "Kristel van Kleef",
    role: "Advisor",
    img: kristelImg,
    objectPos: "center 25%",
    bio: "20+ years building category-defining brands at global scale. 14 years at Red Bull driving culture-led growth across North America and globally, followed by executive brand leadership at On. Work spans brand building, athlete partnerships, and scaling premium performance products across 80+ markets.",
  },
  {
    name: "Peter Ingwersen",
    role: "Advisor",
    img: peterImg,
    objectPos: "center 30%",
    bio: "35+ years building and repositioning global brands through strategic disruption and cultural insight. 20 years at Levi's across multiple leadership roles, including pioneering sustainability with the NOIR concept. Advises lifestyle brands from luxury houses to high street on differentiated brand narratives.",
  },
  {
    name: "Thomas Mastrobuoni",
    role: "Advisor",
    img: tomImg,
    objectPos: "center 25%",
    bio: "Venture investor and Chief Investment Officer at Big Idea Ventures, where he leads investments across food innovation and sustainability. Brings deep expertise in capital strategy, company building, and scaling early-stage ventures globally.",
  },
  {
    name: "Adam Sobol",
    role: "Advisor",
    img: adamImg,
    objectPos: "center 25%",
    bio: "Senior marketing and customer experience leader with 20+ years driving growth across financial services and global organizations. Leads marketing at BECU and brings deep expertise in acquisition, retention, and business transformation — helping AForce scale its go-to-market and customer growth strategy.",
  },
];

export default function TeamAdvisors() {
  return (
    <SlideChrome slide={16}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] pt-[9vh] pb-[8vh]">
        <div className="flex items-end justify-between mb-[3vh]">
          <div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.8vw] text-text/45 font-semibold mb-[1.6vh]">
              Team &amp; Advisors
            </div>
            <h2 className="font-display text-[2.8vw] leading-[1.02] tracking-tighter">
              Built by people who{" "}
              <span className="text-primary">understand pressure.</span>
            </h2>
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold">
            Advisors · 05
          </div>
        </div>

        <div className="grid grid-cols-5 gap-[1.4vw]">
          {ADVISORS.map((a) => (
            <div key={a.name} className="flex flex-col">
              <div
                className="relative overflow-hidden"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "2px",
                }}
              >
                <img
                  src={a.img}
                  alt={a.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    objectPosition: a.objectPos,
                    filter: "grayscale(1) contrast(1.08) brightness(0.9)",
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                />
              </div>
              <div className="mt-[1.4vh] border-l-2 border-primary pl-[0.8vw]">
                <div className="font-display text-[1.05vw] leading-[1.1] tracking-tight text-text font-bold">
                  {a.name}
                </div>
                <div className="mt-[0.4vh] font-body uppercase tracking-[0.22em] text-[0.6vw] text-primary/85 font-semibold">
                  {a.role}
                </div>
                <div className="mt-[1vh] font-body text-[0.68vw] leading-[1.55] text-text/65">
                  {a.bio}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
