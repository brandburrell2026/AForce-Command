export default function Roadmap() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">17 — Roadmap</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">17 / 19</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6.5vw] leading-[0.95] tracking-tighter text-balance">
          From launch to <span className="text-accent">national.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-primary mb-[2vh]">Year 01</div>
          <div className="font-display text-[3vw] leading-tight text-text mb-[2vh]">Stand up.</div>
          <div className="h-[2px] w-full bg-primary/60 mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">DTC live. Three flagship cities. Founding gym partnerships. First 10K customers.</div>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-blue mb-[2vh]">Year 02</div>
          <div className="font-display text-[3vw] leading-tight text-text mb-[2vh]">Scale out.</div>
          <div className="h-[2px] w-full bg-blue/60 mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">Premium grocery rollout. 1,000 doors. Sticks in every major studio chain.</div>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[2vh]">Year 03</div>
          <div className="font-display text-[3vw] leading-tight text-text mb-[2vh]">Take share.</div>
          <div className="h-[2px] w-full bg-accent/60 mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">Mass retail. Two new flavors. International pilot. Category-defining brand.</div>
        </div>
      </div>
    </div>
  );
}
