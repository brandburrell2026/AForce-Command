import React from 'react';

export function Scandi() {
  return (
    <div className="min-h-screen w-full bg-[#FAF9F7] text-[#1A1A1A] relative overflow-hidden p-16 antialiased flex flex-col">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" />
      
      {/* Absolute minimal grid mark */}
      <div className="absolute top-[50%] left-0 w-full h-[1px] bg-[#EAE8E3] pointer-events-none" />
      <div className="absolute top-0 left-[50%] w-[1px] h-full bg-[#EAE8E3] pointer-events-none" />

      {/* Grid content alignment */}
      <div className="flex-1 w-full h-full relative z-10 font-['Inter'] text-[12px] tracking-[-0.02em]">
        
        {/* Top Left: Wordmark */}
        <div className="absolute top-0 left-0 font-medium">
          AForce
        </div>

        {/* Top Right: Footer info */}
        <div className="absolute top-0 right-0 text-[#888888]">
          Investor Briefing · 2026
        </div>

        {/* Bottom Left: Positioning */}
        <div className="absolute bottom-0 left-0 text-[#555555] max-w-[200px] leading-[1.6]">
          A real-time human performance operating system.
        </div>

        {/* Bottom Right: Ritual */}
        <div className="absolute bottom-0 right-0 font-medium">
          Pause. Hydrate. Lock In. Perform.
        </div>

      </div>
    </div>
  );
}
