export default function OSCommunity() {
  const cities = [
    { rank: "01", city: "New York",      state: "NY", members: "14,328", score: 91, delta: "+5", trend: "up",   pct: 91, badge: "CHAMPION · 5 WKS" },
    { rank: "02", city: "Chicago",       state: "IL", members: "8,941",  score: 87, delta: "+1", trend: "up",   pct: 87, badge: "CHASING" },
    { rank: "03", city: "Atlanta",       state: "GA", members: "5,402",  score: 86, delta: "+4", trend: "up",   pct: 86, badge: "CLIMBING" },
    { rank: "04", city: "Austin",        state: "TX", members: "5,128",  score: 86, delta: "+1", trend: "up",   pct: 86, badge: "" },
    { rank: "05", city: "San Diego",     state: "CA", members: "4,541",  score: 85, delta: "+3", trend: "up",   pct: 85, badge: "" },
    { rank: "06", city: "Miami",         state: "FL", members: "4,872",  score: 84, delta: "−1", trend: "down", pct: 84, badge: "" },
    { rank: "07", city: "Los Angeles",   state: "CA", members: "11,203", score: 83, delta: "−1", trend: "down", pct: 83, badge: "BIGGEST WEST" },
    { rank: "08", city: "Philadelphia",  state: "PA", members: "5,712",  score: 83, delta: "·",  trend: "flat", pct: 83, badge: "" },
    { rank: "09", city: "Dallas",        state: "TX", members: "6,234",  score: 82, delta: "−2", trend: "down", pct: 82, badge: "" },
    { rank: "10", city: "Houston",       state: "TX", members: "7,520",  score: 81, delta: "−1", trend: "down", pct: 81, badge: "" },
    { rank: "11", city: "San Antonio",   state: "TX", members: "4,983",  score: 80, delta: "+1", trend: "up",   pct: 80, badge: "" },
    { rank: "12", city: "Phoenix",       state: "AZ", members: "6,890",  score: 79, delta: "−3", trend: "down", pct: 79, badge: "" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[18vh] -right-[8vw] w-[55vw] h-[55vw] rounded-full bg-primary/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[20vh] -left-[12vw] w-[55vw] h-[55vw] rounded-full bg-accent/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      {/* Eyebrow */}
      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">13 — Community</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 24</div>
      </div>

      {/* Headline */}
      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">From the OS to the Streets</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">The </span>
          <span className="text-primary">AForce League.</span>
        </h1>
        <div className="font-body text-[1.05vw] text-text/60 mt-[1.6vh] max-w-[62vw] leading-tight">
          Every can, every stick, every sip is logged to your city. Cities compete weekly on average hydration score —
          <span className="text-text/85"> the loop becomes a movement.</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="absolute top-[34vh] bottom-[18vh] left-[6vw] right-[6vw] grid grid-cols-[34%_1fr] gap-[2vw] z-10">

        {/* ────────── HERO CHAMPION CARD ────────── */}
        <div className="flex flex-col min-h-0">
          <div
            className="relative rounded-2xl bg-gradient-to-br from-primary/[0.18] via-bg to-bg border border-primary/45 overflow-hidden flex-1 min-h-0 flex flex-col"
            style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(229,51,65,0.15) inset" }}
          >
            {/* Top stripe */}
            <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-primary" />

            {/* Faint city skyline silhouette as background flavor */}
            <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.12] text-text" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden>
              <path fill="currentColor" d="M0 40 L0 28 L8 28 L8 22 L14 22 L14 30 L22 30 L22 18 L28 18 L28 24 L34 24 L34 12 L38 12 L38 8 L42 8 L42 16 L48 16 L48 22 L56 22 L56 14 L64 14 L64 26 L72 26 L72 20 L80 20 L80 30 L88 30 L88 16 L96 16 L96 24 L104 24 L104 10 L112 10 L112 18 L120 18 L120 26 L128 26 L128 14 L136 14 L136 22 L144 22 L144 28 L152 28 L152 18 L160 18 L160 24 L168 24 L168 12 L176 12 L176 20 L184 20 L184 28 L192 28 L192 22 L200 22 L200 40 Z" />
            </svg>

            {/* Header */}
            <div className="px-[1.4vw] pt-[1.6vh] pb-[0.8vh] flex items-center justify-between border-b border-text/8 relative">
              <div className="flex items-center gap-[0.6vw]">
                <span className="font-body uppercase tracking-[0.22em] text-primary text-[0.7vw] font-bold">Week 17 · Champion</span>
              </div>
              <div className="flex items-center gap-[0.4vw]">
                <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-primary animate-pulse inline-block" />
                <span className="font-body uppercase tracking-[0.2em] text-primary text-[0.6vw] font-bold">Live</span>
              </div>
            </div>

            {/* Big city name */}
            <div className="px-[1.4vw] pt-[1.6vh] flex-1 flex flex-col min-h-0 relative">
              <div className="flex items-baseline justify-between gap-[1vw]">
                <h2 className="font-display text-[3.6vw] leading-[0.92] tracking-tighter text-text">
                  New York<span className="text-primary">.</span>
                </h2>
                <div className="font-display text-[2.6vw] leading-[0.9] tracking-tight text-accent font-bold tabular-nums">91</div>
              </div>
              <div className="font-body uppercase tracking-[0.22em] text-text/50 text-[0.7vw] mt-[0.3vh]">Avg Hydration · Last 7 days</div>

              {/* Stat strip */}
              <div className="grid grid-cols-3 gap-[0.6vw] mt-[2vh]">
                <div className="rounded-[0.4vw] border border-text/10 bg-white/[0.03] px-[0.7vw] py-[0.9vh]">
                  <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw] font-semibold">Members</div>
                  <div className="font-display text-text text-[1.3vw] leading-tight font-bold tabular-nums mt-[0.2vh]">14,328</div>
                </div>
                <div className="rounded-[0.4vw] border border-text/10 bg-white/[0.03] px-[0.7vw] py-[0.9vh]">
                  <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw] font-semibold">Streak</div>
                  <div className="font-display text-text text-[1.3vw] leading-tight font-bold tabular-nums mt-[0.2vh]">5 wks</div>
                </div>
                <div className="rounded-[0.4vw] border border-text/10 bg-white/[0.03] px-[0.7vw] py-[0.9vh]">
                  <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw] font-semibold">Cans / wk</div>
                  <div className="font-display text-text text-[1.3vw] leading-tight font-bold tabular-nums mt-[0.2vh]">98K</div>
                </div>
              </div>

              {/* Top NY athletes — mini leaderboard fills the rest of the card */}
              <div className="mt-[1.6vh] flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-[0.5vh]">
                  <span className="font-body uppercase tracking-[0.22em] text-accent text-[0.6vw] font-bold">Top NY Athletes · Week 17</span>
                  <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.55vw]">View all 1,284 →</span>
                </div>
                {[
                  { i: "MC", name: "M. Carter",    score: 98, nbhd: "Brooklyn",        mvp: true  },
                  { i: "KP", name: "K. Patel",     score: 95, nbhd: "Harlem",          mvp: false },
                  { i: "DW", name: "D. Williams",  score: 94, nbhd: "Queens",          mvp: false },
                  { i: "AR", name: "A. Russo",     score: 93, nbhd: "Bronx",           mvp: false },
                  { i: "TN", name: "T. Nguyen",    score: 92, nbhd: "Tribeca",         mvp: false },
                  { i: "JR", name: "J. Reyes",     score: 91, nbhd: "Brooklyn Heights",mvp: false },
                  { i: "RK", name: "R. Kim",       score: 90, nbhd: "Astoria",         mvp: false },
                ].map((a) => (
                  <div
                    key={a.i}
                    className={`flex items-center gap-[0.6vw] rounded-[0.4vw] border px-[0.7vw] py-[0.45vh] flex-1 min-h-0 ${
                      a.mvp ? "border-accent/45 bg-accent/[0.08]" : "border-text/8 bg-white/[0.02]"
                    } ${a.mvp ? "" : "mt-[0.35vh]"}`}
                  >
                    <span className={`w-[1.6vw] h-[1.6vw] rounded-full flex items-center justify-center flex-shrink-0 border ${
                      a.mvp ? "bg-accent/25 border-accent/55" : "bg-white/[0.04] border-text/15"
                    }`}>
                      <span className={`font-display text-[0.7vw] font-bold leading-none ${a.mvp ? "text-accent" : "text-text/80"}`}>{a.i}</span>
                    </span>
                    <div className="flex-1 min-w-0 flex items-baseline gap-[0.4vw]">
                      <span className="font-display text-text text-[0.85vw] font-bold leading-tight truncate">{a.name}</span>
                      <span className="font-body text-text/45 text-[0.6vw] tracking-tight truncate">· {a.nbhd}</span>
                    </div>
                    {a.mvp && (
                      <span className="px-[0.35vw] py-[0.1vh] rounded-full border border-accent/55 bg-accent/15 text-accent font-bold uppercase tracking-[0.14em] text-[0.45vw] flex-shrink-0">MVP</span>
                    )}
                    <span className={`font-display tabular-nums font-bold leading-none flex-shrink-0 ${a.mvp ? "text-accent text-[1vw]" : "text-text text-[0.85vw]"}`}>{a.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-[1.4vw] py-[1vh] bg-primary/[0.08] border-t border-primary/25 flex items-center justify-between mt-auto">
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.55vw] font-semibold">Trophy + $25K case drop · weekly</span>
              <span className="font-body uppercase tracking-[0.22em] text-primary text-[0.6vw] font-bold">Defending #1 →</span>
            </div>
          </div>
        </div>

        {/* ────────── LEAGUE LEADERBOARD ────────── */}
        <div
          className="rounded-2xl bg-[#0a0d14] border border-text/15 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
        >
          {/* Header */}
          <div className="px-[1.2vw] pt-[1.4vh] pb-[1vh] flex items-center justify-between border-b border-text/10">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.7vw] h-[0.7vw] rounded-full bg-accent" />
              <span className="font-display font-bold text-text text-[1.1vw] tracking-tight">AForce League</span>
              <span className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.6vw]">Season 1 · Week 17</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body uppercase tracking-[0.18em] text-text/55 text-[0.6vw]">Sorted by Avg Score</span>
              <span className="font-body text-accent text-[0.7vw] font-bold tracking-tight tabular-nums">12 cities</span>
            </div>
          </div>

          {/* Column header */}
          <div className="px-[1.2vw] py-[0.6vh] grid grid-cols-[2vw_1fr_4vw_3.5vw_2.4vw_8vw] gap-[0.6vw] font-body uppercase tracking-[0.16em] text-text/40 text-[0.55vw] border-b border-text/8">
            <span>Rank</span>
            <span>City</span>
            <span className="text-right">Members</span>
            <span className="text-right">Δ Wk</span>
            <span className="text-right">Score</span>
            <span>Form</span>
          </div>

          {/* Rows — flex distributed */}
          <div className="flex-1 flex flex-col min-h-0 px-[1.2vw]">
            {cities.map((c, i) => {
              const isPodium = i < 3;
              const podiumColor =
                i === 0 ? "text-accent" :
                i === 1 ? "text-text"   :
                i === 2 ? "text-primary": "text-text/55";
              const podiumBg =
                i === 0 ? "bg-accent/15 border-accent/45"  :
                i === 1 ? "bg-text/10 border-text/30"      :
                i === 2 ? "bg-primary/15 border-primary/45": "bg-transparent border-text/10";
              const trendColor =
                c.trend === "up"   ? "text-accent" :
                c.trend === "down" ? "text-primary":
                                     "text-text/40";
              return (
                <div
                  key={c.rank}
                  className="grid grid-cols-[2vw_1fr_4vw_3.5vw_2.4vw_8vw] gap-[0.6vw] items-center border-b border-text/5 font-body text-[0.72vw] flex-1 min-h-0"
                >
                  <span className={`px-[0.4vw] py-[0.18vh] rounded border ${podiumBg} ${podiumColor} font-bold uppercase tracking-[0.12em] text-[0.55vw] text-center tabular-nums`}>{c.rank}</span>
                  <div className="flex items-baseline gap-[0.5vw] min-w-0">
                    <span className={`font-display font-bold truncate text-[0.95vw] ${isPodium ? "text-text" : "text-text/85"}`}>{c.city}</span>
                    <span className="font-body uppercase tracking-[0.14em] text-text/40 text-[0.55vw]">{c.state}</span>
                    {c.badge && (
                      <span className={`px-[0.35vw] py-[0.1vh] rounded-full border ${
                        c.badge.includes("CHAMPION")  ? "bg-accent/20 border-accent/55 text-accent"   :
                        c.badge.includes("CLIMBING")  ? "bg-blue/20 border-blue/55 text-blue"         :
                                                        "bg-text/10 border-text/25 text-text/65"
                      } font-bold uppercase tracking-[0.14em] text-[0.48vw] whitespace-nowrap`}>{c.badge}</span>
                    )}
                  </div>
                  <span className="text-text/85 tabular-nums text-right">{c.members}</span>
                  <span className={`tabular-nums text-right font-bold ${trendColor}`}>{c.delta}</span>
                  <span className={`font-display font-bold tabular-nums text-right ${isPodium ? "text-accent text-[1vw]" : "text-text text-[0.9vw]"}`}>{c.score}</span>
                  {/* Mini bar */}
                  <div className="h-[0.8vh] rounded-full bg-text/8 overflow-hidden border border-text/10">
                    <div
                      className={`h-full ${i === 0 ? "bg-accent" : i < 3 ? "bg-blue" : "bg-text/40"}`}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-[1.2vw] py-[1vh] bg-accent/[0.06] border-t border-accent/25 flex items-center justify-between">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.45vw] h-[0.45vw] rounded-full bg-accent inline-block" />
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.6vw] font-semibold">Season 1 ends Week 26</span>
              <span className="font-body text-text/45 text-[0.6vw]">· $250K total prize drop</span>
            </div>
            <div className="flex items-baseline gap-[0.5vw]">
              <span className="font-display text-accent text-[1.2vw] leading-none font-bold tabular-nums">84,273</span>
              <span className="font-body uppercase tracking-[0.16em] text-text/55 text-[0.55vw]">total members</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">Loyalty That Compounds</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between gap-[2vw]">
          <h3 className="font-display text-[2.2vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            <span className="text-primary">12 cities.</span>{" "}
            <span className="text-text">84K members.</span>{" "}
            <span className="text-text/55">One leaderboard turns customers into a fan base — and a fan base into a flywheel.</span>
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            +Retention<br/>+Reorder · +Reach
          </div>
        </div>
      </div>
    </div>
  );
}
