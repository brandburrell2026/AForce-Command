export default function ProductTour() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 60% at 50% 35%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 40% 50% at 12% 88%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 40% 50% at 88% 88%, rgba(245,214,55,0.08) 0%, transparent 65%)" }}
      />

      {/* Top eyebrow */}
      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">13 — Product Tour</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 26</div>
      </div>

      {/* Headline */}
      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.05vw] text-accent font-semibold">AForce OS · In Your Pocket</span>
        </div>
        <h2 className="font-display text-[5vw] leading-[0.92] tracking-tighter">
          Three modes. <span className="text-accent">One loop.</span>
        </h2>
        <p className="mt-[1.4vh] font-body text-[1.1vw] text-text/65 leading-snug max-w-[60vw]">
          The same OS adapts to every state of the body — <span className="text-text">peak, social, and recovery.</span> Drink → Score → Coach → Decide.
        </p>
      </div>

      {/* Three phones row */}
      <div className="absolute top-[28vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[2vw] items-start z-10">
        {/* PHONE 1 — HYDRATION SCORE */}
        <div className="flex flex-col items-center">
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold mb-[1vh]">01 · Score</div>
          <div className="w-[18vw] h-[36vw] bg-bg-elev rounded-[2.2vw] border-2 border-text/20 overflow-hidden p-[0.9vw] flex flex-col shadow-2xl ring-1 ring-primary/10">
            <div className="flex justify-between items-center px-[0.4vw] mb-[0.6vh]">
              <span className="font-body text-[0.65vw] text-text font-medium">6:06</span>
              <div className="flex gap-[0.35vw] items-center">
                <span className="font-body text-[0.5vw] text-text/85 font-semibold">5G</span>
                <div className="px-[0.3vw] py-[0.1vh] rounded-[0.25vw] border border-text/55 font-body text-[0.45vw] text-text/85 leading-none">80</div>
              </div>
            </div>
            <div className="px-[0.3vw]">
              <div className="font-body text-[0.5vw] text-text/45">Welcome, Brandon</div>
              <div className="font-body uppercase tracking-[0.18em] text-[0.5vw] text-text/35 mt-[0.3vh] leading-tight">Hydration Control<br />Center</div>
              <div className="flex items-center justify-between mt-[0.4vh] gap-[0.4vw]">
                <div className="font-display text-[0.95vw] leading-none text-text/85">AForce OS</div>
                <div className="px-[0.5vw] py-[0.1vh] rounded-full border border-primary/55 bg-primary/10 font-body uppercase tracking-[0.16em] text-[0.45vw] text-primary font-semibold flex items-center gap-[0.2vw]">
                  <span className="w-[0.25vw] h-[0.25vw] rounded-full bg-primary inline-block" />
                  Depleted
                </div>
              </div>
              <div className="font-body text-[0.45vw] text-text/55 mt-[0.4vh] text-center">⏱ Wed, Apr 22 · 6:06 PM</div>
              <div className="flex justify-center gap-[0.5vw] font-body text-[0.45vw] text-text/55 mt-[0.3vh]">
                <span>♨ 76°F</span>
                <span className="text-text/25">|</span>
                <span>47% RH</span>
                <span className="text-text/25">|</span>
                <span>Fort Lauderdale</span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center my-[0.4vh]">
              <div className="relative w-[12.5vw] h-[12.5vw]">
                <div className="absolute inset-0 rounded-full bg-primary/[0.06]" />
                <div className="absolute inset-[0.8vw] rounded-full bg-primary/[0.10]" />
                <div className="absolute inset-[1.6vw] rounded-full bg-primary/[0.14]" />
                <div className="absolute inset-[2.5vw] rounded-full border border-primary/55" />
                <div className="absolute inset-[3.1vw] rounded-full bg-bg border border-primary/65" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="font-display text-[3vw] leading-none text-primary">52</div>
                </div>
              </div>
            </div>

            <div className="text-center font-body uppercase tracking-[0.22em] text-[0.45vw] text-text/40 mb-[0.4vh]">Tap orb for full breakdown</div>

            <div className="flex justify-center mb-[0.5vh]">
              <div className="px-[0.6vw] py-[0.2vh] rounded-full border border-primary/55 bg-primary/10 font-body text-[0.5vw] text-primary flex items-center gap-[0.3vw]">
                <span className="w-[0.25vw] h-[0.25vw] rounded-full bg-primary inline-block" />
                Drops to Depleted in 9 min
              </div>
            </div>

            {/* Hydration Check + Transportation Safety */}
            <div className="rounded-[0.5vw] border border-primary/30 bg-primary/[0.04] mb-[0.5vh] divide-y divide-text/10">
              <div className="flex items-center justify-between px-[0.55vw] py-[0.4vh]">
                <div className="flex items-center gap-[0.4vw]">
                  <span className="text-primary text-[0.7vw] leading-none">∿</span>
                  <div>
                    <div className="font-body uppercase tracking-[0.16em] text-[0.4vw] text-text/55">Hydration Check</div>
                    <div className="font-body text-[0.5vw] text-text/85 leading-tight">Last 6 min · 12 oz behind</div>
                  </div>
                </div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.42vw] font-bold text-primary">RE-CHECK</div>
              </div>
              <div className="flex items-center justify-between px-[0.55vw] py-[0.4vh]">
                <div className="flex items-center gap-[0.4vw]">
                  <span className="text-blue text-[0.7vw] leading-none">⊳</span>
                  <div>
                    <div className="font-body uppercase tracking-[0.16em] text-[0.4vw] text-text/55">Transportation Safety</div>
                    <div className="font-body text-[0.5vw] text-text/85 leading-tight">Cleared to drive · 0.000 BAC</div>
                  </div>
                </div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.42vw] font-bold text-blue">CLEAR</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-[0.2vw] pt-[0.5vh] border-t border-text/10">
              {["Home", "Check", "Protocol", "Store", "Profile"].map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-[0.2vh]">
                  <div className={`w-[1.4vw] h-[1.4vw] rounded-lg flex items-center justify-center font-display text-[0.85vw] leading-none ${i === 0 ? "bg-blue/15 border border-blue/40 text-blue" : "text-text/55"}`}>
                    {["⚡", "∿", "≡", "⌂", "◉"][i]}
                  </div>
                  <div className={`font-body text-[0.45vw] ${i === 0 ? "text-text/80" : "text-text/55"}`}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-[1.4vh] text-center max-w-[18vw]">
            <div className="font-display text-[1.15vw] leading-tight tracking-tight">Real-time hydration score.</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh] leading-snug">One number. Updated every minute from temp, sweat, heart-rate, and intake.</div>
          </div>
        </div>

        {/* PHONE 2 — SOCIAL MODE */}
        <div className="flex flex-col items-center">
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] font-semibold mb-[1vh]" style={{ color: "#9D7CFB" }}>02 · Social</div>
          <div className="w-[18vw] h-[36vw] bg-bg-elev rounded-[2.2vw] border-2 border-text/20 overflow-hidden flex flex-col shadow-2xl ring-1" style={{ boxShadow: "0 0 60px rgba(157,124,251,0.15)" }}>
            {/* iOS status bar */}
            <div className="flex justify-between items-center px-[0.9vw] pt-[0.5vh] pb-[0.25vh]">
              <span className="font-body text-[0.65vw] text-text font-medium">10:42</span>
              <div className="flex gap-[0.35vw] items-center">
                <span className="font-body text-[0.5vw] text-text/85 font-semibold">5G</span>
                <div className="px-[0.3vw] py-[0.1vh] rounded-[0.25vw] border border-text/55 font-body text-[0.45vw] text-text/85 leading-none">62</div>
              </div>
            </div>

            {/* BECOME AFORCE banner */}
            <div className="mx-[0.7vw] mt-[0.2vh] rounded-[0.6vw] border py-[0.45vh] flex items-center justify-center gap-[0.4vw]" style={{ borderColor: "rgba(229,51,65,0.55)", background: "rgba(229,51,65,0.06)" }}>
              <span className="text-primary text-[0.65vw] leading-none">◉</span>
              <span className="font-body uppercase tracking-[0.2em] text-[0.55vw] font-bold text-primary">Become AForce</span>
            </div>

            {/* Snooze */}
            <div className="text-center font-body text-[0.42vw] text-text/45 mt-[0.35vh]">⏱ Snooze 20 minutes</div>

            {/* TIME TO CLEAR countdown */}
            <div className="text-center mt-[0.3vh] pb-[0.4vh]">
              <div className="font-body uppercase tracking-[0.22em] text-[0.42vw] font-semibold" style={{ color: "rgba(157,124,251,0.65)" }}>Time to Clear</div>
              <div className="font-display text-[1.85vw] leading-none mt-[0.1vh]" style={{ color: "rgba(157,124,251,0.6)" }}>4h 30m</div>
            </div>

            {/* Drawer handle */}
            <div className="flex justify-center pt-[0.3vh] pb-[0.15vh]">
              <div className="h-[0.3vh] w-[2vw] rounded-full bg-text/30" />
            </div>

            {/* Mode header + close */}
            <div className="px-[0.9vw] mt-[0.2vh] flex justify-between items-start">
              <div>
                <div className="font-body uppercase tracking-[0.22em] text-[0.5vw] font-semibold" style={{ color: "#9D7CFB" }}>Social Mode</div>
                <div className="font-display text-[0.9vw] leading-tight text-text mt-[0.15vh]">We've got your back tonight.</div>
              </div>
              <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-white/10 flex items-center justify-center font-body text-[0.5vw] text-text/65 leading-none">×</div>
            </div>

            {/* Stats row: drinks · decay · MODERATE */}
            <div className="mx-[0.7vw] mt-[0.45vh] flex justify-between items-center px-[0.5vw] py-[0.45vh] rounded-[0.6vw] bg-white/[0.04]">
              <div>
                <div className="font-display text-[1.1vw] leading-none text-text">2</div>
                <div className="font-body text-[0.4vw] text-text/55 mt-[0.15vh]">drinks</div>
              </div>
              <div>
                <div className="font-display text-[1.1vw] leading-none text-text">×1.33</div>
                <div className="font-body text-[0.4vw] text-text/55 mt-[0.15vh]">decay</div>
              </div>
              <div className="text-right">
                <div className="px-[0.4vw] py-[0.1vh] rounded-full font-body uppercase tracking-[0.14em] text-[0.4vw] font-bold inline-flex items-center gap-[0.2vw]" style={{ background: "rgba(244,178,63,0.15)", color: "#F4B23F", border: "1px solid rgba(244,178,63,0.5)" }}>
                  <span className="w-[0.2vw] h-[0.2vw] rounded-full" style={{ background: "#F4B23F" }} />
                  Moderate
                </div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.36vw] text-text/55 mt-[0.2vh]">Impairment</div>
              </div>
            </div>

            {/* EST. BAC card */}
            <div className="mx-[0.7vw] mt-[0.4vh] rounded-[0.6vw] border px-[0.55vw] py-[0.45vh]" style={{ borderColor: "rgba(157,124,251,0.4)", background: "rgba(157,124,251,0.06)" }}>
              <div className="flex justify-between items-center">
                <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] font-semibold" style={{ color: "#9D7CFB" }}>Est. BAC</div>
                <div className="px-[0.3vw] py-[0.04vh] rounded-full border font-body uppercase tracking-[0.14em] text-[0.36vw] font-semibold" style={{ borderColor: "rgba(157,124,251,0.5)", color: "#9D7CFB" }}>Med Conf</div>
              </div>
              <div className="flex items-end justify-between mt-[0.2vh]">
                <div>
                  <div className="font-display text-[1.25vw] leading-none text-text">0.062–0.082</div>
                  <div className="font-body uppercase tracking-[0.14em] text-[0.4vw] font-bold mt-[0.2vh]" style={{ color: "#F4B23F" }}>↗ Rising</div>
                </div>
                <div className="text-right">
                  <div className="font-body uppercase tracking-[0.14em] text-[0.34vw] text-text/55">Clear in</div>
                  <div className="font-display text-[0.7vw] leading-none text-text mt-[0.1vh]">4h 30m</div>
                </div>
              </div>
              <div className="font-body text-[0.34vw] text-text/45 mt-[0.3vh] leading-snug">
                Estimate only · approximate. Never use to determine if safe or legal to drive. If drinking, do not drive — use a rideshare, designated driver, or other safe transportation.
              </div>
            </div>

            {/* TRANSPORTATION SAFETY full card */}
            <div className="mx-[0.7vw] mt-[0.35vh] rounded-[0.6vw] border px-[0.55vw] py-[0.45vh]" style={{ borderColor: "rgba(244,178,63,0.5)", background: "rgba(244,178,63,0.06)" }}>
              <div className="flex items-start gap-[0.35vw]">
                <div className="w-[0.85vw] h-[0.85vw] rounded-full flex items-center justify-center text-[0.55vw] font-bold leading-none mt-[0.05vh]" style={{ background: "rgba(244,178,63,0.2)", color: "#F4B23F" }}>!</div>
                <div className="flex-1">
                  <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] font-semibold" style={{ color: "#F4B23F" }}>Transportation Safety</div>
                  <div className="font-body text-[0.55vw] font-bold text-text mt-[0.1vh] leading-tight">Plan a ride before your next drink.</div>
                  <div className="font-body text-[0.4vw] text-text/65 mt-[0.2vh] leading-snug">Coordination and judgment are reduced. Arrange a ride before you need one.</div>
                  <div className="font-body text-[0.42vw] mt-[0.25vh] font-semibold leading-snug" style={{ color: "#F4B23F" }}>⊳ Do not drive. Use a rideshare, designated driver, or other safe transportation.</div>
                </div>
              </div>
            </div>

            {/* HIGH 51 Hangover risk */}
            <div className="mx-[0.7vw] mt-[0.35vh] flex items-center gap-[0.4vw] px-[0.2vw]">
              <div className="px-[0.4vw] py-[0.1vh] rounded-full font-body uppercase tracking-[0.14em] text-[0.4vw] font-bold inline-flex items-center gap-[0.2vw]" style={{ background: "rgba(244,178,63,0.15)", color: "#F4B23F", border: "1px solid rgba(244,178,63,0.5)" }}>
                <span className="w-[0.2vw] h-[0.2vw] rounded-full" style={{ background: "#F4B23F" }} />
                High <span className="ml-[0.1vw]">51</span>
              </div>
              <div className="font-body text-[0.45vw] text-text/55">Hangover risk</div>
            </div>

            {/* Log next drink — 2x3 grid */}
            <div className="mx-[0.7vw] mt-[0.35vh]">
              <div className="font-body text-[0.42vw] text-text/55">Log next drink</div>
              <div className="grid grid-cols-3 gap-[0.25vw] mt-[0.25vh]">
                {[
                  { label: "Beer", icon: "☕" },
                  { label: "Wine", icon: "◆" },
                  { label: "Cocktail", icon: "🍃" },
                  { label: "Liquor", icon: "⚡" },
                  { label: "Hard Seltzer", icon: "☁" },
                  { label: "Custom", icon: "+" },
                ].map((d) => (
                  <div key={d.label} className="rounded-[0.45vw] border py-[0.35vh] flex flex-col items-center gap-[0.1vh]" style={{ borderColor: "rgba(157,124,251,0.35)", background: "rgba(157,124,251,0.04)" }}>
                    <span className="text-[0.6vw] leading-none" style={{ color: "#9D7CFB" }}>{d.icon}</span>
                    <span className="font-body text-[0.4vw] text-text">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* End the night */}
            <div className="mx-[0.7vw] mt-[0.4vh] rounded-[0.7vw] border py-[0.7vh] text-center font-body uppercase tracking-[0.22em] text-[0.5vw] font-bold" style={{ borderColor: "rgba(244,178,63,0.55)", color: "#F4B23F" }}>
              End the night
            </div>

            {/* Tab bar — pill */}
            <div className="mx-[0.5vw] mb-[0.4vh] mt-[0.4vh] rounded-full bg-white/[0.05] grid grid-cols-5 py-[0.35vh]">
              {[
                { label: "Home", icon: "⚡", active: true },
                { label: "Check", icon: "∿", active: false },
                { label: "Protocol", icon: "≡", active: false },
                { label: "Store", icon: "⌂", active: false },
                { label: "Profile", icon: "◉", active: false },
              ].map(t => (
                <div key={t.label} className="flex flex-col items-center gap-[0.1vh]">
                  <div className={`w-[1.1vw] h-[1.1vw] rounded-lg flex items-center justify-center font-display text-[0.65vw] leading-none ${t.active ? "bg-blue/20 text-blue" : "text-text/55"}`}>
                    {t.icon}
                  </div>
                  <div className={`font-body text-[0.38vw] ${t.active ? "text-text/85 font-semibold" : "text-text/55"}`}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-[1.4vh] text-center max-w-[18vw]">
            <div className="font-display text-[1.15vw] leading-tight tracking-tight">Live BAC. Live risk.</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh] leading-snug">One tap to log. The OS warns before you drive — and pre-stages recovery.</div>
          </div>
        </div>

        {/* PHONE 3 — RECOVERY MODE */}
        <div className="flex flex-col items-center">
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] font-semibold mb-[1vh]" style={{ color: "#F4B23F" }}>03 · Recovery</div>
          <div className="w-[18vw] h-[36vw] bg-bg-elev rounded-[2.2vw] border-2 border-text/20 overflow-hidden p-[0.9vw] flex flex-col shadow-2xl ring-1" style={{ boxShadow: "0 0 60px rgba(244,178,63,0.15)" }}>
            <div className="flex justify-between items-center px-[0.4vw] mb-[0.6vh]">
              <span className="font-body text-[0.65vw] text-text font-medium">7:14</span>
              <div className="flex gap-[0.35vw] items-center">
                <span className="font-body text-[0.5vw] text-text/85 font-semibold">5G</span>
                <div className="px-[0.3vw] py-[0.1vh] rounded-[0.25vw] border border-text/55 font-body text-[0.45vw] text-text/85 leading-none">28</div>
              </div>
            </div>

            <div className="px-[0.3vw]">
              <div className="font-body uppercase tracking-[0.22em] text-[0.5vw] font-semibold" style={{ color: "#F4B23F" }}>Recovery Mode</div>
              <div className="font-display text-[1.05vw] leading-tight text-text mt-[0.3vh]">Recovery in progress.</div>
            </div>

            {/* Last night recap — peak BAC, time over legal, last drink */}
            <div className="mt-[0.6vh] flex justify-between items-center px-[0.4vw] py-[0.5vh] rounded-[0.6vw] bg-white/[0.04]">
              <div>
                <div className="font-display text-[1.05vw] leading-none text-text">0.094</div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.38vw] text-text/55 mt-[0.25vh]">Peak · 1:14 AM</div>
              </div>
              <div>
                <div className="font-display text-[1.05vw] leading-none text-text">47<span className="font-body text-[0.5vw] text-text/55 ml-[0.1vw]">m</span></div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.38vw] text-text/55 mt-[0.25vh]">Over 0.08</div>
              </div>
              <div className="text-right">
                <div className="font-body text-[0.62vw] leading-none text-text font-semibold">1:42 AM</div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.38vw] text-text/55 mt-[0.35vh]">Last drink</div>
              </div>
            </div>

            {/* Big timer + residual BAC + descending curve */}
            <div className="mt-[0.55vh] rounded-[0.8vw] border px-[0.6vw] py-[0.75vh] flex flex-col items-center" style={{ borderColor: "rgba(244,178,63,0.4)", background: "rgba(244,178,63,0.06)" }}>
              <div className="flex w-full justify-between items-baseline">
                <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] font-semibold" style={{ color: "#F4B23F" }}>Time to clear</div>
                <div className="font-body text-[0.45vw] text-text/65">Now BAC <span className="text-text font-semibold">0.018</span></div>
              </div>
              <div className="font-display text-[2.2vw] leading-none mt-[0.25vh] text-text">1h 47m</div>
              {/* Descending BAC curve from peak to clear */}
              <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="mt-[0.45vh] w-full h-[1.4vh]">
                <polyline points="0,1.5 10,2.2 22,3.4 35,4.8 48,6.6 60,8.4 70,9.8 82,11 92,12 100,12.5" fill="none" stroke="#F4B23F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="60" cy="8.4" r="1.6" fill="#F4B23F" />
              </svg>
              <div className="mt-[0.25vh] flex w-full justify-between font-body text-[0.4vw] text-text/55">
                <span>1:14 peak</span>
                <span>7:14 now</span>
                <span>9:01 clear</span>
              </div>
            </div>

            {/* Hangover Risk */}
            <div className="mt-[0.55vh] flex items-center justify-between px-[0.4vw] py-[0.45vh] rounded-[0.5vw] bg-white/[0.04]">
              <div className="flex items-center gap-[0.4vw]">
                <div className="px-[0.4vw] py-[0.1vh] rounded-full font-body uppercase tracking-[0.14em] text-[0.42vw] font-semibold" style={{ background: "rgba(244,178,63,0.15)", color: "#F4B23F", border: "1px solid rgba(244,178,63,0.5)" }}>MOD 4.2</div>
                <div className="font-body text-[0.5vw] text-text/55">Hangover risk</div>
              </div>
            </div>

            {/* Coach checklist */}
            <div className="mt-[0.6vh] px-[0.3vw]">
              <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] text-text/45 mb-[0.4vh]">Coach plan</div>
              <div className="space-y-[0.4vh]">
                {[
                  { check: true, text: "16 oz electrolytes (2 sticks)" },
                  { check: true, text: "Carb + protein within 30 min" },
                  { check: false, text: "30 min light cardio at 8 AM" },
                  { check: false, text: "Rest until 8:00 AM" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-[0.4vw] py-[0.25vh] px-[0.3vw] rounded-[0.4vw] bg-white/[0.03]">
                    <div className="w-[0.8vw] h-[0.8vw] rounded-[0.18vw] flex items-center justify-center text-[0.55vw] leading-none" style={{ background: item.check ? "#F4B23F" : "transparent", border: `1px solid ${item.check ? "#F4B23F" : "rgba(255,255,255,0.25)"}`, color: "#08080F" }}>
                      {item.check ? "✓" : ""}
                    </div>
                    <div className={`font-body text-[0.5vw] leading-tight ${item.check ? "text-text/45 line-through" : "text-text/85"}`}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* TRANSPORTATION SAFETY full card */}
            <div className="mt-[0.55vh] rounded-[0.7vw] border px-[0.55vw] py-[0.5vh]" style={{ borderColor: "rgba(244,178,63,0.5)", background: "rgba(244,178,63,0.06)" }}>
              <div className="flex items-start gap-[0.35vw]">
                <div className="w-[0.85vw] h-[0.85vw] rounded-full flex items-center justify-center text-[0.55vw] font-bold leading-none mt-[0.05vh]" style={{ background: "rgba(244,178,63,0.2)", color: "#F4B23F" }}>!</div>
                <div className="flex-1">
                  <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] font-semibold" style={{ color: "#F4B23F" }}>Transportation Safety</div>
                  <div className="font-body text-[0.55vw] font-bold text-text mt-[0.1vh] leading-tight">Cleared to drive at 9:01 AM.</div>
                  <div className="font-body text-[0.4vw] text-text/65 mt-[0.2vh] leading-snug">Residual BAC ~0.018. Coordination still recovering — give yourself buffer before driving.</div>
                  <div className="font-body text-[0.42vw] mt-[0.25vh] font-semibold leading-snug" style={{ color: "#F4B23F" }}>⊳ Need to leave sooner? Use a rideshare or designated driver.</div>
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {/* Hydration Check + Transportation Safety summary (bottom) */}
            <div className="rounded-[0.5vw] border mb-[0.5vh] divide-y divide-text/10" style={{ borderColor: "rgba(244,178,63,0.4)", background: "rgba(244,178,63,0.05)" }}>
              <div className="flex items-center justify-between px-[0.55vw] py-[0.4vh]">
                <div className="flex items-center gap-[0.4vw]">
                  <span className="text-[0.7vw] leading-none" style={{ color: "#F4B23F" }}>∿</span>
                  <div>
                    <div className="font-body uppercase tracking-[0.16em] text-[0.4vw] text-text/55">Hydration Check</div>
                    <div className="font-body text-[0.5vw] text-text/85 leading-tight">Restored 78% · 12 oz to full</div>
                  </div>
                </div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.42vw] font-bold" style={{ color: "#F4B23F" }}>ON TRACK</div>
              </div>
              <div className="flex items-center justify-between px-[0.55vw] py-[0.4vh]">
                <div className="flex items-center gap-[0.4vw]">
                  <span className="text-[0.7vw] leading-none text-blue">⊳</span>
                  <div>
                    <div className="font-body uppercase tracking-[0.16em] text-[0.4vw] text-text/55">Transportation Safety</div>
                    <div className="font-body text-[0.5vw] text-text/85 leading-tight">Cleared to drive at 9:01 AM</div>
                  </div>
                </div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.42vw] font-bold text-blue">CLEAR 9:01</div>
              </div>
            </div>

            <div className="rounded-[0.7vw] border py-[0.7vh] text-center font-body uppercase tracking-[0.22em] text-[0.5vw] font-bold" style={{ borderColor: "rgba(244,178,63,0.55)", color: "#F4B23F" }}>
              I'm done
            </div>
          </div>
          <div className="mt-[1.4vh] text-center max-w-[18vw]">
            <div className="font-display text-[1.15vw] leading-tight tracking-tight">Wakes you up better.</div>
            <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh] leading-snug">A timed plan that turns last night into a clean morning. Premium tier.</div>
          </div>
        </div>
      </div>

      {/* Bottom strip — connecting tagline */}
      <div className="absolute bottom-[3vh] left-[6vw] right-[6vw] z-10">
        <div className="border-t border-text/10 pt-[1.4vh] flex items-baseline justify-between">
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Score · Coach · Decide — Every State of the Body</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.75vw] text-text/45">Live in 2026 · iOS + Android</div>
        </div>
      </div>
    </div>
  );
}
