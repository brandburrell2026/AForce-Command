import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

import AmbientAudio from "@/components/AmbientAudio";
import PresentationHUD from "@/components/PresentationHUD";
import SectionInterstitial from "@/components/SectionInterstitial";
import SoundGate from "@/components/SoundGate";
import { isSectionFirstSlide, sectionFor } from "@/components/SlideChrome";
import { slides } from "@/slideLoader";

function getSlideIndex(pathname: string): number {
  const match = pathname.match(/^\/slide(\d+)$/);
  if (!match) return -1;
  const position = parseInt(match[1], 10);
  return slides.findIndex((s) => s.position === position);
}

function ambientTrackFor(position: number): string {
  const base = import.meta.env.BASE_URL;
  // 15-slide structure (Documentary Warm cut):
  // Act 1 — sparse tension (Tension):          slides 1-3
  // Act 2 — controlled momentum (Shift+Product): slides 4-7
  // Act 3 — premium propulsion (System+People+Proof): slides 8-13
  // Act 4 — warm resolution (Close):           slides 14-15
  if (position <= 3) return `${base}audio/act1-opening.mp3`;
  if (position <= 7) return `${base}audio/act2-momentum.mp3`;
  if (position <= 13) return `${base}audio/act3-propulsion.mp3`;
  return `${base}audio/act4-resolution.mp3`;
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    void el.requestFullscreen?.().catch(() => {});
  } else {
    void document.exitFullscreen?.().catch(() => {});
  }
}

function SlideEditor() {
  const [location, navigate] = useLocation();
  const currentIndex = getSlideIndex(location);
  const previousIndexRef = useRef<number>(-1);
  const [audioOn, setAudioOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const [interstitial, setInterstitial] = useState<{
    label: string;
    token: number;
  } | null>(null);

  const navigationDisabledRef = useRef(window.parent !== window.parent.parent);
  const touchHandledRefStable = useRef(false);

  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const direction = useMemo(() => {
    const prev = previousIndexRef.current;
    if (prev === -1 || currentIndex === -1) return 1;
    return currentIndex >= prev ? 1 : -1;
  }, [currentIndex]);

  useEffect(() => {
    if (currentIndex === -1) return undefined;
    const prev = previousIndexRef.current;
    if (
      prev !== -1 &&
      currentIndex !== prev &&
      currentSlide &&
      isSectionFirstSlide(currentSlide.position) &&
      currentSlide.position !== slides[0].position
    ) {
      const { name } = sectionFor(currentSlide.position);
      setInterstitial({ label: name, token: Date.now() });
      const t = window.setTimeout(() => setInterstitial(null), 1400);
      previousIndexRef.current = currentIndex;
      return () => window.clearTimeout(t);
    }
    previousIndexRef.current = currentIndex;
    return undefined;
  }, [currentIndex, currentSlide]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (currentIndex === -1) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
        return;
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        setAudioOn((v) => !v);
        return;
      }
      if (navigationDisabledRef.current) return;
      if (event.key === " ") {
        event.preventDefault();
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowUp") && currentIndex > 0) {
        navigate(`/slide${slides[currentIndex - 1].position}`);
      }
      if (
        (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") &&
        currentIndex < slides.length - 1
      ) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    const INTERACTIVE =
      "a,button,video,audio,input,select,textarea,details,summary,iframe,svg,canvas," +
      '[role="button"],[contenteditable="true"]';

    const isInteractive = (target: EventTarget | null) =>
      (target as HTMLElement | null)?.closest?.(INTERACTIVE);

    const touchHandledRef = touchHandledRefStable;

    const onClick = (event: MouseEvent) => {
      if (touchHandledRef.current) {
        touchHandledRef.current = false;
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (isInteractive(event.target)) return;

      if (navigationDisabledRef.current) {
        window.parent.postMessage({ type: "advanceSlide" }, "*");
        return;
      }

      if (currentIndex < slides.length - 1) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget: EventTarget | null = null;

    const onTouchStart = (event: TouchEvent) => {
      touchHandledRef.current = false;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchTarget = event.target;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) >= 10 || Math.abs(dy) >= 10) return;
      if (isInteractive(touchTarget)) return;
      touchHandledRef.current = true;

      if (navigationDisabledRef.current) {
        window.parent.postMessage({ type: "advanceSlide" }, "*");
        return;
      }

      const fraction = touchStartX / window.innerWidth;
      if (fraction < 0.4 && currentIndex > 0) {
        navigate(`/slide${slides[currentIndex - 1].position}`);
      } else if (fraction >= 0.4 && currentIndex < slides.length - 1) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);
    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [currentIndex, navigate]);

  return (
    <div className="select-none">
      <AnimatePresence mode="wait" initial={false}>
        {currentSlide && (
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, scale: 1.015, x: direction * 18 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.99, x: -direction * 12 }}
            transition={{
              opacity: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] },
              scale: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
              x: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] },
            }}
            style={{ willChange: "opacity, transform" }}
          >
            <currentSlide.Component />
          </motion.div>
        )}
      </AnimatePresence>

      <AmbientAudio enabled={audioOn} src={ambientTrackFor(currentSlide?.position ?? 1)} />
      <SoundGate onUnlock={() => setAudioOn(true)} />
      <SectionInterstitial
        label={interstitial?.label ?? null}
        token={interstitial?.token ?? 0}
      />
      <PresentationHUD
        audioOn={audioOn}
        onToggleAudio={() => setAudioOn((v) => !v)}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        currentIndex={Math.max(0, currentIndex)}
        total={slides.length}
      />
    </div>
  );
}

