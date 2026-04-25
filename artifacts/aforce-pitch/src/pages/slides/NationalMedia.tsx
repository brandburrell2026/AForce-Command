export default function NationalMedia() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">05 — National Media</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">05 / 28</div>
      </div>

      <div
        className="absolute inset-y-0 right-0 w-[40vw] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at right center, rgba(245,214,55,0.12) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Launch Catalyst</span>
        </div>
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance">
          <span className="text-accent">National</span> media catalyst.
        </h2>
        <p className="mt-[2vh] font-body text-[1.6vw] text-text/75 max-w-[60vw] leading-snug">
          AForce selected for <span className="text-text font-semibold">America&apos;s Real Deal — Season 2</span>, a nationally distributed business series airing on Amazon Prime and syndicated TV. Timed precisely with our Spring 2026 launch.
        </p>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw] grid grid-cols-[1.4fr_1fr] gap-[4vw]">
        <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[2.4vh]">
          <div className="flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.8vw] text-accent shrink-0">01</div>
            <div>
              <div className="font-display text-[1.6vw] text-text mb-[0.6vh]">National Brand Visibility</div>
              <div className="font-body text-[1.15vw] text-text/70 leading-snug">Millions of viewers introduced to AForce at the exact moment of launch.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.8vw] text-accent shrink-0">02</div>
            <div>
              <div className="font-display text-[1.6vw] text-text mb-[0.6vh]">Retail Buyer Awareness</div>
              <div className="font-body text-[1.15vw] text-text/70 leading-snug">Accelerates conversations with major retail buyers seeking momentum brands.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.8vw] text-accent shrink-0">03</div>
            <div>
              <div className="font-display text-[1.6vw] text-text mb-[0.6vh]">Investor Attention</div>
              <div className="font-body text-[1.15vw] text-text/70 leading-snug">Primetime visibility signals market validation during early-growth window.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.8vw] text-accent shrink-0">04</div>
            <div>
              <div className="font-display text-[1.6vw] text-text mb-[0.6vh]">Launch Momentum</div>
              <div className="font-body text-[1.15vw] text-text/70 leading-snug">TV exposure synced with first production run drives rapid trial.</div>
            </div>
          </div>
        </div>

        <div className="bg-bg-elev rounded-lg p-[2vw] border border-text/10 flex flex-col gap-[2vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-muted">Timeline</div>
          <div>
            <div className="font-display text-[1.7vw] text-text">Spring 2026</div>
            <div className="font-body text-[1.1vw] text-text/70 leading-snug">Product launch + first production run.</div>
          </div>
          <div className="h-[1px] bg-divider" />
          <div>
            <div className="font-display text-[1.7vw] text-text">Summer 2026</div>
            <div className="font-body text-[1.1vw] text-text/70 leading-snug">America&apos;s Real Deal Season 2 filming.</div>
          </div>
          <div className="h-[1px] bg-divider" />
          <div>
            <div className="font-display text-[1.7vw] text-accent">Fall 2026 — Peak</div>
            <div className="font-body text-[1.1vw] text-text/70 leading-snug">National broadcast on Amazon Prime + syndicated TV.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
