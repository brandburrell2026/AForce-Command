export function Hydration() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center justify-between py-12">
      <div className="flex flex-col items-center gap-1.5 z-10 mt-4">
        <div className="text-[10px] tracking-[0.4em] text-white/40 uppercase pl-1">Hydration</div>
        <div className="text-[10px] tracking-wider text-white/30">5:18 AM · BRICKELL</div>
      </div>
      <div className="relative flex-1 w-full flex items-center justify-center -my-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-white/[0.03] blur-[60px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-white/[0.03]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[270px] h-[270px] rounded-full border border-white/[0.08]" />
        <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[270px] h-[270px] -rotate-90">
          <circle cx="135" cy="135" r="134.5" fill="none" stroke="#E25C5C" strokeWidth="1" strokeDasharray="845" strokeDashoffset="800" />
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[210px] h-[210px] rounded-full border border-white/[0.02]" />
        <div className="flex flex-col items-center z-10 mt-4">
          <div className="text-[96px] font-light leading-none tracking-tighter text-white mb-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">87</div>
          <div className="text-[11px] tracking-[0.3em] text-white/70 uppercase pl-1">Dialed In</div>
        </div>
      </div>
      <div className="flex items-center justify-between w-[300px] z-10 mb-12">
        <div className="flex flex-col items-center flex-1">
          <div className="text-[9px] tracking-[0.2em] text-white/40 mb-2 uppercase">Intake</div>
          <div className="text-[13px] text-white/90 font-light tracking-wide">1.4L</div>
        </div>
        <div className="w-[1px] h-8 bg-white/10" />
        <div className="flex flex-col items-center flex-1">
          <div className="text-[9px] tracking-[0.2em] text-white/40 mb-2 uppercase">Depletion</div>
          <div className="text-[13px] text-white/90 font-light tracking-wide">32<span className="text-[10px] text-white/50 ml-1">pts/hr</span></div>
        </div>
        <div className="w-[1px] h-8 bg-white/10" />
        <div className="flex flex-col items-center flex-1">
          <div className="text-[9px] tracking-[0.2em] text-white/40 mb-2 uppercase">Window</div>
          <div className="text-[13px] text-white/90 font-light tracking-wide">11:42</div>
        </div>
      </div>
      <div className="z-10 pb-8">
        <button className="text-[11px] text-white/70 tracking-[0.1em] uppercase border-b border-white/20 pb-1">Log intake</button>
      </div>
    </div>
  );
}
