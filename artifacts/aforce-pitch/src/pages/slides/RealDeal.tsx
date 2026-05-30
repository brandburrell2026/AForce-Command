import SlideFrame from "@/components/SlideFrame";

const BADGES = [
  { k: "Platform", v: "National Television" },
  { k: "Status", v: "Selected · Hundreds Reviewed" },
  { k: "On Air", v: "January 2027" },
];

export default function RealDeal() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideFrame slide={3}>
      {/* America's Real Deal logo — the validation mark */}
      <img
        src={`${base}images/brand/americas-real-deal.png`}
        alt="America's Real Deal"
        className="absolute top-1/2 right-[8vw] -translate-y-1/2 w-[15vw] h-auto z-0"
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pr-[30vw]">
        <div className="mb-[5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            Validation
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[5.4vw] leading-[1.02] text-text max-w-[80%]">
          <div>Selected for</div>
          <div className="text-blue font-normal">America's Real Deal.</div>
        </h1>

        <p className="mt-[4vh] max-w-[46vw] font-body text-[1.15vw] leading-[1.55] text-text/70">
          Chosen from hundreds of companies for a nationally televised
          investment platform. This raise builds the proof we walk in with.
        </p>

        <div className="mt-[6vh] flex gap-[1.6vw]">
          {BADGES.map((b, i) => (
            <div
              key={b.v}
              className="border border-text/20 rounded-[0.4vw] px-[1.6vw] py-[1.6vh] bg-bg-elev/60"
            >
              <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text/45 font-medium">
                {b.k}
              </div>
              <div className="mt-[1vh] font-display text-[1.25vw] leading-tight text-text font-medium">
                {b.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
