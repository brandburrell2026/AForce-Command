export default function Problem() {
  const failures = [
    {
      label: "Option 1 — Short-term boost",
      title: "Energy spikes. Hard crashes.",
      tags: ["Energy spikes", "Hard crashes", "No control"],
      body: "Sugar-loaded boosters create quick hits with no system underneath. The lift comes — and then the fall.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
      shelf: "Gatorade · Powerade · Prime",
    },
    {
      label: "Option 2 — No system",
      title: "Water alone. No structure.",
      tags: ["Water alone", "No structure", "No feedback"],
      body: "Plain water helps but never closes the loop. No measurement, no feedback, no command — and nothing compounds.",
      accent: "text-text/75",
      ring: "ring-text/25",
      bar: "bg-text/40",
      bg: "from-text/[0.06] to-text/0",
      shelf: "Every gym fountain in America",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 18% 30%, rgba(229,51,65,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 85% 80%, rgba(140,140,158,0.08) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">03 — Problem</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">03 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">The Reality</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter text-balance">
            Most people don't lose from lack of effort. <span className="text-primary">They lose from inconsistency.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">You don't break all at once. You fade.</span> Focus slips. Energy drops. Decisions get worse — and performance follows.
        </p>
      </div>

      <div className="absolute top-[40vh] bottom-[16vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw]">
        {failures.map((f) => (
          <div key={f.label} className={`relative rounded-2xl ring-1 ${f.ring} bg-bg-elev/45 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${f.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${f.bar}`} />
            <div className="relative p-[1.8vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.95vw] font-semibold ${f.accent}`}>{f.label}</div>
              <div className="font-display text-[3.4vw] leading-none tracking-tight text-text mt-[1.4vh]">{f.title}</div>

              <div className="flex flex-wrap gap-[0.6vw] mt-[2.2vh]">
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-[1vw] py-[0.5vh] rounded-full ring-1 ${f.ring} font-body text-[0.85vw] ${f.accent}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="font-body text-[1vw] text-text/70 mt-[2vh] leading-snug">{f.body}</div>

              <div className="mt-auto pt-[2vh] border-t border-text/10">
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/45 font-semibold mb-[0.6vh]">On the shelf</div>
                <div className={`font-body text-[0.9vw] ${f.accent}`}>{f.shelf}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">The Gap</div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">The market fuels </span>
            <span className="text-text">effort.</span>
            <span className="text-text/55"> It does not sustain </span>
            <span className="text-primary">performance.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
