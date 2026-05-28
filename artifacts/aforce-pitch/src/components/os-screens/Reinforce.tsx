export function Reinforce() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center pt-20 pb-12 px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_50%)] pointer-events-none" />
      <div className="w-full flex justify-center mb-16 z-10">
        <span className="text-[10px] tracking-[0.4em] text-white/40 uppercase">R e i n f o r c e m e n t</span>
      </div>
      <div className="w-full flex-1 flex flex-col z-10">
        <div className="w-full relative flex flex-col justify-center py-6 px-4 before:absolute before:bottom-0 before:left-0 before:w-full before:h-[1px] before:bg-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#E25C5C] shadow-[0_0_12px_rgba(226,92,92,0.5)]" />
              <span className="text-[17px] font-medium text-white tracking-tight">Hydrate before the call</span>
            </div>
            <span className="text-[10px] tracking-[0.1em] text-white/40">IN 4 MIN</span>
          </div>
          <p className="text-[14px] text-white/50 leading-relaxed font-light pl-[22px]">
            Cortisol is spiking. 200ml now stabilizes the next 90 min.
          </p>
        </div>
        <div className="w-full relative flex flex-col justify-center py-6 px-4 before:absolute before:bottom-0 before:left-0 before:w-full before:h-[1px] before:bg-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <span className="text-[17px] font-medium text-white tracking-tight">Shift focus</span>
            </div>
            <span className="text-[10px] tracking-[0.1em] text-white/40">14:00</span>
          </div>
          <p className="text-[14px] text-white/50 leading-relaxed font-light pl-[22px]">
            Deep work cycle ends. Transition to low-cognitive load.
          </p>
        </div>
        <div className="w-full relative flex flex-col justify-center py-6 px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <span className="text-[17px] font-medium text-white tracking-tight">Wind down</span>
            </div>
            <span className="text-[10px] tracking-[0.1em] text-white/40">20:30</span>
          </div>
          <p className="text-[14px] text-white/50 leading-relaxed font-light pl-[22px]">
            Blue light exposure is high. Dim environment to protect sleep architecture.
          </p>
        </div>
      </div>
      <div className="w-full flex justify-center mt-auto z-10">
        <span className="text-[11px] text-white/30 font-light">AFORCE learns from your last 28 days.</span>
      </div>
    </div>
  );
}
