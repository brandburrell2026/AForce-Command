export function Readiness() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="mt-16 mb-auto w-full text-center">
        <span className="text-[10px] tracking-[0.4em] text-white/40 uppercase">
          R E A D I N E S S<span className="mx-2">·</span>T O D A Y
        </span>
      </div>
      <div className="relative flex flex-col items-center justify-center mt-8">
        <div className="relative w-[240px] h-[240px] flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="110" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
            <circle
              cx="120"
              cy="120"
              r="110"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
              strokeDasharray="691.15"
              strokeDashoffset={691.15 * (1 - 0.78)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute w-[200px] h-[200px] rounded-full border border-white/5"></div>
          <div className="flex flex-col items-center">
            <span className="text-[80px] leading-none font-light tracking-tighter">78</span>
          </div>
        </div>
        <div className="mt-12 text-[11px] tracking-[0.5em] text-white/60 uppercase">P R O C E E D</div>
      </div>
      <div className="w-full px-8 mt-16 mb-auto flex flex-col">
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <span className="text-[11px] tracking-[0.2em] text-white/50 uppercase">HRV</span>
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[2px] bg-white/[0.15] rounded-full overflow-hidden">
              <div className="h-full bg-white/70 w-[65%]" />
            </div>
            <span className="text-[13px] font-light w-10 text-right">42ms</span>
          </div>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <span className="text-[11px] tracking-[0.2em] text-white/50 uppercase">RHR</span>
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[2px] bg-white/[0.15] rounded-full overflow-hidden">
              <div className="h-full bg-white/70 w-[80%]" />
            </div>
            <span className="text-[13px] font-light w-10 text-right">54</span>
          </div>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <span className="text-[11px] tracking-[0.2em] text-white/60 uppercase">SLEEP</span>
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[2px] bg-white/[0.15] rounded-full overflow-hidden">
              <div className="h-full bg-[#E25C5C] w-[40%]" />
            </div>
            <span className="text-[13px] font-light w-10 text-right text-white/90">4.2h</span>
          </div>
        </div>
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <span className="text-[11px] tracking-[0.2em] text-white/50 uppercase">STRAIN</span>
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[2px] bg-white/[0.15] rounded-full overflow-hidden">
              <div className="h-full bg-white/70 w-[90%]" />
            </div>
            <span className="text-[13px] font-light w-10 text-right">14.1</span>
          </div>
        </div>
      </div>
      <div className="pb-12 mt-auto">
        <button className="text-[11px] text-white/50 uppercase tracking-[0.1em] border-b border-white/20 pb-1">
          View 7-day window
        </button>
      </div>
    </div>
  );
}
