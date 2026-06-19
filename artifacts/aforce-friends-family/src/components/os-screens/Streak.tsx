function RitualRow({ title, time, completed }: { title: string; time: string; completed: boolean }) {
  return (
    <div className="flex items-center justify-between py-[22px] border-b border-white/10">
      <div className="flex items-center gap-[14px]">
        <span className="text-[15px] font-light text-white/90">{title}</span>
        <span className="text-[13px] font-light text-white/30">·</span>
        <span className="text-[13px] font-light text-white/40 tracking-wide">{time}</span>
      </div>
      <div className="w-[18px] h-[18px] rounded-full border border-white/20 flex items-center justify-center">
        {completed && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4L3.5 6.5L9 1" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function Streak() {
  const days = Array.from({ length: 30 }, (_, i) => {
    if (i < 8) return "completed";
    if (i === 8) return "skipped";
    if (i > 8 && i < 24) return "completed";
    if (i === 24) return "missed";
    return "upcoming";
  });

  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center">
      <div className="absolute top-[120px] left-1/2 -translate-x-1/2 w-[320px] h-[320px] bg-white/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="mt-[140px] flex flex-col items-center z-10">
        <div className="text-[96px] font-light leading-none tracking-tight">23</div>
        <div className="mt-6 text-[10px] text-white/40 tracking-[0.4em] uppercase">Day Streak</div>
      </div>
      <div className="mt-[80px] grid grid-cols-5 gap-x-8 gap-y-6 z-10">
        {days.map((status, i) => (
          <div key={i} className="w-[12px] h-[12px] flex items-center justify-center">
            {status === "completed" && <div className="w-[6px] h-[6px] rounded-full bg-white/90" />}
            {status === "missed" && <div className="w-[4px] h-[4px] rounded-full bg-[#E25C5C]" />}
            {status === "skipped" && <div className="w-[6px] h-[6px] rounded-full bg-white/25 ring-1 ring-white/10" />}
            {status === "upcoming" && <div className="w-[6px] h-[6px] rounded-full bg-white/15" />}
          </div>
        ))}
      </div>
      <div className="mt-[100px] w-full px-[48px] z-10">
        <div className="border-t border-white/10" />
        <RitualRow title="Hydrate" time="5:15 AM" completed={true} />
        <RitualRow title="Move" time="6:00 AM" completed={true} />
        <RitualRow title="Lock In" time="6:30 AM" completed={false} />
      </div>
    </div>
  );
}
