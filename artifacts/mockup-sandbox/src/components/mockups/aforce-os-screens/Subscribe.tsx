import React from 'react';
import { Check } from 'lucide-react';

export function Subscribe() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col px-8">
      {/* Soft background glow */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none" />

      {/* Top half: Editorial hero */}
      <div className="pt-[140px] pb-12 z-10">
        <p className="text-[10px] tracking-[0.4em] text-white/40 mb-6 uppercase">M E M B E R S H I P</p>
        <h1 className="text-[32px] font-light leading-[1.2] tracking-tight">
          <span className="text-white">Commit to your standard.</span>
          <br />
          <span className="text-white/60">Be measured against it.</span>
        </h1>
      </div>

      {/* Middle: Tier Card */}
      <div className="border border-white/[0.08] rounded-[24px] p-8 bg-black/40 backdrop-blur-md z-10 flex-1 flex flex-col justify-between mb-10 relative">
        {/* Very subtle glow inside card */}
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-[11px] tracking-[0.3em] text-white/80 uppercase">AFORCE PROTOCOL</h2>
            {/* Red accent */}
            <div className="w-1.5 h-1.5 rounded-full bg-[#E25C5C] shadow-[0_0_8px_rgba(226,92,92,0.4)]" />
          </div>
          
          <div className="text-[42px] font-light mb-10 tracking-tight flex items-baseline gap-2">
            $49 <span className="text-[16px] text-white/40 font-normal">/ month</span>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Check className="w-5 h-5 text-white/60 stroke-[1px] mt-0.5 shrink-0" />
              <p className="text-[15px] text-white/80 leading-relaxed font-light">Personalized hydration protocol</p>
            </div>
            <div className="flex items-start gap-4">
              <Check className="w-5 h-5 text-white/60 stroke-[1px] mt-0.5 shrink-0" />
              <p className="text-[15px] text-white/80 leading-relaxed font-light">AI coach voice engine</p>
            </div>
            <div className="flex items-start gap-4">
              <Check className="w-5 h-5 text-white/60 stroke-[1px] mt-0.5 shrink-0" />
              <p className="text-[15px] text-white/80 leading-relaxed font-light">Weekly performance audit</p>
            </div>
            <div className="flex items-start gap-4">
              <Check className="w-5 h-5 text-white/60 stroke-[1px] mt-0.5 shrink-0" />
              <p className="text-[15px] text-white/80 leading-relaxed font-light">Founder accountability circle</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: CTA */}
      <div className="pb-12 z-10 flex flex-col items-center">
        <button className="w-full bg-white text-black py-4 rounded-full text-[15px] font-medium tracking-wide mb-6 hover:bg-white/90 transition-colors">
          Begin Protocol
        </button>
        <p className="text-[10px] tracking-[0.3em] text-white/30 uppercase text-center w-full">
          Cancel anytime · Receipt in your inbox
        </p>
      </div>
    </div>
  );
}
