type Props = {
  label: string;
  body: string;
};

export default function Disclosure({ label, body }: Props) {
  return (
    <div className="absolute left-[8vw] right-[8vw] bottom-[10vh] pointer-events-none">
      <div className="border-t border-text/10 pt-[1.4vh]">
        <div className="font-body text-[0.62vw] leading-[1.55] text-text/35 tracking-wide">
          <span className="uppercase tracking-[0.32em] text-text/55 font-semibold mr-[0.6vw]">
            {label}
          </span>
          {body}
        </div>
      </div>
    </div>
  );
}
