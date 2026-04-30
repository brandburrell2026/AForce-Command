import React from "react";
import { Activity, Bell, Battery, Check } from "lucide-react";

export function CalmCoach() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundColor: "#0A0A0F",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        className="w-[390px] h-[844px] relative overflow-hidden flex flex-col items-center justify-between py-12"
        style={{
          background: "radial-gradient(circle at 50% 0%, #151821 0%, #0A0A0F 100%)",
          borderRadius: "40px",
          boxShadow: "0 0 0 8px #000, 0 0 0 10px #333",
        }}
      >
        {/* Top Status Bar (Ring Connected) */}
        <div className="w-full px-8 flex justify-between items-center z-10">
          <div className="flex flex-col">
            <span className="text-white/40 text-xs font-medium tracking-widest uppercase">
              AForce Ring
            </span>
            <span className="text-white/90 text-sm font-medium mt-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7CD3E5] animate-pulse" />
              Connected
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
              {/* Ring Representation */}
              <div className="w-5 h-5 rounded-full border-[2px] border-[#d4d4d8] shadow-[inset_0_0_4px_rgba(255,255,255,0.5)] flex items-center justify-center relative">
                <div className="w-1 h-1 rounded-full bg-[#7CD3E5] absolute top-[1px] right-[1px] shadow-[0_0_4px_#7CD3E5]" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/50 text-xs">
              <Battery size={14} />
              <span>82%</span>
            </div>
          </div>
        </div>

        {/* Central Orb & Reading */}
        <div className="flex-1 w-full flex flex-col items-center justify-center relative mt-8">
          {/* Background Glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[80px] opacity-20 animate-pulse"
            style={{
              background: "radial-gradient(circle, #F4B23F 0%, transparent 70%)",
              animationDuration: "4s",
            }}
          />

          {/* The Orb */}
          <div className="relative w-64 h-64 flex items-center justify-center z-10">
            {/* Outer rings */}
            <div className="absolute inset-0 rounded-full border border-[#F4B23F]/20 animate-[spin_10s_linear_infinite]" />
            <div className="absolute inset-2 rounded-full border border-dashed border-[#F4B23F]/30 animate-[spin_15s_linear_infinite_reverse]" />
            
            {/* Inner Core */}
            <div
              className="w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-[inset_0_0_40px_rgba(244,178,63,0.2)]"
              style={{
                background: "linear-gradient(135deg, rgba(244,178,63,0.1) 0%, rgba(244,178,63,0.02) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(244,178,63,0.15)",
              }}
            >
              <span className="text-white/60 text-sm font-medium mb-1">Deficit</span>
              <span className="text-[#F4B23F] text-5xl font-light tracking-tight">1.2<span className="text-2xl text-[#F4B23F]/70">%</span></span>
              <span className="text-white/40 text-xs mt-2 font-medium tracking-wide">MODERATE</span>
            </div>
          </div>

          <div className="mt-12 text-center flex flex-col items-center gap-3 z-10">
            <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
              <Activity size={14} className="text-[#7CD3E5]" />
              <span className="text-white/70 text-sm">Sweat onset detected 12 min ago</span>
            </div>
            <p className="text-white/40 text-xs px-12 leading-relaxed">
              Your body temperature is slightly elevated. We're keeping an eye on it.
            </p>
          </div>
        </div>

        {/* Action Card */}
        <div className="w-full px-6 z-10 mb-4">
          <div
            className="w-full rounded-[24px] p-6 relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{
                background: "linear-gradient(90deg, #F4B23F 0%, transparent 100%)",
                opacity: 0.5,
              }}
            />
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#F4B23F]/10 flex items-center justify-center shrink-0 border border-[#F4B23F]/20 mt-1">
                <Bell size={18} className="text-[#F4B23F]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white/90 text-lg font-medium leading-tight">
                  Time for 8 oz
                </h3>
                <p className="text-white/50 text-sm mt-1 mb-4 leading-relaxed">
                  About 4 minutes from now to stay ahead of your sweat loss.
                </p>
                <button
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-white/10"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <Check size={16} className="text-white/70" />
                  <span className="text-white/90 font-medium text-sm">I'm having it now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Home Indicator */}
        <div className="w-1/3 h-1 bg-white/20 rounded-full absolute bottom-2" />
      </div>
    </div>
  );
}

export default CalmCoach;
