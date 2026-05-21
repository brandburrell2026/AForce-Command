import SlideChrome from "@/components/SlideChrome";

const FOUNDERS = [
  { name: "Brandon Burrell", tags: ["NBA", "Wall Street", "Entrepreneurship"] },
  { name: "Julius", tags: ["Wall Street", "High-performance environments"] },
];

export default function Founders() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Founders
        </div>

        <h2 className="font-display text-[4.4vw] leading-[1.02] tracking-tight max-w-[75vw]">
          <span className="text-text/45">Not a constructed story.</span>
          <br />
          <span className="text-primary">Lived experience.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-[3vw] max-w-[75vw]">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="border-l-2 border-primary pl-[1.6vw]">
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
                Founder
              </div>
              <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">
                {f.name}
              </div>
              <div className="mt-[1.5vh] flex flex-wrap gap-[0.5vw]">
                {f.tags.map((t) => (
                  <span
                    key={t}
                    className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[8vh] font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/85 max-w-[60vw]">
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
