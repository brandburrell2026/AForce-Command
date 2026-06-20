import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-primary/30 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md text-center">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} 
            alt="AForce Logo" 
            className="w-16 h-16 mx-auto mb-6"
          />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            AForce Command Center
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            The unvarnished truth. Founder-only cockpit for tracking activations, retention, and readiness.
          </p>
        </div>

        <Link 
          href="/sign-in" 
          className="inline-flex items-center justify-center px-8 py-3 text-sm font-semibold tracking-widest uppercase text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-[0_0_20px_rgba(255,59,48,0.3)] hover:shadow-[0_0_30px_rgba(255,59,48,0.5)]"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
