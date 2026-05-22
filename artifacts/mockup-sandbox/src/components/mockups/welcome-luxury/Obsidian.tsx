export function Obsidian() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black font-['Inter'] text-white">
      <style>{`
        @keyframes obsBreathe { 0%,100% { transform: scale(1); opacity: 0.55 } 50% { transform: scale(1.04); opacity: 0.85 } }
        @keyframes obsGlow { 0%,100% { opacity: 0.35 } 50% { opacity: 0.7 } }
        @keyframes obsWave { 0% { transform: translateX(-25%) } 100% { transform: translateX(0%) } }
        @keyframes obsDot { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
        @keyframes obsCta { 0%,100% { box-shadow: 0 0 24px rgba(31,184,166,0.25), inset 0 0 0 1px rgba(255,255,255,0.08) } 50% { box-shadow: 0 0 36px rgba(31,184,166,0.45), inset 0 0 0 1px rgba(255,255,255,0.14) } }
      `}</style>

      {/* Background — single soft radial vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 38%, rgba(15,60,55,0.55) 0%, rgba(8,28,28,0.35) 35%, #000 75%)',
      }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      {/* Header */}
      <div className="relative z-10 pt-16 px-8 text-center">
        <div className="text-[10px] tracking-[0.5em] text-white/40 font-medium">W E L C O M E</div>
        <div className="mt-3 text-[34px] font-semibold tracking-[-0.02em] leading-none">AFORCE OS</div>
      </div>

      {/* Ring system */}
      <div className="relative z-10 mt-10 mx-auto" style={{ width: 320, height: 320 }}>
        {/* Outermost glass ring */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle, rgba(31,184,166,0.08) 0%, rgba(0,0,0,0) 70%)',
          animation: 'obsGlow 5s ease-in-out infinite',
        }} />
        <div className="absolute rounded-full border" style={{
          inset: 0,
          borderColor: 'rgba(31,184,166,0.18)',
          boxShadow: 'inset 0 0 40px rgba(31,184,166,0.10), 0 0 60px rgba(31,184,166,0.10)',
          backdropFilter: 'blur(2px)',
        }} />
        {/* Mid ring */}
        <div className="absolute rounded-full border" style={{
          inset: 32,
          borderColor: 'rgba(64,224,200,0.22)',
          boxShadow: 'inset 0 0 26px rgba(64,224,200,0.10)',
        }} />
        {/* Inner ring - mint */}
        <div className="absolute rounded-full border" style={{
          inset: 64,
          borderColor: 'rgba(170,255,230,0.28)',
          boxShadow: 'inset 0 0 18px rgba(170,255,230,0.10), 0 0 24px rgba(64,224,200,0.20)',
          animation: 'obsBreathe 4s ease-in-out infinite',
        }} />

        {/* Center glass disc */}
        <div className="absolute rounded-full overflow-hidden" style={{
          inset: 100,
          background: 'radial-gradient(circle at 50% 35%, rgba(31,184,166,0.22) 0%, rgba(0,20,18,0.7) 70%)',
          border: '1px solid rgba(170,255,230,0.18)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          {/* Sine waveform */}
          <svg viewBox="0 0 120 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" style={{ animation: 'obsWave 4s linear infinite' }}>
            <defs>
              <linearGradient id="wave-o" x1="0" x2="1">
                <stop offset="0" stopColor="rgba(64,224,200,0)" />
                <stop offset="0.5" stopColor="rgba(170,255,230,0.9)" />
                <stop offset="1" stopColor="rgba(64,224,200,0)" />
              </linearGradient>
            </defs>
            <path d="M0,30 Q10,14 20,30 T40,30 T60,30 T80,30 T100,30 T120,30 T140,30 T160,30" stroke="url(#wave-o)" strokeWidth="0.8" fill="none" />
          </svg>
        </div>
      </div>

      {/* AI status */}
      <div className="relative z-10 mt-8 flex items-center justify-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#40E0C8]" style={{ animation: 'obsDot 1.6s ease-in-out infinite' }} />
        <span className="text-[11px] tracking-[0.32em] text-[#9be7d8] font-medium">CALIBRATING RECOVERY ENGINE</span>
      </div>

      {/* Iconic line */}
      <div className="relative z-10 mt-6 px-8 text-center">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-white/95">Performance is non&#8209;negotiable.</div>
      </div>

      {/* Flow sequence */}
      <div className="relative z-10 mt-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.18em] font-medium">
        <span className="text-white/40">PAUSE</span>
        <span className="text-white/20">→</span>
        <span className="text-white/40">RECOVER</span>
        <span className="text-white/20">→</span>
        <span className="text-white/40">HYDRATE</span>
        <span className="text-white/20">→</span>
        <span className="text-[#9be7d8]" style={{ textShadow: '0 0 12px rgba(64,224,200,0.6)' }}>LOCK IN</span>
        <span className="text-white/20">→</span>
        <span className="text-white/40">PERFORM</span>
      </div>

      {/* CTA */}
      <div className="absolute left-0 right-0 px-8" style={{ bottom: 56 }}>
        <button className="w-full h-14 rounded-2xl text-[12px] tracking-[0.4em] font-semibold text-white/95"
          style={{
            background: 'linear-gradient(180deg, rgba(31,184,166,0.18) 0%, rgba(15,60,55,0.55) 100%)',
            border: '1px solid rgba(170,255,230,0.25)',
            backdropFilter: 'blur(12px)',
            animation: 'obsCta 3.6s ease-in-out infinite',
          }}>
          BEGIN PROTOCOL
        </button>
      </div>
    </div>
  );
}
