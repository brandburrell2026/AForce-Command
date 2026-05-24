import React from "react";

export function Rollout() {
  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter']">
      {/* Background hairlines */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-full h-[1px] bg-white/[0.04]"
            style={{ top: `${i * 80 + 50}px` }}
          />
        ))}
      </div>

      {/* East Coast SVG Background */}
      <svg
        className="absolute top-0 right-0 w-[1600px] h-[900px] pointer-events-none"
        viewBox="0 0 1600 900"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
          </filter>
          <radialGradient id="miamiGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E25C5C" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#E25C5C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* East Coast Silhouette */}
        <path
          d="M 1350 0 C 1320 80, 1300 150, 1260 200 C 1220 250, 1200 270, 1210 320 C 1180 350, 1160 400, 1140 450 C 1110 520, 1080 580, 1070 650 C 1080 700, 1090 730, 1050 820 C 1030 870, 1000 900, 1000 900"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />

        {/* Route Glow */}
        <path
          d="M 1085 715 Q 1350 497 1225 285"
          fill="none"
          stroke="rgba(226,92,92,0.18)"
          strokeWidth="6"
          filter="url(#glow)"
        />

        {/* Route Dashed */}
        <path
          d="M 1085 715 Q 1350 497 1225 285"
          fill="none"
          stroke="rgba(226,92,92,0.55)"
          strokeWidth="1.25"
          strokeDasharray="4 6"
        />

        {/* Miami Glow */}
        <circle cx="1085" cy="715" r="60" fill="url(#miamiGlow)" />

        {/* NYC Glow */}
        <circle cx="1225" cy="285" r="40" fill="rgba(255,255,255,0.2)" filter="url(#glow)" />
      </svg>

      {/* Corridor Label */}
      <div className="absolute" style={{ left: 1225, top: 480 }}>
        <div className="text-[10px] text-white/55 tracking-[0.3em] whitespace-nowrap mb-1">
          6 M O N T H C O R R I D O R
        </div>
        <div className="h-[1px] w-[60px] bg-white/15" />
      </div>

      {/* Cities */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Miami */}
        <div className="absolute" style={{ left: 1085 - 5, top: 715 - 5 }}>
          <div className="w-[10px] h-[10px] bg-[#E25C5C] rounded-full" />
          <div className="absolute left-[24px] top-[-2px] whitespace-nowrap">
            <div className="text-[11px] text-white/95 tracking-[0.3em] font-medium">M I A M I</div>
            <div className="text-[10px] text-white/45 tracking-[0.2em] mt-1">
              F O U N D E R M A R K E T · L I V E
            </div>
          </div>
        </div>

        {/* NYC */}
        <div className="absolute" style={{ left: 1225 - 4, top: 285 - 4 }}>
          <div className="w-[8px] h-[8px] bg-white rounded-full" />
          <div className="absolute right-[24px] top-[-2px] whitespace-nowrap text-right">
            <div className="text-[11px] text-white/95 tracking-[0.3em] font-medium">
              N E W Y O R K
            </div>
            <div className="text-[10px] text-white/45 tracking-[0.2em] mt-1">
              P R O O F E X P A N S I O N · Q 2 2 0 2 7
            </div>
          </div>
        </div>
      </div>

      {/* Left Panel */}
      <div className="absolute left-[80px] top-1/2 -translate-y-1/2 w-[440px]">
        <div className="text-[10px] text-white/35 tracking-[0.3em] mb-6">
          F I G . 0 6 · R O L L O U T
        </div>
        
        <h1 className="text-[40px] text-white/95 font-light leading-tight tracking-tight mb-3">
          Two cities. One ritual.
        </h1>
        
        <div className="font-['Fraunces'] italic text-[16px] text-white/60 mb-8">
          "AForce begins where discipline already lives."
        </div>
        
        <div className="w-[80px] h-[1px] bg-white/15 mb-8" />
        
        <div className="space-y-4">
          {[
            "Founder-led rollout",
            "Controlled scale",
            "Concentrated proof engine",
            "Elite early adopters",
            "Behavioral ecosystem expansion"
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-[12px] h-[1px] bg-white/40" />
              <div className="text-[14px] text-white/75 font-light">{text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Right Stat */}
      <div className="absolute bottom-[50px] right-[50px] text-right">
        <div className="mb-6">
          <div className="text-[36px] text-white/95 font-light leading-none mb-2">1,200</div>
          <div className="text-[10px] text-white/55 tracking-[0.2em]">
            F O U N D I N G M E M B E R S
          </div>
        </div>
        
        <div className="w-[120px] h-[1px] bg-white/12 ml-auto mb-6" />
        
        <div>
          <div className="text-[20px] text-white/85 font-light leading-none mb-2">0</div>
          <div className="text-[10px] text-white/55 tracking-[0.2em]">
            M A S S - M A R K E T C H A N N E L S
          </div>
        </div>
      </div>

      {/* Top Right Label */}
      <div className="absolute top-[40px] right-[40px]">
        <div className="text-[10px] text-white/30 tracking-[0.3em]">
          I N T E R N A L · N O T F O R D I S T R I B U T I O N
        </div>
      </div>
    </div>
  );
}

export default Rollout;
