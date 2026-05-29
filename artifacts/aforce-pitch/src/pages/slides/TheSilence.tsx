import EditorialSlide from "@/components/EditorialSlide";

export default function TheSilence() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={3}
      eyebrow="The Truth"
      heroSrc={`${base}images/bg/03-silence.png`}
      heroObjectPosition="68% 42%"
      heroMaskFade
      accent
      heroOverlay={
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              // warm documentary grade: deepen the floor + corners so the lone
              // figure reads, and let the top breathe.
              "radial-gradient(120% 95% at 72% 58%, rgba(0,0,0,0) 38%, rgba(10,9,8,0.5) 100%), linear-gradient(to top, rgba(10,9,8,0.55) 0%, rgba(10,9,8,0) 42%), linear-gradient(to right, rgba(20,18,16,0.35) 0%, rgba(20,18,16,0) 26%)",
          }}
        />
      }
      headline={
        <>
          <div>Performance is</div>
          <div>not built</div>
          <div>in noise.</div>
          <div className="text-blue font-normal">It is built in silence.</div>
        </>
      }
      footer={
        <>
          <p>The silence before the moment.</p>
          <p>The pause before the play.</p>
          <p>The breath before the verdict.</p>
          <p>That is where readiness is built.</p>
        </>
      }
    />
  );
}
