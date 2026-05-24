import React from "react";

export function Proof() {
  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter'] flex flex-col items-center justify-between py-12 select-none">
      {/* Optional faint radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

      {/* Band 1 — Header (~110px) */}
      <div className="w-full relative flex flex-col items-center z-10 pt-4">
        <div className="absolute top-0 left-12 text-[10px] text-white/35 tracking-[0.2em]">
          F I G . &nbsp; 0 5 &nbsp; · &nbsp; P R O O F
        </div>
        <div className="absolute top-0 right-12 text-[10px] text-white/35 tracking-[0.2em]">
          Q 3 &nbsp; 2 0 2 6 &nbsp; · &nbsp; I N T E R N A L &nbsp; M O D E L
        </div>
        
        <h1 className="text-[42px] font-light text-white/95 mt-6 mb-8 tracking-tight">
          What discipline looks like in numbers.
        </h1>
        <div className="w-[240px] h-px bg-white/12 mb-4" />
        <p className="font-['Fraunces'] italic text-[13px] text-white/45">
          "All seven metrics measured against category baseline."
        </p>
      </div>

      {/* Band 2 — Metric grid (~560px) */}
      <div className="grid grid-cols-4 grid-rows-2 gap-x-[80px] gap-y-[70px] px-[120px] w-full z-10 mt-8 mb-4">
        {/* 1. CAC TARGET */}
        <MetricCell
          label="C A C   T A R G E T"
          number="$24"
          unit=".50"
          comparison="v s   c a t e g o r y   ·   − 5 8 %"
          sparklinePath="M0,5 C30,10 60,18 100,20 L140,22"
        />

        {/* 2. REPEAT PURCHASE RATE */}
        <MetricCell
          label="R E P E A T   P U R C H A S E   R A T E"
          number="64"
          unit="%"
          comparison="v s   c a t e g o r y   ·   + 3 . 2 ×"
          sparklinePath="M0,20 C40,20 80,10 140,5"
        />

        {/* 3. SUBSCRIPTION CONVERSION */}
        <MetricCell
          label="S U B S C R I P T I O N   C O N V E R S I O N"
          number="38"
          unit="%"
          comparison="v s   c a t e g o r y   ·   + 4 . 7 ×"
          sparklinePath="M0,22 C40,22 50,8 140,5"
        />

        {/* 4. RITUAL ADOPTION (D30) */}
        <MetricCell
          label="R I T U A L   A D O P T I O N   ( D 3 0 )"
          number="71"
          unit="%"
          comparison="v s   b a s e l i n e   ·   + 5 . 1 ×"
          sparklinePath="M0,20 C30,22 70,5 140,2"
          redSparkline
        />

        {/* 5. OS ENGAGEMENT (DAU/MAU) */}
        <MetricCell
          label="O S   E N G A G E M E N T   ( D A U / M A U )"
          number="0.62"
          unit=""
          comparison="v s   c a t e g o r y   ·   n / a"
          sparklinePath="M0,8 C40,10 100,6 140,8"
        />

        {/* 6. RETENTION RATE (M6) */}
        <MetricCell
          label="R E T E N T I O N   R A T E   ( M 6 )"
          number="81"
          unit="%"
          comparison="v s   c a t e g o r y   ·   + 6 . 4 ×"
          sparklinePath="M0,22 C50,20 90,4 140,2"
        />

        {/* 7. ECOSYSTEM PARTICIPATION */}
        <MetricCell
          label="E C O S Y S T E M   P A R T I C I P A T I O N"
          number="2.4"
          unit="events / wk"
          comparison="v s   b a s e l i n e   ·   + 3 . 9 ×"
          sparklinePath="M0,18 C40,18 80,12 140,4"
        />

        {/* 8. NORTH STAR */}
        <div className="flex flex-col justify-center items-center text-center mt-2">
          <div className="text-[10px] text-white/40 tracking-[0.15em] mb-8">
            N O R T H &nbsp; S T A R
          </div>
          <div className="font-['Fraunces'] italic text-[22px] text-white/85 mb-8">
            "Become AForce."
          </div>
          <div className="w-[60px] h-px bg-white/12 mb-8" />
          <div className="w-[6px] h-[6px] rounded-full bg-[#E25C5C] mb-8" />
          <div className="text-[10px] text-white/30 tracking-[0.2em]">
            R I T U A L &nbsp; · &nbsp; R E I N F O R C E M E N T &nbsp; · &nbsp; R E T E N T I O N
          </div>
        </div>
      </div>

      {/* Band 3 — Footer (~120px) */}
      <div className="w-full flex flex-col items-center z-10 pb-8">
        <div className="w-[280px] h-px bg-white/08 mb-8" />
        
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <span className="text-[26px] font-light text-white/85 tracking-tight">5 0 M +</span>
          </div>
          
          <span className="text-white/15">·</span>
          
          <div className="flex items-center gap-3">
            <span className="text-[26px] font-light text-white/85 tracking-tight">9 4 %</span>
          </div>
          
          <span className="text-white/15">·</span>
          
          <div className="flex items-center gap-3">
            <span className="text-[26px] font-light text-white/85 tracking-tight">$ 1 1 8</span>
          </div>
        </div>

        <div className="flex items-center gap-12 mt-3">
          <div className="text-[10px] text-white/40 tracking-[0.15em] w-[80px] text-center">
            P L A N N E D<br/>U S E R<br/>C E I L I N G
          </div>
          
          <span className="text-transparent">·</span>
          
          <div className="text-[10px] text-white/40 tracking-[0.15em] w-[140px] text-center">
            W E E K L Y &nbsp; R I T U A L<br/>C O M P L I A N C E
          </div>
          
          <span className="text-transparent">·</span>
          
          <div className="text-[10px] text-white/40 tracking-[0.15em] w-[80px] text-center">
            L T V &nbsp; : &nbsp; C A C<br/>R A T I O
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  number,
  unit,
  comparison,
  sparklinePath,
  redSparkline = false,
}: {
  label: string;
  number: string;
  unit: string;
  comparison: string;
  sparklinePath: string;
  redSparkline?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] text-white/40 tracking-[0.15em] mb-4">
        {label}
      </div>
      <div className="flex items-baseline mb-6">
        <span className="text-[64px] font-light text-white/95 tracking-tight leading-none">
          {number}
        </span>
        {unit && (
          <span className="text-[22px] text-white/55 ml-1">
            {unit}
          </span>
        )}
      </div>
      <div className="w-[80px] h-px bg-white/08 mb-6" />
      <div className="mb-6">
        <svg width="140" height="24" viewBox="0 0 140 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d={sparklinePath}
            stroke={redSparkline ? "rgba(226, 92, 92, 0.6)" : "rgba(255, 255, 255, 0.45)"}
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-[11px] text-white/40 tracking-wider">
        {comparison}
      </div>
    </div>
  );
}
