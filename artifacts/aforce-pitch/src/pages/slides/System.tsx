export default function System() {
  const base = import.meta.env.BASE_URL;
  const cans = [
    { src: `${base}can-berry.png`, label: "Berry Blast", glow: "rgba(229,51,65,0.45)" },
    { src: `${base}can-watermelon.png`, label: "Watermelon", glow: "rgba(245,214,55,0.42)" },
    { src: `${base}can-soursop.png`, label: "Soursop", glow: "rgba(84,213,148,0.42)" },
  ];
  const designedFor = [
    { label: "Stability", body: "Hold the body's chemistry under pressure." },
    { label: "Recovery", body: "Restore faster between cycles of effort." },
    { label: "Output", body: "Sustain performance when others fade." },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">06 — Product</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">06 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Product · The System</span>
          </div>
          <h1 className="font-display text-[4.6vw] leading-[0.92] tracking-tighter text-balance">
            One system. <span className="text-primary">Delivered through product.</span>
          </h1>
        </div>
        <div className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <div className="text-text">Three flavors. Two formats. One outcome.</div>
          <div className="mt-[0.6vh]">Engineered for stability, recovery, and output under pressure.</div>
        </div>
      </div>

      <div className="absolute top-[33vh] bottom-[24vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-3 gap-[2vw] h-full">
          {cans.map((c) => (
            <div key={c.label} className="relative flex items-center justify-center">
              <div
                className="absolute w-[18vw] h-[18vw] rounded-full opacity-70 blur-[5vw]"
                style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)` }}
              />
              <div
                className="absolute bottom-[2vh] w-[12vw] h-[1.6vh] rounded-[50%] blur-[1.4vw] opacity-65"
                style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)" }}
              />
              <img
                src={c.src}
                alt=""
                className="relative h-[40vh] object-contain"
                style={{
                  filter: `drop-shadow(0 18px 28px rgba(0,0,0,0.5)) drop-shadow(0 0 50px ${c.glow})`,
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 text-center">
                <div className="font-body uppercase tracking-[0.28em] text-[0.9vw] text-text/70 font-semibold">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-3 gap-[1.6vw]">
          {designedFor.map((d) => (
            <div key={d.label} className="flex items-baseline gap-[0.8vw]">
              <div className="font-body uppercase tracking-[0.28em] text-[0.9vw] text-primary font-semibold whitespace-nowrap">{d.label}</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">{d.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw] border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between">
        <div className="font-display text-[1.7vw] leading-none tracking-tight text-text/55">
          This is not hydration.
        </div>
        <div className="font-display text-[1.7vw] leading-none tracking-tight text-text">
          This is <span className="text-primary">performance fuel.</span>
        </div>
      </div>
    </div>
  );
}
