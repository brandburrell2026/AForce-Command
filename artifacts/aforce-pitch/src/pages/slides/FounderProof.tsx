export default function FounderProof() {
  const arenas = [
    {
      label: "Wall Street",
      title: "Capital decisions under pressure.",
      detail: "Sharp at 6 AM. Sharp at 10 PM. The market does not wait for you to recover.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Entrepreneurship",
      title: "Building from zero. High-pressure execution.",
      detail: "Every decision yours. No safety net. No off day. Performance is the only output that counts.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 18% 30%, rgba(229,51,65,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 50% at 85% 80%, rgba(84,120,213,0.12) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">02 — Founder Proof</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">2 / 27</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Origin · Built From That Reality</span>
        </div>
        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Built where performance <span className="text-primary">is required.</span>
        </h2>
      </div>

      <div className="absolute top-[42vh] left-[6vw] right-[6vw] flex items-end justify-between gap-[3vw]">
        <div className="font-display text-[2.3vw] leading-[1.15] tracking-tight max-w-[44vw]">
          <span className="text-text">Environments where there is </span>
          <span className="text-primary">no room for inconsistency.</span>
        </div>
        <div className="font-body text-[1.05vw] text-text/65 max-w-[28vw] leading-snug text-right pb-[1vh]">
          <div className="text-text/85">Where focus matters.</div>
          <div className="text-text/85">Where energy matters.</div>
          <div className="mt-[0.4vh] text-text">Where performance is expected — every day.</div>
        </div>
      </div>

      <div className="absolute top-[60vh] bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw]">
        {arenas.map((a) => (
          <div key={a.label} className={`relative rounded-2xl ring-1 ${a.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${a.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${a.bar}`} />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.85vw] ${a.accent} font-semibold`}>{a.label}</div>
              <div className="font-display text-[1.6vw] leading-tight tracking-tight text-text mt-[1vh]">{a.title}</div>
              <div className="mt-auto pt-[1.2vh] border-t border-text/10 font-body text-[0.95vw] text-text/65 leading-snug">
                {a.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh] flex items-center justify-between gap-[2vw] flex-wrap">
          <div className="font-body uppercase tracking-[0.28em] text-[1vw] text-primary font-semibold">
            AForce was built <span className="text-text">from that reality.</span>
          </div>
          <div className="font-body text-[0.95vw] uppercase tracking-[0.28em] text-text/55">
            Brandon Burrell · Julius Burrell
          </div>
        </div>
      </div>
    </div>
  );
}
