export function CheckIn() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center justify-between">
      <div
        className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)" }}
      />
      <div className="w-full pt-[120px] flex flex-col items-center">
        <p className="text-[10px] tracking-[0.4em] text-white/40 uppercase font-medium">5:15 AM · Tuesday</p>
      </div>
      <div className="flex flex-col items-center w-full px-8 relative z-10 -mt-20">
        <div className="flex flex-col items-center gap-[4px] mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E25C5C] shadow-[0_0_8px_rgba(226,92,92,0.4)]" />
        </div>
        <div className="text-[32px] font-light text-white/95 leading-[1.8] text-center tracking-wide">
          <div>Pause.</div>
          <div>Hydrate.</div>
          <div>Lock in.</div>
          <div>Perform.</div>
        </div>
      </div>
      <div className="w-full px-8 pb-[64px] z-10">
        <button className="w-full py-[18px] border border-white/15 rounded-full text-white/90 text-[15px] font-medium tracking-wide">
          Begin
        </button>
      </div>
    </div>
  );
}
