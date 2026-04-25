export default function UseOfFunds() {
  const segments = [
    { pct: 40, dollars: "$1.6M", label: "Inventory & Production", color: "primary", colorHex: "#E53341" },
    { pct: 20, dollars: "$800K",  label: "Go-To-Market (DTC + Retail)", color: "blue", colorHex: "#5478D5" },
    { pct: 20, dollars: "$800K",  label: "AForce OS + Tech Platform", color: "accent", colorHex: "#F5D637" },
    { pct: 10, dollars: "$400K",  label: "Sales, Retail & Distribution Build-Out", color: "blue", colorHex: "#5478D5" },
    { pct: 10, dollars: "$400K",  label: "Team & Overhead", color: "text/40", colorHex: "#8C8C9E" },
  ];

  let cumulative = 0;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">27 — Use of Funds</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">27 / 28</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">$4M Seed Round</span>
        </div>
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance">
          Use of <span className="text-accent">funds.</span>
        </h2>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw] grid grid-cols-[1fr_1.4fr] gap-[5vw] items-center">
        <div className="flex justify-center">
          <svg viewBox="0 0 220 220" className="w-[34vh] h-[34vh]">
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
        </div>

        <div className="grid grid-cols-1 gap-[1.4vh]">
          {segments.map((s, i) => (
            <div key={i} className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 flex items-center gap-[1.4vw]">
              <div className="w-[0.6vw] h-[6vh] rounded" style={{ background: s.colorHex }} />
              <div className="flex items-baseline gap-[1vw] flex-1">
                <div className="font-display text-[3vw] leading-none" style={{ color: s.colorHex }}>{s.pct}<span className="text-[1.4vw]">%</span></div>
                <div className="font-body text-[1.2vw] text-text/65">{s.dollars}</div>
              </div>
              <div className="font-display text-[1.4vw] text-text text-right max-w-[18vw]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
