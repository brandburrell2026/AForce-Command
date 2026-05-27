import { useEffect, useState } from "react";

interface Props {
  audioOn: boolean;
  onToggleAudio: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  currentIndex: number;
  total: number;
}

export default function PresentationHUD({
  audioOn,
  onToggleAudio,
  onToggleFullscreen,
  isFullscreen,
  currentIndex,
  total,
}: Props) {
  const [visible, setVisible] = useState(true);
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  useEffect(() => {
    let timeout: number;
    const reveal = () => {
      setVisible(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setVisible(false), 2200);
    };
    reveal();
    const onMove = () => reveal();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
    };
  }, []);

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 h-[1px] z-[60] pointer-events-none"
        style={{ background: "rgba(45,42,38,0.08)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background:
              "linear-gradient(90deg, rgba(45,42,38,0) 0%, rgba(45,42,38,0.55) 100%)",
            transition: "width 700ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        />
      </div>

      <div
        className="fixed bottom-[2.5vh] right-[2.5vw] z-[60] flex items-center gap-[0.8vw]"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 600ms ease-out",
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleAudio();
          }}
          className="group relative w-[2.4vw] h-[2.4vw] min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center border border-[#2d2a26]/15 backdrop-blur-md hover:border-[#2d2a26]/40 transition-colors"
          style={{ background: "rgba(244,241,234,0.7)" }}
          title={audioOn ? "Mute ambient audio (M)" : "Play ambient audio (M)"}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-[1.1vw] h-[1.1vw] min-w-[16px] min-h-[16px]"
            fill="none"
            stroke={audioOn ? "rgba(45,42,38,0.85)" : "rgba(45,42,38,0.45)"}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {audioOn ? (
              <>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            ) : (
              <>
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </>
            )}
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFullscreen();
          }}
          className="w-[2.4vw] h-[2.4vw] min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center border border-[#2d2a26]/15 backdrop-blur-md hover:border-[#2d2a26]/40 transition-colors"
          style={{ background: "rgba(244,241,234,0.7)" }}
          title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-[1.1vw] h-[1.1vw] min-w-[16px] min-h-[16px]"
            fill="none"
            stroke="rgba(45,42,38,0.55)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isFullscreen ? (
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </>
            ) : (
              <>
                <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </>
  );
}
