type VideoBackdropProps = {
  src: string;
  opacity?: number;
  overlay?: string;
};

export default function VideoBackdrop({
  src,
  opacity = 0.55,
  overlay = "linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.55) 100%)",
}: VideoBackdropProps) {
  const base = import.meta.env.BASE_URL;
  const url = src.startsWith("http") ? src : `${base}${src.replace(/^\//, "")}`;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity }}
      />
      <div className="absolute inset-0" style={{ background: overlay }} />
    </div>
  );
}
