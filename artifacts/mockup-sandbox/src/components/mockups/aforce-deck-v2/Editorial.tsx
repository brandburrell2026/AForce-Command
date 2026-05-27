import React from 'react';

export function Editorial() {
  return (
    <div className="w-full h-[900px] bg-[#F4F1EA] text-[#1C1C1C] flex flex-col justify-between p-24 relative overflow-hidden">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" />
      <style dangerouslySetInnerHTML={{__html: `
        .font-editorial {
          font-family: 'Cormorant Garamond', serif;
        }
      `}} />
      
      {/* Top area */}
      <div className="flex justify-between items-start font-editorial">
        <div className="text-2xl tracking-[0.25em] uppercase font-medium">AForce</div>
        <div className="text-sm tracking-widest uppercase text-[#4A4A4A] mt-2">Investor Briefing · 2026</div>
      </div>

      {/* Middle area */}
      <div className="flex-1 flex flex-col justify-center mt-12 font-editorial">
        <h1 className="text-[6.5rem] leading-[1.05] font-light tracking-tight">
          Pause.<br />
          Hydrate.<br />
          Lock In.<br />
          <span className="italic text-[#000000]">Perform.</span>
        </h1>
      </div>

      {/* Bottom area */}
      <div className="font-editorial mb-8">
        <p className="text-2xl leading-relaxed text-[#2A2A2A] font-light border-l-[1.5px] border-[#1C1C1C] pl-8 max-w-lg">
          A real-time human performance operating system.
        </p>
      </div>
    </div>
  );
}
