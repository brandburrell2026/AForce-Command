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
  },
  {
    name: "Julius",
    role: "Co-Founder",
    img: juliusImg,
    objectPos: "center 20%",
    tags: ["Entrepreneurship", "High-performance environments"],
  },
];

export default function Founders() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw] py-[10vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2.5vh]">
          The Founders
        </div>

        <h2 className="font-display text-[3.6vw] leading-[1.02] tracking-tight max-w-[75vw]">
          <span className="text-text/45">Not a constructed story.</span>
          <br />
          <span className="text-primary">Lived experience.</span>
        </h2>

        <div className="mt-[5vh] grid grid-cols-2 gap-[4vw] max-w-[70vw]">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="flex gap-[1.6vw] items-start">
              {/* Portrait */}
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: "11vw",
                  height: "14vw",
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
                {/* Vignette + bottom-fade */}
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
                    boxShadow:
                      "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                />
              </div>

              {/* Name + tags */}
              <div className="border-l-2 border-primary pl-[1.4vw] pt-[0.4vh]">
                <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
                  {f.role}
                </div>
                <div className="font-display text-[2vw] leading-[1.05] tracking-tight text-text">
                  {f.name}
                </div>
                <div className="mt-[1.5vh] flex flex-wrap gap-[0.4vw]">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="px-[0.8vw] py-[0.4vh] border border-text/15 rounded-full font-body text-[0.78vw] text-text/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[6vh] font-display text-[1.55vw] leading-[1.25] tracking-tight text-text/85 max-w-[60vw]">
          They did not build AForce because they saw a market.
          <br />
          <span className="text-text">
            They built it because they understood the cost of not being ready.
          </span>
        </div>
      </div>
    </SlideChrome>
  );
}
