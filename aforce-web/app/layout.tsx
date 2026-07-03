import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/Nav";

const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

const inter = Inter({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aforce.com"),
  title: {
    default: "AForce — Performance Is Non-Negotiable",
    template: "%s — AForce",
  },
  description:
    "AForce is premium alkaline performance hydration — pH 8.8, plant minerals, electrolytes. A new performance category for people who perform. Pause. Hydrate. Lock In. Perform.",
  keywords: [
    "AForce",
    "performance hydration",
    "alkaline",
    "pH 8.8",
    "electrolytes",
    "performance readiness",
  ],
  openGraph: {
    title: "AForce — Performance Is Non-Negotiable",
    description:
      "Premium alkaline performance hydration. A new category for people who perform.",
    type: "website",
    siteName: "AForce",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0D0D0D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} ${inter.variable}`}
    >
      <body>
        <a
          href="#hero"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-bone focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-canvas"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <Nav />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
