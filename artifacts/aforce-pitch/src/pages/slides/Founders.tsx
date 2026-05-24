import SlideChrome from "@/components/SlideChrome";
import brandonImg from "@assets/BrandonBB_1779635749106.jpeg";
import juliusImg from "@assets/JuliusB_1779635759805.jpg";

const FOUNDERS = [
  {
    name: "Brandon Burrell",
    role: "Founder",
    img: brandonImg,
    objectPos: "center 20%",
    tags: ["Wall Street", "Entrepreneurship"],
    bio: "Founder-operator with a background in finance and global business operations, including experience at Morgan Stanley and leadership roles across Southeast Asia and Africa. Has built and scaled international businesses in high-performance environments, with a focus on systems, execution, and consistency under pressure. AForce Hydration reflects that philosophy — building a performance system, not just a product.",
  },
  {
    name: "Julius Burrell",
    role: "Co-Founder",
    img: juliusImg,
    objectPos: "center 20%",
    tags: ["Entrepreneurship", "High-performance environments"],
    bio: "Co-founder and systems builder with experience across product development and international business environments. Leads the development of AForce OS, translating hydration and behavior into structured, scalable performance systems. His work ensures AForce operates as an integrated platform across product, technology, and global growth.",
  },
];

export default function Founders() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw] py-[9vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2vh]">
          The Founders
        </div>

        <h2 className="font-display text-[3vw] leading-[1.02] tracking-tight max-w-[75vw]">
          <span className="text-text/45">Not a constructed story.</span>{" "}
          <span className="text-primary">Lived experience.</span>
        </h2>

        <div className="mt-[4vh] grid grid-cols-2 gap-[3.5vw] max-w-[82vw]">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="flex gap-[1.6vw] items-start">
              {/* Portrait */}
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: "10vw",
                  height: "13vw",
                  borderRadius: "2px",
                }}
              >
                <img
                  src={f.img}
                  alt={f.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    objectPosition: f.objectPos,
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

              {/* Name + role + bio + tags */}
              <div className="flex-1 border-l-2 border-primary pl-[1.2vw] pt-[0.2vh]">
                <div className="font-display text-[1.7vw] leading-[1.05] tracking-tight text-text">
                  {f.name}
                </div>
                <div className="font-body uppercase tracking-[0.32em] text-[0.72vw] text-primary font-semibold mt-[0.4vh]">
                  {f.role}
                </div>
                <p className="mt-[1.2vh] font-body text-[0.82vw] text-text/65 leading-[1.55]">
                  {f.bio}
                </p>
                <div className="mt-[1.4vh] flex flex-wrap gap-[0.4vw]">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="px-[0.75vw] py-[0.35vh] border border-text/15 rounded-full font-body text-[0.7vw] text-text/65"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[4vh] font-display text-[1.3vw] leading-[1.3] tracking-tight text-text/80 max-w-[60vw]">
          They did not build AForce because they saw a market.{" "}
          <span className="text-text">
            They built it because they understood the cost of not being ready.
          </span>
        </div>
      </div>
    </SlideChrome>
  );
}
