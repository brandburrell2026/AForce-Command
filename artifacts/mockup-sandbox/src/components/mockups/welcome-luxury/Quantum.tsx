export function Quantum() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black font-['Inter'] text-white">
      <style>{`
        @keyframes qConic { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        @keyframes qScan { 0% { top: 12% } 50% { top: 88% } 100% { top: 12% } }
        @keyframes qBreathe { 0%,100% { transform: scale(1); opacity: 0.95 } 50% { transform: scale(1.025); opacity: 1 } }
        @keyframes qOrbHi { 0%,100% { opacity: 0.55 } 50% { opacity: 0.9 } }
        @keyframes qEdge { 0%,100% { box-shadow: 0 0 28px rgba(0,220,200,0.35), inset 0 0 0 1px rgba(255,255,255,0.08) } 50% { box-shadow: 0 0 44px rgba(64,255,220,0.55), inset 0 0 0 1px rgba(255,255,255,0.16) } }
      `}</style>

      {/* Deep atmospheric background */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 50% 42%, rgba(0,80,80,0.45) 0%, rgba(0,30,40,0.25) 25%, #000 70%)',
      }} />
      <div className="absolute inset-0 opacity-[0.06] mix-blend-screen" style={{
        background: 'conic-gradient(from 220deg at 50% 50%, rgba(0,255,210,0.15), rgba(80,150,255,0.05), rgba(0,255,210,0.15))',
        filter: 'blur(40px)',
      }} />

      {/* Header */}
      <div className="relative z-10 pt-14 px-8 text-center">
        <div className="text-[10px] tracking-[0.5em] text-white/40 font-medium">W E L C O M E</div>
        <div className="mt-3 text-[34px] font-semibold tracking-[-0.02em] leading-none">AFORCE OS</div>
      </div>

      {/* Ring + orb */}
      <div className="relative z-10 mt-10 mx-auto" style={{ width: 320, height: 320 }}>
        {/* Iridescent conic ring stroke — rotating */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'conic-gradient(from 0deg, #1FB8A6, #40E0C8, #5EEAD4, #2DD4BF, #14B8A6, #1FB8A6)',
          mask: 'radial-gradient(circle, transparent 138px, #000 140px, #000 154px, transparent 156px)',
          WebkitMask: 'radial-gradient(circle, transparent 138px, #000 140px, #000 154px, transparent 156px)',
          animation: 'qConic 14s linear infinite',
          filter: 'drop-shadow(0 0 18px rgba(64,224,200,0.55))',
        }} />

        {/* Soft outer halo */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle, rgba(64,224,200,0.18) 0%, rgba(0,0,0,0) 65%)',
        }} />

        {/* 3D glass orb */}
        <div className="absolute rounded-full overflow-hidden" style={{
          inset: 60,
          background: 'radial-gradient(circle at 38% 30%, rgba(170,255,235,0.55) 0%, rgba(15,80,80,0.85) 35%, rgba(0,18,22,0.95) 80%)',
          border: '1px solid rgba(170,255,230,0.22)',
          boxShadow: 'inset 0 2px 1px rgba(255,255,255,0.18), inset 0 -20px 40px rgba(0,40,40,0.6), 0 0 40px rgba(0,200,180,0.35)',
          animation: 'qBreathe 4.5s ease-in-out infinite',
        }}>
          {/* Specular highlight */}
          <div className="absolute rounded-full" style={{
            top: '12%', left: '20%', width: '40%', height: '22%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)',
            animation: 'qOrbHi 4s ease-in-out infinite',
            filter: 'blur(4px)',
          }} />
          {/* Scanning sweep */}
          <div className="absolute left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent, rgba(170,255,230,0.85), transparent)',
            boxShadow: '0 0 12px rgba(64,224,200,0.7)',
            animation: 'qScan 3.6s ease-in-out infinite',
          }} />
          {/* Subtle inner concentric */}
          <div className="absolute rounded-full border" style={{ inset: 30, borderColor: 'rgba(170,255,230,0.10)' }} />
          <div className="absolute rounded-full border" style={{ inset: 50, borderColor: 'rgba(170,255,230,0.08)' }} />
        </div>
      </div>

      {/* AI status */}
      <div className="relative z-10 mt-9 flex items-center justify-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-300" style={{ boxShadow: '0 0 8px rgba(94,234,212,0.9)' }} />
        <span className="text-[11px] tracking-[0.32em] text-teal-200 font-medium">RECOVERY INTELLIGENCE ONLINE</span>
      </div>

      {/* Iconic line */}
      <div className="relative z-10 mt-5 px-8 text-center">
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-white/95">Performance is non&#8209;negotiable.</div>
      </div>

      {/* Flow sequence — single thin capsule */}
      <div className="relative z-10 mt-5 mx-8 rounded-full px-3 py-2 flex items-center justify-between text-[9px] tracking-[0.18em] font-medium"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
        }}>
        <span className="text-white/35">PAUSE</span>
        <span className="text-white/15">·</span>
        <span className="text-white/35">RECOVER</span>
        <span className="text-white/15">·</span>
        <span className="text-white/35">HYDRATE</span>
        <span className="text-white/15">·</span>
        <span className="text-white/35">LOCK IN</span>
        <span className="text-white/15">·</span>
        <span className="text-teal-200" style={{ textShadow: '0 0 14px rgba(94,234,212,0.8)' }}>PERFORM</span>
      </div>

      {/* CTA — monolith pill */}
      <div className="absolute left-0 right-0 px-6" style={{ bottom: 48 }}>
        <button className="w-full h-16 rounded-full text-[13px] tracking-[0.45em] font-semibold text-white"
          style={{
            background: 'linear-gradient(180deg, rgba(64,224,200,0.22) 0%, rgba(10,50,50,0.7) 100%)',
            border: '1px solid rgba(170,255,230,0.35)',
            backdropFilter: 'blur(14px)',
            animation: 'qEdge 3.8s ease-in-out infinite',
          }}>
          BEGIN PROTOCOL
        </button>
      </div>
    </div>
  );
}
