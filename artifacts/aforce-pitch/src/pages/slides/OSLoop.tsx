export default function OSLoop() {
  const stages = [
    {
      pos: "top-0 left-0",
      num: "01",
      stage: "Drink",
      title: "A can or a stick.",
      body: "pH 8.8 hydration enters the body. The first signal goes out.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.12] to-blue/0",
    },
    {
      pos: "top-0 right-0",
      num: "02",
      stage: "Score",
      title: "Body becomes data.",
      body: "Intake, sweat, weather, and recovery feed the hydration score.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.12] to-accent/0",
    },
    {
      pos: "bottom-0 right-0",
      num: "03",
      stage: "Coach",
      title: "AI calls the move.",
      body: "Mode-aware voice. One-tap action. The right product, in the right moment.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.12] to-primary/0",
    },
    {
      pos: "bottom-0 left-0",
      num: "04",
      stage: "Decide",
      title: "Drink the next one.",
      body: "Reorder is one tap. The next cycle starts smarter than the last.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/70",
      bg: "from-text/[0.10] to-text/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 18% 30%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 85% 75%, rgba(84,120,213,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 30% 25% at 50% 55%, rgba(245,214,55,0.08) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">12 — The Loop</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 25</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Hardware × Software</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.92] tracking-tighter">
            One closed loop. <span className="text-primary">Compounding data.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">Hardware captures. Software learns.</span> Every cycle sharpens the next — and the longer a customer is in the loop, the harder it is to leave.
        </p>
      </div>

      <div className="absolute top-[34vh] bottom-[16vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="ah-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#F5D637" />
              </marker>
              <marker id="ah-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#E53341" />
              </marker>
              <marker id="ah-white" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFFFFF" />
              </marker>
              <marker id="ah-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#5478D5" />
              </marker>
            </defs>

            <path d="M 30 11 L 68 11" stroke="#F5D637" strokeOpacity="0.85" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#ah-yellow)" vectorEffect="non-scaling-stroke" />
            <path d="M 89 31 L 89 67" stroke="#E53341" strokeOpacity="0.85" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#ah-red)" vectorEffect="non-scaling-stroke" />
            <path d="M 70 89 L 32 89" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#ah-white)" vectorEffect="non-scaling-stroke" />
            <path d="M 11 69 L 11 33" stroke="#5478D5" strokeOpacity="0.85" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#ah-blue)" vectorEffect="non-scaling-stroke" />
          </svg>

          {stages.map((s) => (
            <div
              key={s.num}
              className={`absolute ${s.pos} w-[27%] rounded-2xl ring-1 ${s.ring} bg-bg-elev/45 overflow-hidden`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} pointer-events-none`} />
              <div className={`absolute inset-x-0 top-0 h-[3px] ${s.bar}`} />
              <div className="relative p-[1.3vw]">
                <div className="flex items-baseline gap-[0.6vw]">
                  <span className={`font-display text-[1.8vw] leading-none ${s.accent}`}>{s.num}</span>
                  <span className={`font-body uppercase tracking-[0.32em] text-[0.85vw] font-semibold ${s.accent}`}>— {s.stage}</span>
                </div>
                <div className="font-display text-[1.7vw] leading-tight text-text mt-[1.2vh]">{s.title}</div>
                <div className="font-body text-[0.92vw] text-text/65 mt-[0.8vh] leading-snug">{s.body}</div>
              </div>
            </div>
          ))}

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="relative w-[20vw] h-[20vw] rounded-full flex items-center justify-center"
                 style={{
                   boxShadow: "0 0 80px rgba(229,51,65,0.18)",
                 }}>
              <div
                className="absolute inset-0 rounded-full pointer-events-none opacity-70"
                style={{
                  background: "conic-gradient(from 0deg, #5478D5 0%, #F5D637 25%, #E53341 50%, #FFFFFF 75%, #5478D5 100%)",
                  WebkitMask: "radial-gradient(circle, transparent 58%, #000 60%, #000 64%, transparent 66%)",
                  mask: "radial-gradient(circle, transparent 58%, #000 60%, #000 64%, transparent 66%)",
                }}
              />
              <div className="relative flex flex-col items-center">
                <img
                  src={`${import.meta.env.BASE_URL}ai-coach-correct-now.png`}
                  alt="AForce AI Coach — Correct Now"
                  className="w-[10vw] h-auto rounded-[1.4vw] block"
                  style={{ filter: "drop-shadow(0 12px 28px rgba(229,51,65,0.35)) drop-shadow(0 0 1px rgba(255,255,255,0.15))" }}
                />
                <div className="absolute -bottom-[2.6vh] left-1/2 -translate-x-1/2 px-[0.9vw] py-[0.4vh] rounded-full bg-bg/90 border border-primary/40 backdrop-blur-sm whitespace-nowrap">
                  <span className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-primary font-semibold">↻ Every Cycle, Tighter</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-primary" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">The Compounding Moat</div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Cycle 1: </span>
            <span className="text-text">a smart drink</span>
            <span className="text-text/55">. Cycle 100: </span>
            <span className="text-primary">an operating system you can't replace.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
