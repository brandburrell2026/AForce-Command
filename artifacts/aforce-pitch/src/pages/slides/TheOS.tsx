import SlideChrome from "@/components/SlideChrome";
import { Hydration } from "@/components/os-screens/Hydration";
import { Streak } from "@/components/os-screens/Streak";
import { CheckIn } from "@/components/os-screens/CheckIn";
import { Reinforce } from "@/components/os-screens/Reinforce";
import { Readiness } from "@/components/os-screens/Readiness";
import { Subscribe } from "@/components/os-screens/Subscribe";
import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

const PHONE_W = 390;
const PHONE_H = 844;

type ScreenSpec = {
  label: string;
  caption: string;
  Component: ComponentType;
};

const SCREENS: ScreenSpec[] = [
  { label: "Hydration", caption: "Real-time hydration score", Component: Hydration },
  { label: "Streak", caption: "Ritual continuity, measured", Component: Streak },
  { label: "Check-in", caption: "Pause. Hydrate. Lock in. Perform.", Component: CheckIn },
  { label: "Reinforcement", caption: "Behavioral nudges, contextual", Component: Reinforce },
  { label: "Readiness", caption: "Daily verdict", Component: Readiness },
  { label: "Protocol", caption: "Commit to your standard", Component: Subscribe },
];

function PhoneFrame({ index, label, caption, children }: { index: number; label: string; caption: string; children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.36);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PHONE_W);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="font-body uppercase tracking-[0.3em] text-[0.55vw] text-text/35 mb-[1vh] tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div
        ref={frameRef}
        className="relative rounded-[1.2vw] border border-white/[0.08] overflow-hidden"
        style={{
          width: "11vw",
          aspectRatio: `${PHONE_W} / ${PHONE_H}`,
          boxShadow: "0 0 40px rgba(255,255,255,0.02)",
        }}
      >
        <div
          aria-hidden="true"
          inert
          className="pointer-events-none select-none"
          style={{
            width: `${PHONE_W}px`,
            height: `${PHONE_H}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
      <div className="mt-[1.5vh] font-body text-[0.85vw] text-text/85 font-light">{label}</div>
      <div className="font-body text-[0.7vw] text-text/40 mt-[0.4vh]">{caption}</div>
    </div>
  );
}

export default function TheOS() {
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-0 flex flex-col px-[6vw] py-[6vh]">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2vh]">
              The OS
            </div>
            <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter">
              <span className="text-text">Human first.</span>
              <span className="text-text/45"> System second.</span>
            </h2>
            <div className="mt-[2vh] font-body text-[1vw] text-text/55 max-w-[55vw] leading-[1.5]">
              The OS proves the promise. <span className="text-text/85">It does not become the story.</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/35">
              Six surfaces · One ritual
            </div>
            <div className="font-body text-[0.7vw] text-text/30 mt-[0.6vh] italic">Dark-mode only. Designed to disappear.</div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center mt-[3vh]">
          <div className="grid grid-cols-6 gap-[1.6vw]">
            {SCREENS.map((s, i) => (
              <PhoneFrame key={s.label} index={i} label={s.label} caption={s.caption}>
                <s.Component />
              </PhoneFrame>
            ))}
          </div>
        </div>

        <div className="mt-[3vh] flex items-center justify-between border-t border-text/[0.08] pt-[2vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[0.6vw] text-text/35">
            Hydration · Streak · Check-in · Reinforcement · Readiness · Protocol
          </div>
          <div className="font-body text-[0.7vw] text-text/45">
            The OS quietly reinforces ritual, accountability, and retention.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
