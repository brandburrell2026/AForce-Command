import React, { useState, useEffect } from "react";
import { Activity, Heart, Droplets, Zap, Timer, Flame, MapPin } from "lucide-react";

const TEAL = "#7CD3E5";
const AMBER = "#F4B23F";
const BG_COLOR = "#0A0A0F";
const CARD_BG = "rgba(255, 255, 255, 0.03)";
const BORDER_COLOR = "rgba(124, 211, 229, 0.15)";
const NEON_GREEN = "#A3FF12"; // Added vibrant accent for sport mode
const ALERT_RED = "#FF453A";

export function SportMode() {
  const [hydrationDebt, setHydrationDebt] = useState(14.2);
  const [nextSipSeconds, setNextSipSeconds] = useState(180);
  const [elapsedTime, setElapsedTime] = useState(2280); // 38 mins

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setHydrationDebt((prev) => +(prev + 0.01).toFixed(2));
      setNextSipSeconds((prev) => (prev > 0 ? prev - 1 : 480));
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center font-sans overflow-hidden"
      style={{ background: "#000" }}
    >
      <div
        className="w-[390px] h-[844px] relative flex flex-col text-white"
        style={{ background: BG_COLOR }}
      >
        {/* Header / Ring Status */}
        <div className="pt-12 pb-4 px-6 flex items-center justify-between z-10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
              Live Session
            </span>
            <span className="text-sm font-semibold tracking-wide text-white">
              AForce Engine Active
            </span>
          </div>

          {/* Ring Avatar / Badge */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(124,211,229,0.1)]">
            <div className="relative w-4 h-4 rounded-full border-[1.5px] border-[#c0c0c0] flex items-center justify-center bg-gradient-to-br from-gray-700 to-black">
              <div className="w-1 h-1 bg-[#A3FF12] rounded-full animate-pulse shadow-[0_0_5px_#A3FF12]"></div>
            </div>
            <span className="text-[10px] font-bold text-white/80 tracking-wider">A-RING PRO</span>
          </div>
        </div>

        {/* Main Sport Badge */}
        <div className="px-6 flex justify-center z-10 mt-2">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              background: "rgba(163, 255, 18, 0.1)",
              borderColor: "rgba(163, 255, 18, 0.3)",
            }}
          >
            <Activity size={14} color={NEON_GREEN} />
            <span className="text-xs font-bold tracking-widest" style={{ color: NEON_GREEN }}>
              SOCCER · ZONE 4
            </span>
          </div>
        </div>

        {/* Big Chronometer */}
        <div className="flex flex-col items-center justify-center mt-8 mb-6 z-10">
          <div className="text-[80px] leading-none font-black tracking-tighter" style={{ fontFamily: "Space Mono, monospace" }}>
            {formatElapsed(elapsedTime)}
          </div>
          <div className="text-sm text-white/40 tracking-widest uppercase font-bold mt-2">
            Duration
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="px-6 grid grid-cols-2 gap-3 z-10">
          {/* Heart Rate */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between"
            style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Heart size={16} color={ALERT_RED} className="animate-pulse" />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">HR</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">168</span>
              <span className="text-xs text-white/40 font-bold">bpm</span>
            </div>
          </div>

          {/* Sweat Rate */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden"
            style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}` }}
          >
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Droplets size={80} color={TEAL} />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Droplets size={16} color={TEAL} />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">Sweat</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">1.8</span>
              <span className="text-xs text-white/40 font-bold">L/h</span>
            </div>
          </div>
          
          {/* Temperature */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between"
            style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}` }}
          >
             <div className="flex items-center gap-2 mb-2">
              <Flame size={16} color={AMBER} />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">Temp</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">38.2</span>
              <span className="text-xs text-white/40 font-bold">°C</span>
            </div>
          </div>
          
           {/* GSR Onset */}
           <div
            className="rounded-2xl p-4 flex flex-col justify-between"
            style={{ background: CARD_BG, border: `1px solid ${BORDER_COLOR}` }}
          >
             <div className="flex items-center gap-2 mb-2">
              <Zap size={16} color="#B084CC" />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">GSR</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight">Active</span>
            </div>
            <span className="text-[10px] text-white/40 mt-1">Onset @ 04:12</span>
          </div>
        </div>

        {/* Dynamic Action Zone */}
        <div className="mt-auto px-6 pb-12 z-10 flex flex-col gap-4">
          
          {/* Hydration Debt Tracker */}
          <div 
            className="rounded-3xl p-5 relative overflow-hidden"
            style={{ background: "linear-gradient(145deg, rgba(124, 211, 229, 0.15) 0%, rgba(10, 10, 15, 0.9) 100%)", border: `1px solid ${TEAL}60` }}
          >
            <div className="flex justify-between items-end mb-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold tracking-widest text-white/70 uppercase">Live Deficit</span>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-black tracking-tighter" style={{ color: TEAL }}>{hydrationDebt.toFixed(1)}</span>
                  <span className="text-sm font-bold opacity-80 text-white">oz</span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Na+ Loss</span>
                <span className="text-lg font-bold text-white">450 <span className="text-[10px] text-white/50">mg</span></span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mt-2 relative">
              <div 
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (hydrationDebt / 20) * 100)}%`, background: `linear-gradient(90deg, ${TEAL}, #4F9DB0)` }}
              />
            </div>
          </div>

          {/* Prescriptive Action */}
          <div className="w-full rounded-full h-16 flex items-center justify-between px-2" style={{ background: AMBER }}>
            <div className="bg-black/20 h-12 w-12 rounded-full flex items-center justify-center">
               <Timer size={20} color="#000" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col items-center">
               <span className="text-[10px] font-bold text-black/60 tracking-widest uppercase">Next Sip In</span>
               <span className="text-xl font-black text-black tracking-widest" style={{ fontFamily: "Space Mono, monospace" }}>
                 {formatTime(nextSipSeconds)}
               </span>
            </div>
            <div className="h-12 px-6 rounded-full bg-black flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-transform">
              <span className="text-sm font-black text-white uppercase tracking-wider">Log 8 oz</span>
            </div>
          </div>
        </div>

        {/* Background Gradients */}
        <div className="absolute top-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-20 pointer-events-none" style={{ background: NEON_GREEN }} />
        <div className="absolute bottom-[10%] left-[-20%] w-[300px] h-[300px] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: TEAL }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>
    </div>
  );
}
