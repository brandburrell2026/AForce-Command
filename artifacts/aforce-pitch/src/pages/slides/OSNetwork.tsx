export default function OSNetwork() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">14 — The Network</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">14 / 28</div>
      </div>

      <div className="absolute top-[15vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[2.5vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Where the moat lives</span>
        </div>
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter">
          <span className="text-blue">Circles</span> + <span className="text-primary">Territory</span>.
        </h2>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[3vw]">
        <div className="bg-bg-elev rounded-lg p-[2.5vw] border-l-2 border-blue">
          <div className="font-body uppercase tracking-[0.3em] text-[1.3vw] text-blue mb-[1.5vh]">Circles</div>
          <div className="font-display text-[2.6vw] leading-tight text-text mb-[2vh]">Private accountability.</div>

          <div className="relative h-[22vh] mb-[2vh] flex items-center justify-center">
            <div className="absolute w-[14vw] h-[14vw] rounded-full border border-blue/30" />
            <div className="absolute w-[10vw] h-[10vw] rounded-full border border-blue/20" />
            <div className="absolute w-[6vw] h-[6vw] rounded-full bg-blue/20 border border-blue/50" />
            <div className="absolute top-[10%] left-[20%] w-[2.2vw] h-[2.2vw] rounded-full bg-blue border-2 border-bg" />
            <div className="absolute top-[35%] right-[15%] w-[2.2vw] h-[2.2vw] rounded-full bg-blue/80 border-2 border-bg" />
            <div className="absolute bottom-[15%] left-[35%] w-[2.2vw] h-[2.2vw] rounded-full bg-accent border-2 border-bg" />
            <div className="absolute bottom-[25%] right-[30%] w-[2.2vw] h-[2.2vw] rounded-full bg-blue/60 border-2 border-bg" />
            <div className="absolute top-[50%] left-[10%] w-[2.2vw] h-[2.2vw] rounded-full bg-primary border-2 border-bg" />
            <div className="relative font-display text-[2vw] text-text">04</div>
          </div>

          <div className="font-body text-[1.4vw] text-text/80 leading-snug">
            Tight squads see each other's signals in real time. Shared streaks. Shared challenges. Higher retention than any social feed.
          </div>
        </div>

        <div className="bg-bg-elev rounded-lg p-[2.5vw] border-l-2 border-primary">
          <div className="font-body uppercase tracking-[0.3em] text-[1.3vw] text-primary mb-[1.5vh]">Territory</div>
          <div className="font-display text-[2.6vw] leading-tight text-text mb-[2vh]">Live competition map.</div>

          <div className="relative h-[22vh] mb-[2vh] bg-bg rounded-md border border-text/10 overflow-hidden p-[1vw]">
            <div className="grid grid-cols-12 grid-rows-6 gap-[0.3vw] h-full w-full">
              {[
                0.1, 0.2, 0.4, 0.3, 0.7, 0.9, 0.5, 0.3, 0.2, 0.1, 0.1, 0.0,
                0.2, 0.5, 0.7, 0.6, 0.9, 0.8, 0.4, 0.6, 0.3, 0.1, 0.2, 0.1,
                0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3, 0.4, 0.6, 0.4, 0.2, 0.1,
                0.3, 0.4, 0.6, 0.5, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.3, 0.1,
                0.1, 0.2, 0.3, 0.2, 0.1, 0.2, 0.4, 0.6, 0.5, 0.3, 0.2, 0.1,
                0.0, 0.1, 0.1, 0.1, 0.0, 0.1, 0.2, 0.3, 0.2, 0.1, 0.0, 0.0
              ].map((v, i) => (
                <div
                  key={i}
                  className="rounded-[0.2vw]"
                  style={{
                    backgroundColor: v > 0.6 ? `rgba(229,51,65,${v})` : v > 0.3 ? `rgba(245,214,55,${v})` : `rgba(140,140,158,${v * 0.4})`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="font-body text-[1.4vw] text-text/80 leading-snug">
            Aggregated, privacy-safe heat. Cities, teams, and squads compete for the highest performance index. Status you can defend.
          </div>
        </div>
      </div>
    </div>
  );
}
