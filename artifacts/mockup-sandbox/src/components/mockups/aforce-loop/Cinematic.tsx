import React from "react";

export function Cinematic() {
  const MOMENTS = [
    { num: "01", label: "D R I N K S", id: "drink" },
    { num: "02", label: "R I T U A L", id: "ritual" },
    { num: "03", label: "R E M I N D E R", id: "reminder" },
    { num: "04", label: "S T R E A K", id: "streak" },
    { num: "05", label: "R E P E A T", id: "repeat" },
    { num: "06", label: "S U B S C R I B E", id: "subscribe" },
    { num: "07", label: "R E T A I N", id: "retain" },
  ];

  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter']">
      <style>{`
        @keyframes timelineDot {
          0% { transform: translateX(0px); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translateX(1200px); opacity: 0; }
        }
        @keyframes timelinePulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.8; }
          100% { opacity: 0.6; }
        }
        
        .moment-1 { animation: pulse1 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-2 { animation: pulse2 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-3 { animation: pulse3 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-4 { animation: pulse4 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-5 { animation: pulse5 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-6 { animation: pulse6 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .moment-7 { animation: pulse7 14s cubic-bezier(0.65, 0, 0.35, 1) infinite; }

        @keyframes pulse1 { 0%, 100% { opacity: 0.4; } 7% { opacity: 1; } 14% { opacity: 0.7; } }
        @keyframes pulse2 { 0%, 100% { opacity: 0.4; } 21% { opacity: 1; } 28% { opacity: 0.7; } }
        @keyframes pulse3 { 0%, 100% { opacity: 0.4; } 35% { opacity: 1; } 42% { opacity: 0.7; } }
        @keyframes pulse4 { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } 57% { opacity: 0.7; } }
        @keyframes pulse5 { 0%, 100% { opacity: 0.4; } 64% { opacity: 1; } 71% { opacity: 0.7; } }
        @keyframes pulse6 { 0%, 100% { opacity: 0.4; } 78% { opacity: 1; } 85% { opacity: 0.7; } }
        @keyframes pulse7 { 0%, 100% { opacity: 0.4; } 92% { opacity: 1; } 99% { opacity: 0.7; } }
      `}</style>

      {/* Soft radial background glow */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)"
        }}
      />
      
      {/* Optional film grain */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: "url('data:image/svg+xml;utf8,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}
      />

      {/* Top Chrome */}
      <div className="absolute top-[80px] left-[80px] flex items-center gap-6">
        <span className="text-[10px] text-white/35 tracking-[4px]">B E H A V I O R &nbsp; &middot; &nbsp; O V E R &nbsp; T I M E</span>
        <div className="w-[80px] h-[1px] bg-white/15" />
      </div>
      <div className="absolute top-[80px] right-[80px]">
        <span className="text-[10px] text-white/25 tracking-[4px]">REEL 02 &middot; 14s LOOP</span>
      </div>

      {/* Main Timeline Scene */}
      <div className="absolute top-1/2 left-0 w-full h-[300px] -translate-y-1/2">
        {/* The timeline hairline */}
        <div 
          className="absolute top-1/2 left-[200px] right-[200px] h-[1px] bg-white/10 -translate-y-1/2"
          style={{ animation: "timelinePulse 7s ease-in-out infinite" }}
        />
        
        {/* The traveling dot */}
        <div 
          className="absolute top-1/2 left-[200px] w-[6px] h-[6px] rounded-full bg-white -translate-y-1/2 -translate-x-1/2 z-10 shadow-[0_0_24px_rgba(255,255,255,0.8)]"
          style={{ animation: "timelineDot 14s cubic-bezier(0.65, 0, 0.35, 1) infinite" }}
        />

        {/* Moments */}
        <div className="absolute top-0 left-[200px] right-[200px] h-full flex justify-between">
          {MOMENTS.map((m, i) => (
            <div key={m.id} className={`relative flex flex-col items-center justify-center w-[120px] h-full moment-${i + 1} opacity-40`}>
              
              {/* Top Number */}
              <div className="absolute top-[40px] text-[10px] text-white/25 tracking-[2px]">{m.num}</div>

              {/* SVG Vignette Container */}
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-[120px] w-[120px] -mt-4">
                {m.id === "drink" && (
                  <svg width="40" height="80" viewBox="0 0 40 80" className="stroke-white/40 fill-none" strokeWidth="1">
                    <rect x="8" y="20" width="24" height="60" rx="4" />
                    <path d="M20 0 Q24 10 20 15" className="stroke-white/60" />
                  </svg>
                )}
                {m.id === "ritual" && (
                  <svg width="60" height="60" viewBox="0 0 60 60" className="stroke-white/40 fill-none" strokeWidth="1">
                    <circle cx="30" cy="30" r="24" />
                    <line x1="30" y1="30" x2="30" y2="16" />
                    <line x1="30" y1="30" x2="42" y2="38" />
                  </svg>
                )}
                {m.id === "reminder" && (
                  <svg width="60" height="60" viewBox="0 0 60 60" className="stroke-white/40 fill-none" strokeWidth="1">
                    <circle cx="30" cy="30" r="24" />
                    <circle cx="48" cy="12" r="4" fill="#E25C5C" stroke="none" />
                  </svg>
                )}
                {m.id === "streak" && (
                  <svg width="60" height="60" viewBox="0 0 60 60" className="stroke-white fill-none" strokeWidth="1">
                    <line x1="10" y1="20" x2="10" y2="40" strokeOpacity="0.15" />
                    <line x1="20" y1="20" x2="20" y2="40" strokeOpacity="0.30" />
                    <line x1="30" y1="20" x2="30" y2="40" strokeOpacity="0.50" />
                    <line x1="40" y1="20" x2="40" y2="40" strokeOpacity="0.70" />
                    <line x1="50" y1="20" x2="50" y2="40" strokeOpacity="0.90" />
                  </svg>
                )}
                {m.id === "repeat" && (
                  <svg width="60" height="60" viewBox="0 0 60 60" className="fill-none" strokeWidth="1">
                    <circle cx="30" cy="30" r="16" stroke="rgba(255,255,255,0.3)" />
                    <circle cx="30" cy="30" r="24" stroke="rgba(255,255,255,0.6)" />
                    <path d="M 54 30 A 24 24 0 0 1 30 54" stroke="rgba(255,255,255,0.9)" />
                    <polygon points="50,30 54,26 58,30" fill="rgba(255,255,255,0.9)" stroke="none" />
                  </svg>
                )}
                {m.id === "subscribe" && (
                  <svg width="80" height="60" viewBox="0 0 80 60" className="stroke-white/40 fill-none" strokeWidth="1">
                    <line x1="10" y1="30" x2="70" y2="30" />
                    <path d="M 14 24 L 10 24 L 10 36 L 14 36" />
                    <path d="M 66 24 L 70 24 L 70 36 L 66 36" />
                  </svg>
                )}
                {m.id === "retain" && (
                  <div className="relative w-[140px] h-[60px] flex items-center justify-center">
                    <div className="w-full h-[1px] bg-gradient-to-r from-white/20 via-white/60 to-white/20" />
                    <div className="absolute w-[4px] h-[4px] bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
                  </div>
                )}
              </div>

              {/* Bottom Label */}
              <div className="absolute bottom-[40px] text-[9px] text-white/40 tracking-[3px]">{m.label}</div>
              
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Chrome */}
      <div className="absolute bottom-[80px] left-0 w-full text-center">
        <span className="font-['Fraunces'] italic font-light text-[16px] text-white/55">The protocol becomes identity.</span>
      </div>
    </div>
  );
}
