export default function OSDashboards() {
  const clutchRoster = [
    { num: "07", name: "J. Grant",      pos: "PG", tier: "PLATINUM", tierColor: "text-accent",  tierBg: "bg-accent/15 border-accent/55",   score: 96, action: "Hold" },
    { num: "21", name: "A. Khalid",     pos: "SF", tier: "PLATINUM", tierColor: "text-accent",  tierBg: "bg-accent/15 border-accent/55",   score: 93, action: "Hold" },
    { num: "15", name: "R. Vance",      pos: "G",  tier: "PLATINUM", tierColor: "text-accent",  tierBg: "bg-accent/15 border-accent/55",   score: 91, action: "Hold" },
    { num: "06", name: "H. Tanaka",     pos: "G",  tier: "PLATINUM", tierColor: "text-accent",  tierBg: "bg-accent/15 border-accent/55",   score: 88, action: "Hold" },
    { num: "11", name: "K. Moss",       pos: "SG", tier: "STABLE",   tierColor: "text-blue",    tierBg: "bg-blue/15 border-blue/55",       score: 81, action: "Sip" },
    { num: "09", name: "L. Bautista",   pos: "F",  tier: "STABLE",   tierColor: "text-blue",    tierBg: "bg-blue/15 border-blue/55",       score: 79, action: "Sip" },
    { num: "33", name: "T. Okafor",     pos: "C",  tier: "STABLE",   tierColor: "text-blue",    tierBg: "bg-blue/15 border-blue/55",       score: 77, action: "Sip" },
    { num: "28", name: "C. Whitlock",   pos: "PF", tier: "STABLE",   tierColor: "text-blue",    tierBg: "bg-blue/15 border-blue/55",       score: 75, action: "Sip" },
    { num: "17", name: "J. Singh",      pos: "PG", tier: "RECOVERY", tierColor: "text-text",    tierBg: "bg-text/10 border-text/30",       score: 67, action: "RTD"  },
    { num: "23", name: "D. Reyes",      pos: "SF", tier: "RECOVERY", tierColor: "text-text",    tierBg: "bg-text/10 border-text/30",       score: 64, action: "RTD"  },
    { num: "42", name: "N. Diaz",       pos: "C",  tier: "DEPLETED", tierColor: "text-primary", tierBg: "bg-primary/15 border-primary/55", score: 47, action: "Sub"  },
    { num: "04", name: "M. Park",       pos: "PF", tier: "DEPLETED", tierColor: "text-primary", tierBg: "bg-primary/15 border-primary/55", score: 42, action: "Sub"  },
  ];

  const guardianAlerts = [
    { sev: "CRITICAL", sevColor: "text-primary", sevBg: "bg-primary/20 border-primary/60", num: "04", body: "Cumulative load spike + sleep gap. Refusal trending. Recommend rest day.",            who: "M. Park · PF",       time: "0:42" },
    { sev: "CRITICAL", sevColor: "text-primary", sevBg: "bg-primary/20 border-primary/60", num: "42", body: "Hydration debt 31h. Refusal pattern × 2 sessions. Medical screen suggested.",         who: "N. Diaz · C",        time: "0:58" },
    { sev: "WATCH",    sevColor: "text-accent",  sevBg: "bg-accent/20 border-accent/60",   num: "11", body: "Calf strain probability 38% — hydration debt 22h. Restore protocol queued.",          who: "K. Moss · SG",       time: "1:18" },
    { sev: "WATCH",    sevColor: "text-accent",  sevBg: "bg-accent/20 border-accent/60",   num: "17", body: "Sleep efficiency 62% three nights running. Hold 2-a-day until baseline returns.",    who: "J. Singh · PG",      time: "1:46" },
    { sev: "MODERATE", sevColor: "text-blue",    sevBg: "bg-blue/20 border-blue/60",       num: "23", body: "Heat-index exposure 4 days running. Move tomorrow's session before 10am.",           who: "D. Reyes · SF",      time: "2:05" },
    { sev: "MODERATE", sevColor: "text-blue",    sevBg: "bg-blue/20 border-blue/60",       num: "28", body: "Sweat-sodium ratio drift. Re-balance Restore SKU intake for next 72h.",              who: "C. Whitlock · PF",   time: "2:33" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[18vh] -left-[10vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[20vh] -right-[10vw] w-[55vw] h-[55vw] rounded-full bg-accent/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      {/* Eyebrow */}
      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">11 — At Scale</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">11 / 23</div>
      </div>

      {/* Headline */}
      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-blue font-semibold">Beyond the Consumer</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">Performance </span>
          <span className="text-blue">at scale.</span>
        </h1>
        <div className="font-body text-[1.05vw] text-text/60 mt-[1.6vh] max-w-[62vw] leading-tight">
          The same loop that guides one user can scale across teams, schools, sports programs, and enterprise environments.
          <span className="text-text/85"> Clutch for coaches and high-pressure environments. Guardian for elite monitoring.</span>
        </div>
      </div>

      {/* Two dashboards */}
      <div className="absolute top-[34vh] bottom-[18vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw] z-10">

        {/* ────────── CLUTCH DASHBOARD ────────── */}
        <div
          className="relative rounded-2xl bg-[#0c1220] border border-blue/40 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(84,120,213,0.18) inset" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-blue" />

          {/* App chrome */}
          <div className="px-[1vw] pt-[1.2vh] pb-[0.9vh] flex items-center justify-between border-b border-text/8">
            <div className="flex items-center gap-[0.55vw]">
              <span className="w-[0.7vw] h-[0.7vw] rounded-full bg-blue" />
              <span className="font-display font-bold text-text text-[1vw] tracking-tight">CLUTCH</span>
              <span className="font-body uppercase tracking-[0.18em] text-blue/80 text-[0.55vw] font-semibold">Phase 2 · High School Coaches</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body uppercase tracking-[0.18em] text-text/55 text-[0.55vw]">Friday · Q3</span>
              <span className="font-body text-blue text-[0.7vw] font-bold tracking-tight tabular-nums">14:22</span>
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-primary animate-pulse inline-block" />
              <span className="font-body uppercase tracking-[0.2em] text-primary text-[0.55vw] font-bold">Live</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-[1vw] pt-[0.7vh] flex items-center gap-[1.2vw] border-b border-text/8 pb-[0.6vh]">
            <span className="font-body uppercase tracking-[0.18em] text-blue text-[0.6vw] font-bold border-b-2 border-blue pb-[0.2vh]">Roster</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Heat Mode</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Clips</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Post-Game</span>
            <span className="ml-auto font-body uppercase tracking-[0.18em] text-text/40 text-[0.55vw]">Filter ▾</span>
          </div>

          {/* Roster table — flex distributed to fill */}
          <div className="px-[1vw] pt-[0.7vh] flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-[1.4vw_1fr_1.5vw_4.5vw_2.4vw_2.8vw] gap-[0.5vw] font-body uppercase tracking-[0.16em] text-text/40 text-[0.5vw] pb-[0.5vh] border-b border-text/8">
              <span>#</span>
              <span>Athlete</span>
              <span>Pos</span>
              <span>Tier</span>
              <span className="text-right">Score</span>
              <span className="text-right">Cmd</span>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              {clutchRoster.map((r) => (
                <div
                  key={r.num}
                  className="grid grid-cols-[1.4vw_1fr_1.5vw_4.5vw_2.4vw_2.8vw] gap-[0.5vw] items-center border-b border-text/5 font-body text-[0.7vw] flex-1 min-h-0"
                >
                  <span className="text-text/55 tabular-nums">{r.num}</span>
                  <span className="text-text font-semibold truncate">{r.name}</span>
                  <span className="text-text/55 uppercase tracking-[0.1em] text-[0.55vw]">{r.pos}</span>
                  <span className={`px-[0.35vw] py-[0.12vh] rounded-full border ${r.tierBg} ${r.tierColor} font-bold uppercase tracking-[0.12em] text-[0.48vw] text-center`}>{r.tier}</span>
                  <span className="text-text font-bold tabular-nums text-right">{r.score}</span>
                  <span className="text-right">
                    <span className="px-[0.4vw] py-[0.14vh] rounded border border-blue/55 bg-blue/15 text-blue font-bold uppercase tracking-[0.1em] text-[0.52vw]">{r.action}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer strip */}
          <div className="px-[1vw] py-[0.9vh] bg-blue/[0.08] border-t border-blue/25 flex items-center justify-between">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.45vw] h-[0.45vw] rounded-full bg-accent inline-block" />
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.55vw] font-semibold">Heat Mode armed</span>
              <span className="font-body text-text/50 text-[0.6vw]">· auto-replenish queued × 7</span>
            </div>
            <div className="flex items-baseline gap-[0.5vw]">
              <span className="font-display text-blue text-[1.1vw] leading-none font-bold">$1,200</span>
              <span className="font-body uppercase tracking-[0.16em] text-text/50 text-[0.5vw]">/ team / yr · HS</span>
            </div>
          </div>
        </div>

        {/* ────────── GUARDIAN DASHBOARD ────────── */}
        <div
          className="relative rounded-2xl bg-[#15110a] border border-accent/40 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,214,55,0.18) inset" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-accent" />

          {/* App chrome */}
          <div className="px-[1vw] pt-[1.2vh] pb-[0.9vh] flex items-center justify-between border-b border-text/8">
            <div className="flex items-center gap-[0.55vw]">
              <span className="w-[0.7vw] h-[0.7vw] rounded-full bg-accent" />
              <span className="font-display font-bold text-text text-[1vw] tracking-tight">GUARDIAN</span>
              <span className="font-body uppercase tracking-[0.18em] text-accent/80 text-[0.55vw] font-semibold">Phase 3 · College + Pro</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="font-body uppercase tracking-[0.18em] text-text/55 text-[0.55vw]">D1 · NCAA · Pro</span>
              <span className="font-body text-accent text-[0.7vw] font-bold tracking-tight tabular-nums">78<span className="text-text/40 text-[0.55vw]">/100</span></span>
              <span className="w-[0.4vw] h-[0.4vw] rounded-full bg-primary animate-pulse inline-block" />
              <span className="font-body uppercase tracking-[0.2em] text-primary text-[0.55vw] font-bold">Live</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-[1vw] pt-[0.7vh] flex items-center gap-[1.2vw] border-b border-text/8 pb-[0.6vh]">
            <span className="font-body uppercase tracking-[0.18em] text-accent text-[0.6vw] font-bold border-b-2 border-accent pb-[0.2vh]">Risk Map</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Roster</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Alerts</span>
            <span className="font-body uppercase tracking-[0.18em] text-text/40 text-[0.6vw]">Escalation</span>
            <span className="ml-auto font-body uppercase tracking-[0.18em] text-text/40 text-[0.55vw]">Last 7d ▾</span>
          </div>

          {/* Body: composite risk + alerts */}
          <div className="px-[1vw] pt-[0.7vh] flex-1 flex flex-col min-h-0">
            {/* Composite risk distribution row */}
            <div className="pb-[0.7vh] border-b border-text/8">
              <div className="flex items-center justify-between mb-[0.4vh]">
                <span className="font-body uppercase tracking-[0.16em] text-text/50 text-[0.55vw] font-semibold">Composite Risk · 53 athletes</span>
                <span className="font-body text-text/45 text-[0.55vw]">updated 0:42 ago</span>
              </div>
              {/* Stacked bar */}
              <div className="flex h-[0.9vh] rounded-full overflow-hidden border border-text/10">
                <div className="bg-accent" style={{ width: "47%" }} title="Optimal" />
                <div className="bg-blue" style={{ width: "30%" }} title="Watch" />
                <div className="bg-text/35" style={{ width: "15%" }} title="Moderate" />
                <div className="bg-primary" style={{ width: "8%" }} title="Critical" />
              </div>
              <div className="flex items-center justify-between mt-[0.4vh] font-body text-[0.55vw]">
                <span className="flex items-center gap-[0.3vw]"><span className="w-[0.35vw] h-[0.35vw] bg-accent rounded-sm" /><span className="text-text/65">Optimal 25</span></span>
                <span className="flex items-center gap-[0.3vw]"><span className="w-[0.35vw] h-[0.35vw] bg-blue rounded-sm" /><span className="text-text/65">Watch 16</span></span>
                <span className="flex items-center gap-[0.3vw]"><span className="w-[0.35vw] h-[0.35vw] bg-text/35 rounded-sm" /><span className="text-text/65">Moderate 8</span></span>
                <span className="flex items-center gap-[0.3vw]"><span className="w-[0.35vw] h-[0.35vw] bg-primary rounded-sm" /><span className="text-text/65 font-bold">Critical 4</span></span>
              </div>
            </div>

            {/* Critical alerts — flex distributed to fill */}
            <div className="pt-[0.6vh] flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-[0.4vh]">
                <span className="font-body uppercase tracking-[0.16em] text-text/50 text-[0.55vw] font-semibold">Active Alerts · 6 escalated</span>
                <span className="font-body uppercase tracking-[0.18em] text-accent text-[0.55vw] font-bold">View all 12 →</span>
              </div>
              <div className="flex-1 flex flex-col gap-[0.4vh] min-h-0">
                {guardianAlerts.map((a) => (
                  <div key={a.num} className="rounded-[0.4vw] border border-text/10 bg-white/[0.02] px-[0.6vw] py-[0.4vh] flex items-start gap-[0.55vw] flex-1 min-h-0">
                    <span className={`px-[0.35vw] py-[0.14vh] rounded border ${a.sevBg} ${a.sevColor} font-bold uppercase tracking-[0.12em] text-[0.48vw] flex-shrink-0`}>{a.sev}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-[0.5vw]">
                        <span className="font-body text-text text-[0.62vw] font-bold">#{a.num} · {a.who}</span>
                        <span className="font-body text-text/40 text-[0.5vw] tabular-nums whitespace-nowrap">{a.time} ago</span>
                      </div>
                      <div className="font-body text-text/65 text-[0.58vw] leading-snug mt-[0.05vh] truncate">{a.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div className="px-[1vw] py-[0.9vh] bg-accent/[0.08] border-t border-accent/25 flex items-center justify-between">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.45vw] h-[0.45vw] rounded-full bg-primary inline-block" />
              <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.55vw] font-semibold">Medical escalation open</span>
              <span className="font-body text-text/50 text-[0.6vw]">· athletic dept + medical staff</span>
            </div>
            <div className="flex items-baseline gap-[0.5vw]">
              <span className="font-display text-accent text-[1.1vw] leading-none font-bold">$48K</span>
              <span className="font-body uppercase tracking-[0.16em] text-text/50 text-[0.5vw]">/ roster / yr · D1 + Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-blue font-semibold">Same Loop · Bigger Stakes</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between gap-[2vw]">
          <h3 className="font-display text-[2vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            <span className="text-text">Individual to team to system.</span>{" "}
            <span className="text-text/55">One loop, scaled across every level of performance.</span>
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            HS team SaaS<br/>+ D1 / Pro five-figure ACV
          </div>
        </div>
      </div>
    </div>
  );
}
