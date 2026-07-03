import { useReveal } from "../hooks/useReveal";

export default function Philosophy() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="philosophy"
      className="border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div ref={ref} className="mx-auto max-w-3xl text-center">
        <p className="eyebrow reveal text-signal">The Philosophy</p>
        <blockquote
          className="reveal mt-10 font-display text-2xl leading-[1.35] tracking-[-0.01em] text-bone sm:text-3xl lg:text-4xl"
          style={{ transitionDelay: "80ms" }}
        >
          Performance is not the moment. It is everything before it — the
          preparation no one applauds.
        </blockquote>
        <p
          className="reveal mx-auto mt-8 max-w-xl text-base leading-relaxed text-bone/55"
          style={{ transitionDelay: "160ms" }}
        >
          AForce is built for that interval: the quiet, deliberate minutes before
          you are asked to be at your best. Composure is a discipline. We made it
          a ritual.
        </p>
      </div>
    </section>
  );
}
