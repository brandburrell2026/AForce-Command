import React from 'react';

export function Versus() {
  const leftItems = [
    "Spikes",
    "Stimulation",
    "Hype",
    "Chaos",
    "Loud branding",
    "Temporary energy"
  ];

  const rightItems = [
    "Ritual",
    "Retention",
    "Accountability",
    "Sustained readiness",
    "Behavioral reinforcement",
    "Ecosystem engagement"
  ];

  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter'] flex">
      {/* Background soft glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)'
        }}
      />
      {/* Optional Noise */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      />

      {/* Top right label */}
      <div className="absolute top-[40px] right-[40px] text-[10px] tracking-[0.2em] text-white/30 uppercase">
        FIG. 04 · CATEGORY ANALYSIS
      </div>

      {/* Top Center Header */}
      <div className="absolute top-[60px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
        <div className="text-[10px] tracking-[0.3em] text-white/35 uppercase">
          T h e &nbsp; c a t e g o r y &nbsp; d i d &nbsp; n o t &nbsp; e v o l v e &nbsp; · &nbsp; a f o r c e &nbsp; d i d
        </div>
        <div className="w-[120px] h-[1px] bg-white/15" />
      </div>

      {/* Center Divider */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/15 -translate-x-1/2" />

      {/* Center VS Circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[56px] h-[56px] rounded-full border border-white/12 bg-black flex items-center justify-center z-10">
        <span className="font-['Fraunces'] italic font-normal text-[28px] text-white/55 leading-none mt-1">vs</span>
      </div>

      {/* Left Column: Traditional Category */}
      <div className="flex-1 flex flex-col justify-center px-[120px] pt-12">
        <div className="max-w-[480px] ml-auto w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="text-[11px] tracking-[0.25em] text-white/40 uppercase">T H E &nbsp; C A T E G O R Y</div>
            <div className="flex-1 h-[1px] bg-white/5" />
          </div>
          
          <h2 className="text-[36px] font-light text-white/70 mb-12 tracking-tight">Stimulation.</h2>

          <div className="flex flex-col">
            {leftItems.map((item, i) => (
              <div key={item} className="flex flex-col">
                <div className="flex items-center h-[64px] gap-6" style={{ transform: `translateY(${Math.sin(i)*1.5}px)` }}>
                  <div className="relative flex items-center justify-center w-[24px]">
                    {item === "Chaos" && (
                      <div className="absolute -left-6 w-[6px] h-[6px] rounded-full bg-[#E25C5C] opacity-40" />
                    )}
                    <svg width="24" height="8" viewBox="0 0 24 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
                      <path d="M0 4L4 1L8 7L12 2L16 6L20 0L24 5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[20px] font-light text-white/65">{item}</span>
                </div>
                {i < leftItems.length - 1 && <div className="w-full h-[1px] bg-white/[0.06]" />}
              </div>
            ))}
          </div>

          <div className="mt-16 font-['Fraunces'] italic text-[14px] text-white/35">
            "The category lives by the spike. So do the consequences."
          </div>
        </div>
      </div>

      {/* Right Column: AForce */}
      <div className="flex-1 flex flex-col justify-center px-[120px] pt-12">
        <div className="max-w-[480px] w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="text-[11px] tracking-[0.25em] text-white/95 uppercase">A F O R C E</div>
            <div className="flex-1 h-[1px] bg-white/15" />
          </div>
          
          <h2 className="text-[36px] font-light text-white/95 mb-12 tracking-tight">Discipline.</h2>

          <div className="flex flex-col">
            {rightItems.map((item, i) => (
              <div key={item} className="flex flex-col">
                <div className="flex items-center h-[64px] gap-6">
                  <div className="relative flex items-center justify-center w-[24px]">
                    {item === "Behavioral reinforcement" && (
                      <div className="absolute -left-6 w-[6px] h-[6px] rounded-full bg-[#E25C5C]" />
                    )}
                    <div className="w-full h-[1px] bg-white/60" />
                  </div>
                  <span className="text-[20px] font-medium text-white/95">{item}</span>
                </div>
                {i < rightItems.length - 1 && <div className="w-full h-[1px] bg-white/10" />}
              </div>
            ))}
          </div>

          <div className="mt-16 font-['Fraunces'] italic text-[14px] text-white/70">
            "AForce compounds. The user becomes the product."
          </div>
        </div>
      </div>

      {/* Bottom Center Foot */}
      <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
        <div className="text-[14px] tracking-[0.25em] text-white/30 uppercase">
          S T I M U L A T I O N &nbsp; · &nbsp; E X P I R E S &nbsp; · &nbsp; D I S C I P L I N E &nbsp; · &nbsp; C O M P O U N D S
        </div>
        <div className="w-[200px] h-[1px] bg-white/10" />
      </div>
    </div>
  );
}
