import React, { useEffect, useState } from "react";

export function CheckIn() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center justify-between">
      {/* Background Soft Glow */}
      <div 
        className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* Top Section */}
      <div className="w-full pt-[120px] flex flex-col items-center">
        <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase font-medium">
          5:15 AM &middot; Tuesday
        </p>
      </div>

      {/* Middle Section - Mantra */}
      <div className="flex flex-col items-center w-full px-8 relative z-10 -mt-20">
        <div className="flex flex-col items-center gap-[4px] mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E25C5C] shadow-[0_0_8px_rgba(226,92,92,0.4)]" />
        </div>
        
        <div className="text-[32px] font-light text-white/95 leading-[1.8] text-center tracking-wide">
          <div 
            className={`transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "200ms" }}
          >
            Pause.
          </div>
          <div 
            className={`transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "800ms" }}
          >
            Hydrate.
          </div>
          <div 
            className={`transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "1400ms" }}
          >
            Lock in.
          </div>
          <div 
            className={`transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "2000ms" }}
          >
            Perform.
          </div>
        </div>
      </div>

      {/* Bottom Section - CTA */}
      <div className="w-full px-8 pb-[64px] z-10">
        <button 
          className={`w-full py-[18px] border border-white/15 rounded-full text-white/90 text-[15px] font-medium tracking-wide transition-all duration-700 hover:border-white/30 hover:bg-white/[0.02] active:scale-[0.98] ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "2800ms" }}
        >
          Begin
        </button>
      </div>

      {/* Noise Texture Overlay for Premium Feel */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default CheckIn;