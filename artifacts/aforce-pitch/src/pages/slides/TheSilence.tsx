import EditorialSlide from "@/components/EditorialSlide";

export default function TheSilence() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={3}
      eyebrow="The Truth"
      heroSrc={`${base}images/bg/03-silence.png`}
      heroObjectPosition="68% 42%"
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
