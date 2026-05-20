import SlideChrome from "@/components/SlideChrome";

const ARCHETYPES = [
  { tag: "Founders", detail: "Pre-raise, pre-launch, pre-pitch." },
  { tag: "Finance Operators", detail: "Brickell. Wall Street. High-stakes execution." },
  { tag: "High-Performance Pros", detail: "Surgeons. Athletes. Performers." },
  { tag: "Disciplined Builders", detail: "Quiet, controlled, daily." },
];

export default function TargetUser() {
  return (
    <SlideChrome slide={18}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Target User
        </div>

        <h2 className="font-display text-[4.8vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Quiet luxury <span className="text-primary">performance.</span>
        </h2>
        <div className="mt-[2vh] font-display text-[1.4vw] leading-[1.2] tracking-tight text-text/55 max-w-[55vw]">
          Not fitness influencer aesthetic. <span className="text-text">Not Celsius.</span>
        </div>

        <div className="mt-[6vh] grid grid-cols-2 gap-x-[4vw] gap-y-[2.5vh] max-w-[70vw]">
          {ARCHETYPES.map((a) => (
            <div key={a.tag} className="border-t border-text/15 pt-[1.5vh]">
              <div className="font-display text-[1.8vw] leading-[1.1] tracking-tight text-text">
                {a.tag}
              </div>
              <div className="font-body text-[0.9vw] text-text/55 mt-[0.6vh] leading-[1.5]">
                {a.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] grid grid-cols-3 gap-[2vw] max-w-[70vw]">
          <div>
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Launch market
            </div>
            <div className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text">
              Miami / <span className="text-primary">Brickell</span>
            </div>
          </div>
          <div>
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Why Brickell
            </div>
            <div className="font-body text-[0.95vw] text-text/75 leading-[1.5]">
              Density. Founder access. Finance + performance overlap.
            </div>
          </div>
          <div>
            <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/40 font-semibold mb-[0.6vh]">
              Why not national
            </div>
            <div className="font-body text-[0.95vw] text-text/75 leading-[1.5]">
              A concentrated proof engine — not a national launch.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
