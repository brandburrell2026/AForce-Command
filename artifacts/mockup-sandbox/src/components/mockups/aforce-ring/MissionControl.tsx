import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Droplets, 
  Thermometer, 
  Clock, 
  Zap, 
  Target, 
  HeartPulse, 
  Radio,
  Fingerprint,
  Timer
} from "lucide-react";

const TEAL = "#7CD3E5";
const AMBER = "#F4B23F";
const BG = "#0A0A0F";
const RED = "#FF4B4B";

export function MissionControl() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center font-sans overflow-hidden"
      style={{ backgroundColor: BG, color: "#fff" }}
    >
      <div 
        className="w-[390px] h-[844px] relative overflow-hidden flex flex-col"
        style={{ 
          backgroundImage: `
            linear-gradient(rgba(124, 211, 229, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124, 211, 229, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px"
        }}
      >
        {/* Subtle scanline overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-50"></div>

        {/* Header */}
        <div className="px-5 pt-12 pb-4 flex justify-between items-end border-b border-white/10 relative z-10">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] mb-1" style={{ color: TEAL }}>AFORCE LINK</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium text-white/80">Ring Connected</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-white/50">{time.toLocaleTimeString('en-US', { hour12: false })}</div>
            <div className="font-mono text-[10px] text-white/30">SYNC_MS: 12</div>
          </div>
        </div>

        <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto relative z-10">
          
          {/* Ring Status Visualizer */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-white/20 rounded-full"></div>
                <div className="absolute inset-[2px] border-[1.5px] border-transparent border-t-[#7CD3E5] border-r-[#7CD3E5] rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TEAL, boxShadow: `0 0 8px ${TEAL}` }}></div>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-white/50 font-medium mb-1">TITANIUM SERIES X</div>
                <div className="font-mono text-xs text-white/80 flex items-center gap-1">
                  <Zap size={10} color={AMBER} /> 84% BATTERY
                </div>
              </div>
            </div>
            <div className="text-right">
              <Activity size={20} color={TEAL} className="opacity-50 inline-block mb-1" />
              <div className="text-[10px] font-mono text-white/40">STREAMING</div>
            </div>
          </div>

          {/* Primary Biometrics */}
          <div className="grid grid-cols-2 gap-3">
            {/* Heart Rate */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <HeartPulse size={16} color={RED} />
                <div className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">ZONE 3</div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-medium tracking-tight">142</span>
                  <span className="text-xs text-white/50 font-medium">BPM</span>
                </div>
                <div className="mt-2 h-6 w-full flex items-end gap-[2px]">
                  {[40,50,45,60,75,85,90,80,95,100,85,90].map((h, i) => (
                    <div key={i} className="flex-1 bg-red-500/40 rounded-t-sm" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Skin Temp */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <Thermometer size={16} color={AMBER} />
                <div className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">ELEVATED</div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-medium tracking-tight">38.2</span>
                  <span className="text-xs text-white/50 font-medium">°C</span>
                </div>
                <div className="text-[10px] font-mono text-amber-400 mt-1 flex items-center gap-1">
                  ↑ +1.4°C / 10m
                </div>
              </div>
            </div>
          </div>

          {/* Sweat Engine HUD */}
          <div className="p-4 rounded-xl border border-[#7CD3E5]/20 bg-[#7CD3E5]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target size={100} />
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <Droplets size={16} color={TEAL} />
              <span className="text-xs font-bold tracking-widest" style={{ color: TEAL }}>SWEAT ENGINE LIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <div className="text-[10px] text-white/50 mb-1">GSR ONSET DETECTED</div>
                <div className="font-mono text-sm">14:22:04 <span className="text-white/30 ml-1">UTC-4</span></div>
              </div>
              <div>
                <div className="text-[10px] text-white/50 mb-1">CURRENT RATE</div>
                <div className="font-mono text-sm" style={{ color: TEAL }}>1.24 L/h</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-white/50">HYDRATION DEFICIT</span>
                  <span className="font-mono text-white/90">2.1%</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full bg-gradient-to-r from-[#7CD3E5] to-[#F4B23F] w-[21%] rounded-full"></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-white/50">SODIUM LOSS (Est.)</span>
                  <span className="font-mono text-white/90">840 mg</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full bg-white/80 w-[45%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Autopilot Prescription */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Radio size={14} color={AMBER} className="animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-white/70">AUTOPILOT RX</span>
                </div>
                <div className="text-2xl font-mono font-medium mt-2">
                  12 <span className="text-sm text-white/50">oz</span>
                </div>
                <div className="text-xs text-white/50 mt-1">AForce Sport</div>
              </div>
              
              <div className="text-right">
                <div className="text-[10px] text-white/40 mb-1">NEXT RECHECK</div>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-[#F4B23F]/30 relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle 
                      cx="26" cy="26" r="26" 
                      fill="none" 
                      stroke="#F4B23F" 
                      strokeWidth="2" 
                      strokeDasharray="163" 
                      strokeDashoffset="40" 
                      className="translate-x-[2px] translate-y-[2px]"
                    />
                  </svg>
                  <span className="font-mono text-sm text-[#F4B23F]">08:42</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 flex items-center justify-center gap-2 border-t border-white/5 bg-black/50 backdrop-blur-md relative z-10">
          <Fingerprint size={12} color={TEAL} className="opacity-50" />
          <span className="text-[9px] font-mono text-white/30 tracking-widest">CONTINUOUS MONITORING ACTIVE</span>
        </div>
      </div>
    </div>
  );
}