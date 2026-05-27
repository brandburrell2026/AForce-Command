import React from 'react';

export function Documentary() {
  return (
    <div className="w-[1280px] h-[900px] flex bg-[#f4f1ea] text-[#2d2a26] overflow-hidden" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
      
      <div className="w-5/12 p-20 flex flex-col justify-between h-full">
        <div>
          <h1 className="text-2xl tracking-[0.3em] uppercase font-['Inter'] mb-12 opacity-80">
            AForce
          </h1>
        </div>
        
        <div className="mb-20">
          <h2 className="text-6xl font-light leading-[1.15] mb-12 tracking-tight">
            Pause.<br />
            Hydrate.<br />
            Lock In.<br />
            <span className="italic opacity-80">Perform.</span>
          </h2>
          
          <p className="text-2xl opacity-70 max-w-sm leading-snug border-t border-[#2d2a26]/20 pt-8 mt-12">
            A real-time human performance operating system.
          </p>
        </div>
        
        <div className="text-xs uppercase tracking-[0.2em] font-['Inter'] opacity-40">
          Investor Briefing · 2026
        </div>
      </div>
      
      <div className="w-7/12 p-8 pl-0 h-full">
        <div className="w-full h-full relative overflow-hidden bg-[#e8e4db]">
          <img 
            src="/__mockup/images/aforce-documentary-hero.png" 
            alt="Athlete pausing to hydrate"
            className="w-full h-full object-cover filter contrast-110 saturate-50 sepia-[.20] object-[center_30%]"
          />
        </div>
      </div>
      
    </div>
  );
}
