export default function OSCommunity() {
  const cities = [
    { rank: "01", city: "New York",      state: "NY", members: "14,328", score: 91, delta: "+5", trend: "up",   pct: 91, badge: "CHAMPION · 5 WKS", x: 87.9, y: 20.7, members_n: 14328 },
    { rank: "02", city: "Chicago",       state: "IL", members: "8,941",  score: 87, delta: "+1", trend: "up",   pct: 87, badge: "CHASING",          x: 64.5, y: 17.8, members_n: 8941  },
    { rank: "03", city: "Atlanta",       state: "GA", members: "5,402",  score: 86, delta: "+4", trend: "up",   pct: 86, badge: "CLIMBING",         x: 70.0, y: 38.1, members_n: 5402  },
    { rank: "04", city: "Austin",        state: "TX", members: "5,128",  score: 86, delta: "+1", trend: "up",   pct: 86, badge: "",                 x: 47.0, y: 46.8, members_n: 5128  },
    { rank: "05", city: "San Diego",     state: "CA", members: "4,541",  score: 85, delta: "+3", trend: "up",   pct: 85, badge: "",                 x: 13.5, y: 40.7, members_n: 4541  },
    { rank: "06", city: "Miami",         state: "FL", members: "4,872",  score: 84, delta: "−1", trend: "down", pct: 84, badge: "",                 x: 77.3, y: 51.0, members_n: 4872  },
    { rank: "07", city: "Los Angeles",   state: "CA", members: "11,203", score: 83, delta: "−1", trend: "down", pct: 83, badge: "BIGGEST WEST",     x: 11.7, y: 37.4, members_n: 11203 },
    { rank: "08", city: "Philadelphia",  state: "PA", members: "5,712",  score: 83, delta: "·",  trend: "flat", pct: 83, badge: "",                 x: 86.0, y: 22.6, members_n: 5712  },
    { rank: "09", city: "Dallas",        state: "TX", members: "6,234",  score: 82, delta: "−2", trend: "down", pct: 82, badge: "",                 x: 48.6, y: 40.6, members_n: 6234  },
    { rank: "10", city: "Houston",       state: "TX", members: "7,520",  score: 81, delta: "−1", trend: "down", pct: 81, badge: "",                 x: 51.1, y: 48.1, members_n: 7520  },
    { rank: "11", city: "San Antonio",   state: "TX", members: "4,983",  score: 80, delta: "+1", trend: "up",   pct: 80, badge: "",                 x: 45.7, y: 49.0, members_n: 4983  },
    { rank: "12", city: "Phoenix",       state: "AZ", members: "6,890",  score: 79, delta: "−3", trend: "down", pct: 79, badge: "",                 x: 22.3, y: 38.9, members_n: 6890  },
  ];

  // Score → color (hex for SVG fills)
  const dotColor = (s: number) =>
    s >= 90 ? "#E53341" :   // primary red — champion tier
    s >= 85 ? "#F5D637" :   // accent yellow — chasing tier
    s >= 82 ? "#5478D5" :   // blue — top half
              "#6b7280";    // muted — bottom tier

  // Members → radius
  const dotRadius = (m: number) =>
    m >= 12000 ? 2.8 :
    m >=  8000 ? 2.3 :
    m >=  5000 ? 1.8 :
                 1.4;

  // Simplified continental US outline (viewBox 100x60)
  const usPath =
    "M 6 22 L 12 18 L 20 14 L 28 11 L 36 9 L 46 8 L 56 8 L 66 9 L 75 11 L 83 14 " +
    "L 89 17 L 93 21 L 96 26 L 97 32 L 95 37 L 92 42 L 88 46 L 83 49 L 78 51 " +
    "L 75 54 L 72 56 L 68 57 L 63 56 L 58 54 L 52 53 L 46 52 L 40 51 L 33 49 " +
    "L 27 47 L 22 44 L 17 40 L 12 35 L 9 30 L 7 26 Z";

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
          <span className="text-text">Performance becomes </span>
          <span className="text-primary">visible.</span>
        </h1>
        <div className="font-body text-[1.05vw] text-text/60 mt-[1.6vh] max-w-[62vw] leading-tight">
          Every user, team, and city contributes to a performance network.
          <span className="text-text/85"> City leaderboard. Heat map. The AForce League.</span>
        </div>
      </div>

      {/* Three-column body */}
      <div className="absolute top-[34vh] bottom-[18vh] left-[6vw] right-[6vw] grid grid-cols-[27%_24%_1fr] gap-[1.4vw] z-10">

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

            {/* Editorial body — restrained, billion-dollar */}
            <div className="px-[1.6vw] pt-[3vh] flex-1 flex flex-col min-h-0 relative">
              {/* City name — massive, one line, full width */}
              <h2 className="font-display text-[3.2vw] leading-[0.92] tracking-tighter text-text whitespace-nowrap">
                New York
              </h2>

              {/* Quiet locator */}
              <div className="font-body uppercase tracking-[0.28em] text-text/40 text-[0.6vw] mt-[1vh]">
                Brooklyn → Bronx → Queens
              </div>

              {/* Scoreboard — hero number */}
              <div className="mt-[3.5vh] flex items-end justify-between gap-[0.6vw]">
                <div className="flex flex-col gap-[0.2vh]">
                  <span className="font-body uppercase tracking-[0.22em] text-text/55 text-[0.65vw] font-semibold">Avg Performance</span>
                  <span className="font-body uppercase tracking-[0.18em] text-text/35 text-[0.55vw]">Last 7 Days</span>
                </div>
                <div className="flex items-baseline gap-[0.35vw]">
                  <span className="font-display text-[4vw] leading-[0.82] tracking-tight text-accent font-bold tabular-nums">91</span>
                  <span className="font-body text-text/35 text-[0.65vw] uppercase tracking-[0.22em]">/ 100</span>
                </div>
              </div>

              {/* Quiet stat line — no boxes, just text */}
              <div className="mt-[2.4vh] pt-[1.6vh] border-t border-text/10 font-body text-text/65 text-[0.78vw] tracking-tight leading-snug">
                <span className="text-text font-semibold tabular-nums">14,328</span>
                <span className="text-text/45"> members</span>
                <span className="text-text/25 px-[0.4vw]">·</span>
                <span className="text-text font-semibold tabular-nums">5</span>
                <span className="text-text/45"> wk streak</span>
                <span className="text-text/25 px-[0.4vw]">·</span>
                <span className="text-text font-semibold tabular-nums">98K</span>
                <span className="text-text/45"> cans / wk</span>
              </div>

              {/* MVP highlight — single hero card replacing the leaderboard */}
              <div className="mt-auto mb-[1vh]">
                <div className="font-body uppercase tracking-[0.28em] text-accent text-[0.6vw] font-bold mb-[0.8vh]">Week 17 MVP</div>
                <div className="rounded-[0.5vw] border border-accent/35 bg-accent/[0.06] px-[1vw] py-[1.4vh] flex items-center gap-[0.8vw]">
                  <div className="w-[2.4vw] h-[2.4vw] rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-accent text-[0.95vw] font-bold leading-none">MC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-text text-[1.1vw] font-bold leading-tight truncate">M. Carter</div>
                    <div className="font-body text-text/50 text-[0.65vw] tracking-tight mt-[0.2vh]">Brooklyn · 1,284 NY athletes</div>
                  </div>
                  <div className="flex items-baseline gap-[0.2vw] flex-shrink-0">
                    <span className="font-display text-accent text-[1.6vw] font-bold tabular-nums leading-none">98</span>
                    <span className="font-body text-text/35 text-[0.55vw] uppercase tracking-[0.2em]">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-[1.4vw] py-[1vh] bg-primary/[0.08] border-t border-primary/25 flex items-center justify-between mt-auto">
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.55vw] font-semibold">Trophy + $25K case drop · weekly</span>
              <span className="font-body uppercase tracking-[0.22em] text-primary text-[0.6vw] font-bold">Defending #1 →</span>
            </div>
          </div>
        </div>

        {/* ────────── US HEAT MAP ────────── */}
        <div className="flex flex-col min-h-0">
          <div
            className="relative rounded-2xl bg-[#0a0d14] border border-text/15 overflow-hidden flex-1 min-h-0 flex flex-col"
            style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
          >
            {/* Header */}
            <div className="px-[1vw] pt-[1.4vh] pb-[0.8vh] flex items-center justify-between border-b border-text/10">
              <div className="flex items-center gap-[0.5vw]">
                <span className="w-[0.55vw] h-[0.55vw] rounded-full bg-primary animate-pulse" />
                <span className="font-display font-bold text-text text-[1vw] tracking-tight">League Heat Map</span>
              </div>
              <span className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw]">Live</span>
            </div>

            {/* Stylized View pill */}
            <div className="px-[1vw] pt-[1vh] pb-[0.4vh]">
              <div className="inline-flex items-center px-[0.7vw] py-[0.35vh] rounded-full border border-text/15 bg-white/[0.03]">
                <span className="font-body uppercase tracking-[0.2em] text-text/55 text-[0.5vw] font-semibold">Stylized View · No Precise Location</span>
              </div>
            </div>

            {/* Map */}
            <div className="flex-1 min-h-0 px-[0.6vw] pb-[0.8vh] flex items-center justify-center">
              <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="clusterGlowPrimary" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#E53341" stopOpacity="0.55" />
                    <stop offset="55%"  stopColor="#E53341" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#E53341" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="clusterGlowAccent" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="#F5D637" stopOpacity="0.42" />
                    <stop offset="60%"  stopColor="#F5D637" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#F5D637" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Stylized grid */}
                <g opacity="0.10" stroke="#ffffff" strokeWidth="0.12">
                  <line x1="0" y1="10" x2="100" y2="10" />
                  <line x1="0" y1="20" x2="100" y2="20" />
                  <line x1="0" y1="30" x2="100" y2="30" />
                  <line x1="0" y1="40" x2="100" y2="40" />
                  <line x1="0" y1="50" x2="100" y2="50" />
                  <line x1="10" y1="0" x2="10" y2="60" />
                  <line x1="20" y1="0" x2="20" y2="60" />
                  <line x1="30" y1="0" x2="30" y2="60" />
                  <line x1="40" y1="0" x2="40" y2="60" />
                  <line x1="50" y1="0" x2="50" y2="60" />
                  <line x1="60" y1="0" x2="60" y2="60" />
                  <line x1="70" y1="0" x2="70" y2="60" />
                  <line x1="80" y1="0" x2="80" y2="60" />
                  <line x1="90" y1="0" x2="90" y2="60" />
                </g>

                {/* Smaller cities (ranks 4–12) — stylized scatter */}
                {[
                  { x: 22, y: 14 },
                  { x: 42, y: 18 },
                  { x: 14, y: 32 },
                  { x: 38, y: 36 },
                  { x: 86, y: 36 },
                  { x: 18, y: 50 },
                  { x: 48, y: 50 },
                  { x: 80, y: 52 },
                  { x: 62, y: 28 },
                ].map((p, i) => (
                  <g key={`small-${i}`}>
                    <circle cx={p.x} cy={p.y} r="2.6" fill="#F5D637" opacity="0.18" />
                    <circle cx={p.x} cy={p.y} r="1.5" fill="#F5D637" opacity="0.85" />
                    <circle cx={p.x} cy={p.y} r="0.55" fill="#ffffff" opacity="0.7" />
                  </g>
                ))}

                {/* ─── Champion cluster: New York #1 (top right) ─── */}
                <g>
                  <circle cx="74" cy="18" r="14" fill="url(#clusterGlowPrimary)" />
                  <circle cx="74" cy="18" r="8" fill="none" stroke="#E53341" strokeWidth="0.55" opacity="0.7">
                    <animate attributeName="r" values="8;10.5;8" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="74" cy="18" r="5.5" fill="none" stroke="#E53341" strokeWidth="0.7" opacity="0.9" />
                  <circle cx="74" cy="18" r="3.2" fill="#5478D5" opacity="0.95" />
                  <circle cx="74" cy="18" r="1.2" fill="#ffffff" />
                  <text x="74" y="5.5" textAnchor="middle" fill="#E53341" fontSize="2.4" fontWeight="700" fontFamily="ui-sans-serif, system-ui" letterSpacing="0.05">New York #1</text>
                </g>

                {/* ─── Cluster: Chicago #2 (mid-left) ─── */}
                <g>
                  <circle cx="30" cy="22" r="11" fill="url(#clusterGlowAccent)" />
                  <circle cx="30" cy="22" r="6" fill="none" stroke="#F5D637" strokeWidth="0.6" opacity="0.9" />
                  <circle cx="30" cy="22" r="2.8" fill="#5478D5" opacity="0.95" />
                  <circle cx="30" cy="22" r="1.05" fill="#ffffff" />
                  <text x="30" y="36" textAnchor="middle" fill="#F5D637" fontSize="2.2" fontWeight="700" fontFamily="ui-sans-serif, system-ui" letterSpacing="0.05">Chicago #2</text>
                </g>

                {/* ─── Cluster: Atlanta #3 (center-right) ─── */}
                <g>
                  <circle cx="60" cy="44" r="8.5" fill="url(#clusterGlowAccent)" />
                  <circle cx="60" cy="44" r="4.6" fill="none" stroke="#F5D637" strokeWidth="0.5" opacity="0.85" />
                  <circle cx="60" cy="44" r="2.1" fill="#5478D5" opacity="0.9" />
                  <circle cx="60" cy="44" r="0.8" fill="#ffffff" />
                  <text x="60" y="56" textAnchor="middle" fill="#F5D637" fontSize="2.1" fontWeight="700" fontFamily="ui-sans-serif, system-ui" letterSpacing="0.05">Atlanta #3</text>
                </g>
              </svg>
            </div>

            {/* Legend */}
            <div className="px-[1vw] py-[0.7vh] border-t border-text/10 flex items-center justify-between gap-[0.4vw]">
              <div className="flex items-center gap-[0.5vw]">
                <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.5vw] font-semibold">Score</span>
                <div className="flex items-center gap-[0.35vw]">
                  <span className="w-[0.5vw] h-[0.5vw] rounded-full" style={{ background: "#E53341" }} />
                  <span className="font-body text-text/65 text-[0.55vw]">90+</span>
                </div>
                <div className="flex items-center gap-[0.35vw]">
                  <span className="w-[0.5vw] h-[0.5vw] rounded-full" style={{ background: "#F5D637" }} />
                  <span className="font-body text-text/65 text-[0.55vw]">85+</span>
                </div>
                <div className="flex items-center gap-[0.35vw]">
                  <span className="w-[0.5vw] h-[0.5vw] rounded-full" style={{ background: "#5478D5" }} />
                  <span className="font-body text-text/65 text-[0.55vw]">82+</span>
                </div>
              </div>
              <div className="font-body uppercase tracking-[0.16em] text-text/40 text-[0.5vw]">Size = members</div>
            </div>

            {/* Footer */}
            <div className="px-[1vw] py-[0.9vh] bg-primary/[0.08] border-t border-primary/25 flex items-center justify-between">
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.55vw] font-semibold">East-coast density · West-coast scale</span>
              <span className="font-body uppercase tracking-[0.2em] text-primary text-[0.55vw] font-bold">12 / 50 states</span>
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
          <div className="px-[1vw] py-[0.6vh] grid grid-cols-[1.8vw_1fr_2.2vw_2vw_5vw] gap-[0.5vw] font-body uppercase tracking-[0.16em] text-text/40 text-[0.5vw] border-b border-text/8">
            <span>Rank</span>
            <span>City</span>
            <span className="text-right">Δ Wk</span>
            <span className="text-right">Score</span>
            <span>Form</span>
          </div>

          {/* Rows — flex distributed */}
          <div className="flex-1 flex flex-col min-h-0 px-[1vw]">
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
                  className="grid grid-cols-[1.8vw_1fr_2.2vw_2vw_5vw] gap-[0.5vw] items-center border-b border-text/5 font-body text-[0.7vw] flex-1 min-h-0"
                >
                  <span className={`px-[0.35vw] py-[0.18vh] rounded border ${podiumBg} ${podiumColor} font-bold uppercase tracking-[0.12em] text-[0.5vw] text-center tabular-nums`}>{c.rank}</span>
                  <div className="flex items-baseline gap-[0.4vw] min-w-0">
                    <span className={`font-display font-bold truncate text-[0.9vw] ${isPodium ? "text-text" : "text-text/85"}`}>{c.city}</span>
                    <span className="font-body uppercase tracking-[0.14em] text-text/40 text-[0.5vw]">{c.state}</span>
                    {c.badge && (
                      <span className={`px-[0.3vw] py-[0.1vh] rounded-full border ${
                        c.badge.includes("CHAMPION")  ? "bg-accent/20 border-accent/55 text-accent"   :
                        c.badge.includes("CLIMBING")  ? "bg-blue/20 border-blue/55 text-blue"         :
                                                        "bg-text/10 border-text/25 text-text/65"
                      } font-bold uppercase tracking-[0.14em] text-[0.42vw] whitespace-nowrap`}>{c.badge}</span>
                    )}
                  </div>
                  <span className={`tabular-nums text-right font-bold ${trendColor}`}>{c.delta}</span>
                  <span className={`font-display font-bold tabular-nums text-right ${isPodium ? "text-accent text-[0.95vw]" : "text-text text-[0.85vw]"}`}>{c.score}</span>
                  {/* Mini bar */}
                  <div className="h-[0.7vh] rounded-full bg-text/8 overflow-hidden border border-text/10">
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