function AllSlides() {
  return (
    <div className="bg-bg">
      {slides.map((slide) => (
        <div
          key={slide.id}
          className="slide relative aspect-video overflow-hidden"
          style={{ width: "1920px", height: "1080px" }}
        >
          <div className="h-full w-full [&_.h-screen]:!h-full [&_.w-screen]:!w-full">
            <slide.Component />
          </div>
        </div>
      ))}
    </div>
  );
}

// This component is used for the deployed view at `/`
function SlideViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dims, setDims] = useState(() => ({
    width: Math.min(window.innerWidth, window.innerHeight * (16 / 9)),
    height: Math.min(window.innerHeight, window.innerWidth * (9 / 16)),
  }));

  useEffect(() => {
    const update = () => {
      setDims({
        width: Math.min(window.innerWidth, window.innerHeight * (16 / 9)),
        height: Math.min(window.innerHeight, window.innerWidth * (9 / 16)),
      });
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== " " && event.key !== "m" && event.key !== "M") return;
      if (event.key === " ") event.preventDefault();
      iframeRef.current?.contentWindow?.dispatchEvent(
        new KeyboardEvent("keydown", { key: event.key, code: event.code, bubbles: true }),
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const firstPosition = slides.length > 0 ? slides[0].position : 1;

  return (
    <div
      className="slide-viewer h-screen w-screen overflow-hidden bg-bg flex items-center justify-center"
      onClick={() => iframeRef.current?.focus()}
    >
      <iframe
        ref={iframeRef}
        src={`${base}/slide${firstPosition}`}
        style={{ width: dims.width, height: dims.height, border: "none" }}
        onLoad={() => iframeRef.current?.focus()}
        title="Slide viewer"
      />
    </div>
  );
}

export default function App() {
  const [location, navigate] = useLocation();

  // DO NOT edit this useEffect - redirects unknown routes to the first slide.
  // The "/" and "/allslides" routes are handled separately below.
  useEffect(() => {
    if (
      location !== "/" &&
      location !== "/allslides" &&
      getSlideIndex(location) === -1
    ) {
      if (slides.length > 0) {
        navigate(`/slide${slides[0].position}`, { replace: true });
      }
    }
  }, [location, navigate]);

  // DO NOT edit this useEffect - allows the parent frame to navigate
  // between slides via postMessage so it can avoid changing the iframe
  // src (which causes a white flash).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "navigateToSlide" &&
        typeof event.data.position === "number" &&
        slides.some((s) => s.position === event.data.position)
      ) {
        navigate(`/slide${event.data.position}`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  if (location === "/") return <SlideViewer />;
  if (location === "/allslides") return <AllSlides />;
  return <SlideEditor />;
}
