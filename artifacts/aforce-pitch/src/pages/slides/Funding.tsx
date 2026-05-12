export default function Funding() {
  const ladder = [
    {
      pct: 40,
      dollars: "$1.6M",
      bucket: "Inventory & Production",
      buys: "1.2M units shipped",
      proof: "Summer 2026 launch fully funded · 3 SKUs · 2 formats",
      colorHex: "#E53341",
      colorClass: "text-primary",
      borderClass: "border-primary/55",
    },
    {
      pct: 20,
      dollars: "$800K",
      bucket: "Go-To-Market",
      buys: "50,000 customers acquired",
      proof: "Blended CAC ~$28 · DTC + paid social + creator-led",
      colorHex: "#5478D5",
      colorClass: "text-blue",
      borderClass: "border-blue/55",
    },
    {
      pct: 20,
      dollars: "$800K",
      bucket: "AForce OS Platform",
      buys: "25,000 MAUs on the OS",
      proof: "Patent-pending · AI Coach v2 · Clutch beta with 3 pro teams",
      colorHex: "#F5D637",
      colorClass: "text-accent",
      borderClass: "border-accent/55",
    },
    {
      pct: 10,
      dollars: "$400K",
      bucket: "Retail Distribution",
      buys: "2,500 retail doors signed",
      proof: "Specialty + premium grocery · NYC, LA, Miami beachhead",
      colorHex: "#7090DB",
      colorClass: "text-blue",
      borderClass: "border-blue/40",
    },
    {
      pct: 10,
      dollars: "$400K",
      bucket: "Team & Overhead",
      buys: "4 senior hires",
      proof: "Head of Growth · OS Eng Lead · Head of Ops · Brand Director",
      colorHex: "#8C8C9E",
      colorClass: "text-text",
      borderClass: "border-text/30",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">22 — The Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">22 / 23</div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 75% 30%, rgba(229,51,65,0.14) 0%, transparent 55%)" }}
      />

      {/* Headline — reframed from "ask" to "outcome" */}
      <div className="absolute top-[13vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1vw] mb-[1.4vh]">
            <div className="h-[2px] w-[3vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">$4M Seed · Series Seed Preferred · Closing Q1 2026</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.9] tracking-tighter">
            <span className="text-text/55">$4M buys an </span>
            <span className="text-primary">unfair 18 months.</span>
          </h2>
        </div>
        <p className="font-body text-[1vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          Every dollar in this round is tied to a measurable outcome. <span className="text-text">No vanity spend. No padding.</span>
        </p>
      </div>

      {/* Outcome row — the three numbers investors remember */}
      <div className="absolute top-[33vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.2vw]">
        <div className="bg-bg-elev/60 rounded-md p-[1.4vw] border border-primary/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-primary/85 font-semibold">By Q4 2027</div>
          <div className="font-display text-[3vw] text-text leading-none mt-[0.8vh]">$18M</div>
          <div className="font-body text-[0.85vw] text-text/55 mt-[0.6vh] leading-snug">ARR run-rate · 7.7× LTV:CAC sustained at scale</div>
        </div>
        <div className="bg-bg-elev/60 rounded-md p-[1.4vw] border border-blue/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-blue font-semibold">By End 2026</div>
          <div className="font-display text-[3vw] text-text leading-none mt-[0.8vh]">50K</div>
          <div className="font-body text-[0.85vw] text-text/55 mt-[0.6vh] leading-snug">customers · 25K monthly OS users · 2,500 retail doors</div>
        </div>
        <div className="bg-bg-elev/60 rounded-md p-[1.4vw] border border-accent/45 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-accent font-semibold">Series A</div>
          <div className="font-display text-[3vw] text-text leading-none mt-[0.8vh]">$15M</div>
          <div className="font-body text-[0.85vw] text-text/55 mt-[0.6vh] leading-snug">target raise Q3 2027 · proven unit economics + OS traction</div>
        </div>
      </div>

      {/* The ladder — every dollar tied to a deliverable */}
      <div className="absolute top-[55vh] bottom-[10vh] left-[6vw] right-[6vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-text/45 font-semibold mb-[1.4vh]">Where the $4M goes — and what it returns</div>
        <div className="grid grid-cols-5 gap-[1vw] h-[calc(100%-3.6vh)]">
          {ladder.map((row, i) => (
            <div
              key={i}
              className={`bg-bg-elev/50 rounded-md border-t-2 ${row.borderClass} p-[1.1vw] flex flex-col`}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-[1.7vw] leading-none" style={{ color: row.colorHex }}>
                  {row.dollars}
                </div>
                <div className="font-body text-[0.75vw] text-text/45 font-semibold">{row.pct}%</div>
              </div>
              <div className="font-body text-[0.78vw] uppercase tracking-[0.2em] text-text/55 mt-[1vh] font-semibold">{row.bucket}</div>
              <div className={`font-display text-[1.15vw] leading-tight mt-[1vh] ${row.colorClass}`}>{row.buys}</div>
              <div className="font-body text-[0.75vw] text-text/50 leading-snug mt-auto pt-[1vh] border-t border-text/10">{row.proof}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Closing line */}
      <div className="absolute bottom-[3vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.2vh] flex items-baseline justify-between gap-[2vw]">
          <div className="font-display text-[1.5vw] leading-tight tracking-tight">
            <span className="text-text/55">What this round buys: </span>
            <span className="text-text">a defensible Performance OS at scale </span>
            <span className="text-primary">before anyone else builds one.</span>
          </div>
          <div className="font-body text-[0.78vw] text-text/45 italic max-w-[26vw] text-right leading-snug">
            Forward-looking statements. Targets reflect current plans and assumptions; actual results may vary.
          </div>
        </div>
      </div>
    </div>
  );
}
