export default function Funding() {
  const segments = [
    { pct: 40, dollars: "$1.6M", label: "Inventory & Production", colorHex: "#E53341" },
    { pct: 20, dollars: "$800K",  label: "Go-To-Market (DTC + Retail)", colorHex: "#5478D5" },
    { pct: 20, dollars: "$800K",  label: "AForce OS + Tech Platform", colorHex: "#F5D637" },
    { pct: 10, dollars: "$400K",  label: "Sales & Distribution Build-Out", colorHex: "#7090DB" },
    { pct: 10, dollars: "$400K",  label: "Team & Overhead", colorHex: "#8C8C9E" },
  ];

  let cumulative = 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">26 — Funding & Use of Funds</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">26 / 28</div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(229,51,65,0.12) 0%, transparent 60%)" }}
      />

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Strategic Investment</span>
        </div>
        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter text-balance">
          <span className="text-primary">$4M Seed</span> to launch Spring 2026.
        </h2>
      </div>

      <div className="absolute top-[33vh] bottom-[6vh] left-[6vw] right-[6vw] grid grid-cols-[1fr_1fr] gap-[3vw]">
        <div className="flex flex-col gap-[1.4vh]">
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 grid grid-cols-3 gap-[1.4vw]">
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-muted">Instrument</div>
              <div className="font-display text-[1.3vw] text-text mt-[0.4vh] leading-tight">Series Seed Preferred</div>
            </div>
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-muted">Round Size</div>
              <div className="font-display text-[1.8vw] text-primary mt-[0.4vh] leading-tight">$4M</div>
            </div>
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-muted">Target Close</div>
              <div className="font-display text-[1.3vw] text-text mt-[0.4vh] leading-tight">Q1 2026</div>
            </div>
          </div>

          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-primary">
            <div className="font-display text-[1.3vw] text-text mb-[0.6vh]">Market Timing</div>
            <div className="font-body text-[1vw] text-text/65 leading-snug">Consumers are shifting toward clean-label, performance beverages — directly aligned with AForce.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-blue">
            <div className="font-display text-[1.3vw] text-text mb-[0.6vh]">Proven Team</div>
            <div className="font-body text-[1vw] text-text/65 leading-snug">Experienced operators with a track record of scaling consumer brands.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-accent">
            <div className="font-display text-[1.3vw] text-text mb-[0.6vh]">National Catalyst</div>
            <div className="font-body text-[1vw] text-text/65 leading-snug">America's Real Deal Season 2 premiere creates brand awareness at exactly the launch window.</div>
          </div>
        </div>

        <div className="flex flex-col gap-[1.4vh]">
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 flex items-center gap-[2vw]">
            <svg viewBox="0 0 220 220" className="w-[18vh] h-[18vh] shrink-0">
              <circle cx="110" cy="110" r={radius} fill="none" stroke="#12121E" strokeWidth="34" />
              {segments.map((s, i) => {
                const dash = (s.pct / 100) * circumference;
                const offset = circumference - cumulative;
                cumulative += dash;
                return (
                  <circle
                    key={i}
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke={s.colorHex}
                    strokeWidth="34"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 110 110)"
                  />
                );
              })}
              <text x="110" y="106" textAnchor="middle" fill="#F8F8F8" fontFamily="Archivo Black" fontSize="32">$4M</text>
              <text x="110" y="132" textAnchor="middle" fill="#8C8C9E" fontFamily="Manrope" fontSize="11" letterSpacing="2">SEED</text>
            </svg>
            <div className="flex-1">
              <div className="font-body uppercase tracking-[0.3em] text-[0.9vw] text-muted mb-[0.6vh]">Use of Funds</div>
              <div className="font-display text-[1.4vw] text-text leading-tight">Capital allocated to launch, scale, and the OS platform.</div>
            </div>
          </div>

          {segments.map((s, i) => (
            <div key={i} className="bg-bg-elev rounded-md p-[1vw] border border-text/10 flex items-center gap-[1.2vw]">
              <div className="w-[0.4vw] h-[3vh] rounded shrink-0" style={{ background: s.colorHex }} />
              <div className="font-display text-[1.6vw] leading-none w-[3.6vw]" style={{ color: s.colorHex }}>{s.pct}<span className="text-[0.9vw]">%</span></div>
              <div className="font-body text-[0.95vw] text-text/55 w-[4vw]">{s.dollars}</div>
              <div className="font-display text-[1.1vw] text-text flex-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
