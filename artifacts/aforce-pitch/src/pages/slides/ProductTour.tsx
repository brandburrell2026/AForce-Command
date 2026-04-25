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
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 25</div>
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

            <div className="flex justify-center mb-[0.6vh]">
              <div className="px-[0.6vw] py-[0.2vh] rounded-full border border-primary/55 bg-primary/10 font-body text-[0.5vw] text-primary flex items-center gap-[0.3vw]">
                <span className="w-[0.25vw] h-[0.25vw] rounded-full bg-primary inline-block" />
                Drops to Depleted in 9 min
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
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold mb-[1vh]" style={{ color: "#9D7CFB" }}>02 · Social</div>
          <div className="w-[18vw] h-[36vw] bg-bg-elev rounded-[2.2vw] border-2 border-text/20 overflow-hidden p-[0.9vw] flex flex-col shadow-2xl ring-1" style={{ boxShadow: "0 0 60px rgba(157,124,251,0.15)" }}>
            <div className="flex justify-between items-center px-[0.4vw] mb-[0.6vh]">
              <span className="font-body text-[0.65vw] text-text font-medium">10:42</span>
              <div className="flex gap-[0.35vw] items-center">
                <span className="font-body text-[0.5vw] text-text/85 font-semibold">5G</span>
                <div className="px-[0.3vw] py-[0.1vh] rounded-[0.25vw] border border-text/55 font-body text-[0.45vw] text-text/85 leading-none">62</div>
              </div>
            </div>

            <div className="px-[0.3vw]">
              <div className="font-body uppercase tracking-[0.22em] text-[0.5vw] font-semibold" style={{ color: "#9D7CFB" }}>Social Mode · Active</div>
              <div className="font-display text-[1.05vw] leading-tight text-text mt-[0.3vh]">You're at the bar.</div>
            </div>

            <div className="mt-[0.7vh] flex justify-between items-center px-[0.5vw] py-[0.7vh] rounded-[0.7vw] bg-white/[0.04]">
              <div>
                <div className="font-display text-[1.4vw] leading-none text-text">3</div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.4vw] text-text/55 mt-[0.2vh]">Drinks</div>
              </div>
              <div>
                <div className="font-display text-[1.05vw] leading-none text-text">×1.45</div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.4vw] text-text/55 mt-[0.2vh]">Decay</div>
              </div>
              <div className="text-right">
                <div className="px-[0.4vw] py-[0.1vh] rounded-full font-body uppercase tracking-[0.14em] text-[0.42vw] font-semibold inline-block" style={{ background: "rgba(244,178,63,0.15)", color: "#F4B23F", border: "1px solid rgba(244,178,63,0.5)" }}>HIGH</div>
                <div className="font-body uppercase tracking-[0.14em] text-[0.4vw] text-text/55 mt-[0.2vh]">Impairment</div>
              </div>
            </div>

            {/* BAC Card */}
            <div className="mt-[0.6vh] rounded-[0.7vw] border px-[0.6vw] py-[0.7vh]" style={{ borderColor: "rgba(157,124,251,0.35)", background: "rgba(157,124,251,0.06)" }}>
              <div className="flex justify-between items-baseline">
                <div className="font-body uppercase tracking-[0.18em] text-[0.45vw] font-semibold" style={{ color: "#9D7CFB" }}>Estimated BAC</div>
                <div className="font-body text-[0.45vw] text-text/55">Clears in 2h 14m</div>
              </div>
              <div className="font-display text-[1.6vw] leading-none mt-[0.3vh] text-text">0.062</div>
              <div className="mt-[0.4vh] h-[0.35vh] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: "78%", background: "linear-gradient(90deg,#9D7CFB,#F4B23F)" }} />
              </div>
            </div>

            {/* Hangover Risk */}
            <div className="mt-[0.6vh] flex items-center gap-[0.5vw] px-[0.4vw]">
              <div className="px-[0.4vw] py-[0.1vh] rounded-full font-body uppercase tracking-[0.14em] text-[0.42vw] font-semibold" style={{ background: "rgba(244,178,63,0.15)", color: "#F4B23F", border: "1px solid rgba(244,178,63,0.5)" }}>HIGH 7.4</div>
              <div className="font-body text-[0.5vw] text-text/55">Hangover risk</div>
            </div>

            {/* Drink picker mini */}
            <div className="mt-[0.6vh]">
              <div className="font-body uppercase tracking-[0.18em] text-[0.42vw] text-text/45">Log next drink</div>
              <div className="grid grid-cols-3 gap-[0.3vw] mt-[0.4vh]">
                {["Beer", "Wine", "Cocktail", "Liquor", "Seltzer", "+"].map((d) => (
                  <div key={d} className="rounded-[0.4vw] border py-[0.4vh] text-center font-body text-[0.45vw]" style={{ borderColor: "rgba(157,124,251,0.35)", background: "rgba(157,124,251,0.06)", color: "#9D7CFB" }}>{d}</div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* End the night */}
            <div className="rounded-[0.7vw] border py-[0.7vh] text-center font-body uppercase tracking-[0.22em] text-[0.5vw] font-bold" style={{ borderColor: "rgba(244,178,63,0.55)", color: "#F4B23F" }}>
              End the night
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

            {/* Big timer */}
            <div className="mt-[0.8vh] rounded-[0.8vw] border px-[0.6vw] py-[1vh] flex flex-col items-center" style={{ borderColor: "rgba(244,178,63,0.4)", background: "rgba(244,178,63,0.06)" }}>
              <div className="font-body uppercase tracking-[0.18em] text-[0.45vw] font-semibold" style={{ color: "#F4B23F" }}>Time to clear</div>
              <div className="font-display text-[2.4vw] leading-none mt-[0.3vh] text-text">1h 47m</div>
              <div className="mt-[0.5vh] h-[0.35vh] w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: "62%", background: "linear-gradient(90deg,#F4B23F,#5478D5)" }} />
              </div>
              <div className="mt-[0.4vh] font-body text-[0.45vw] text-text/55">3 drinks · last session 11:42 PM</div>
            </div>

            {/* Hangover Risk */}
            <div className="mt-[0.6vh] flex items-center justify-between px-[0.4vw] py-[0.5vh] rounded-[0.5vw] bg-white/[0.04]">
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

            <div className="flex-1" />

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
