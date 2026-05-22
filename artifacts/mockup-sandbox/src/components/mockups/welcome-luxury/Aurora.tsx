export function Aurora() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black font-['Inter'] text-white">
      <style>{`
        @keyframes auRotCW { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        @keyframes auRotCCW { from { transform: rotate(0) } to { transform: rotate(-360deg) } }
        @keyframes auPulse { 0%,100% { opacity: 0.6; transform: scale(1) } 50% { opacity: 1; transform: scale(1.06) } }
        @keyframes auDot { 0%,100% { opacity: 0.25 } 50% { opacity: 1 } }
        @keyframes auDrift1 { 0% { transform: translate(0,0) } 50% { transform: translate(14px,-10px) } 100% { transform: translate(0,0) } }
        @keyframes auDrift2 { 0% { transform: translate(0,0) } 50% { transform: translate(-18px,12px) } 100% { transform: translate(0,0) } }
        @keyframes auDrift3 { 0% { transform: translate(0,0) } 50% { transform: translate(10px,16px) } 100% { transform: translate(0,0) } }
        @keyframes auCtaShine { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
      `}</style>

      {/* Aurora background */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(0,200,210,0.35) 0%, rgba(0,80,90,0.18) 30%, rgba(0,0,0,0) 60%), radial-gradient(circle at 50% 40%, rgba(0,160,180,0.18), transparent 60%), #000',
      }} />
      <div className="absolute inset-0 opacity-[0.05]" style={{
        backgroundImage: 'linear-gradient(rgba(0,230,230,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,230,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 70%)',
      }} />

      {/* Header */}
      <div className="relative z-10 pt-14 px-8 text-center">
        <div className="text-[10px] tracking-[0.5em] text-cyan-200/50 font-medium">W E L C O M E</div>
        <div className="mt-3 text-[34px] font-semibold tracking-[-0.02em] leading-none">AFORCE OS</div>
      </div>

      {/* Ring system */}
      <div className="relative z-10 mt-8 mx-auto" style={{ width: 340, height: 340 }}>
        {/* Outer ambient halo */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle, rgba(0,230,220,0.22) 0%, rgba(0,0,0,0) 60%)',
          animation: 'auPulse 3.5s ease-in-out infinite',
        }} />

        {/* Rotating arc segments */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ animation: 'auRotCW 18s linear infinite' }}>
          <defs>
            <linearGradient id="arc1" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="rgba(0,230,220,0.0)" />
              <stop offset="0.5" stopColor="rgba(0,230,220,0.95)" />
              <stop offset="1" stopColor="rgba(0,230,220,0.0)" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#arc1)" strokeWidth="1.2" strokeDasharray="180 600" />
        </svg>
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ animation: 'auRotCCW 26s linear infinite' }}>
          <defs>
            <linearGradient id="arc2" x1="0" x2="1">
              <stop offset="0" stopColor="rgba(120,255,230,0)" />
              <stop offset="0.5" stopColor="rgba(120,255,230,0.85)" />
              <stop offset="1" stopColor="rgba(120,255,230,0)" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="80" fill="none" stroke="url(#arc2)" strokeWidth="0.8" strokeDasharray="120 480" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="url(#arc2)" strokeWidth="0.8" strokeDasharray="60 540" strokeDashoffset="-300" />
        </svg>
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ animation: 'auRotCW 9s linear infinite' }}>
          <circle cx="100" cy="100" r="66" fill="none" stroke="rgba(0,200,220,0.18)" strokeWidth="0.5" strokeDasharray="2 4" />
        </svg>

        {/* Tick marks */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * 360;
            return <line key={i} x1="100" y1="14" x2="100" y2="20" stroke="rgba(0,230,220,0.35)" strokeWidth="0.6" transform={`rotate(${a} 100 100)`} />;
          })}
        </svg>

        {/* Bright inner halo */}
        <div className="absolute rounded-full" style={{
          inset: 90,
          background: 'radial-gradient(circle, rgba(0,255,230,0.55) 0%, rgba(0,160,180,0.25) 45%, rgba(0,0,0,0) 75%)',
          animation: 'auPulse 2.4s ease-in-out infinite',
        }} />

        {/* Particle field */}
        <div className="absolute inset-0">
          <div className="absolute w-1 h-1 rounded-full bg-cyan-200/80" style={{ top: '38%', left: '32%', animation: 'auDrift1 6s ease-in-out infinite' }} />
          <div className="absolute w-[3px] h-[3px] rounded-full bg-cyan-100" style={{ top: '52%', left: '64%', animation: 'auDrift2 7s ease-in-out infinite', boxShadow: '0 0 8px rgba(120,255,230,0.9)' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full bg-teal-200" style={{ top: '62%', left: '40%', animation: 'auDrift3 8s ease-in-out infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full bg-cyan-300" style={{ top: '44%', left: '56%', animation: 'auDrift1 5.5s ease-in-out infinite' }} />
          <div className="absolute w-1 h-1 rounded-full bg-white/70" style={{ top: '48%', left: '48%', boxShadow: '0 0 10px rgba(255,255,255,0.9)' }} />
        </div>
      </div>

      {/* AI status */}
      <div className="relative z-10 mt-6 flex items-center justify-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" style={{ animation: 'auDot 1.6s ease-in-out infinite' }} />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
        </span>
        <span className="text-[11px] tracking-[0.32em] text-cyan-200 font-medium">PERFORMANCE SYNC ACTIVE</span>
      </div>

      {/* Iconic line */}
      <div className="relative z-10 mt-5 px-8 text-center">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-white/95">Performance is non&#8209;negotiable.</div>
      </div>

      {/* Flow sequence */}
      <div className="relative z-10 mt-3 flex items-center justify-center gap-1.5 text-[10px] tracking-[0.18em] font-medium">
        <span className="text-white/35">PAUSE</span>
        <span className="text-white/15">→</span>
        <span className="text-white/35">RECOVER</span>
        <span className="text-white/15">→</span>
        <span className="text-cyan-200" style={{ textShadow: '0 0 14px rgba(0,230,220,0.7)' }}>HYDRATE</span>
        <span className="text-white/15">→</span>
        <span className="text-white/35">LOCK IN</span>
        <span className="text-white/15">→</span>
        <span className="text-white/35">PERFORM</span>
      </div>

      {/* CTA */}
      <div className="absolute left-0 right-0 px-8" style={{ bottom: 56 }}>
        <button className="relative w-full h-14 rounded-2xl text-[12px] tracking-[0.4em] font-semibold text-white overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(0,230,220,0.25) 0%, rgba(0,80,90,0.5) 100%)',
            border: '1px solid rgba(120,255,230,0.45)',
            boxShadow: '0 0 30px rgba(0,230,220,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}>
          <span className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', animation: 'auCtaShine 3.5s linear infinite' }} />
          <span className="relative">BEGIN PROTOCOL</span>
        </button>
      </div>
    </div>
  );
}
