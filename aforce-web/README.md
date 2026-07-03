# AForce — Immersive Site (Next.js)

The elevated, editorial luxury experience for AForce. Cinematic hero, Apple-style
scroll, GSAP/Lenis motion, on the **canonical AForce Brand System v2.1.0**
(cinematic black `#0D0D0D` · Signal Red `#C1281B` · Bone `#F5F0E8`). Silver /
chrome is a surface treatment only — no off-brand colors.

> **Standalone by design.** Not part of the AForce-Command pnpm workspace. Its
> own `package.json` + `node_modules`, installed with `npm`, so the monorepo
> install is untouched. Run everything from inside `aforce-web/`.

## Run locally

```bash
cd aforce-web
npm install
npm run dev      # → http://localhost:3200
```

Production:

```bash
npm run build
npm start         # → http://localhost:3200
```

## Stack

- Next.js 15 (App Router, static prerender) · React 19 · TypeScript
- Tailwind CSS v4 · Framer Motion · GSAP · Lenis smooth scroll
- Fonts via `next/font`: Archivo Black (display) · IBM Plex Mono (labels) · Inter (body)
- Motion honors `prefers-reduced-motion` throughout

## Sections

Hero → Why AForce → The Science (pH 8.8 mineral orbit) → The Ritual →
Performance Stories → Products (floating chrome cans) → Membership / AForce OS →
Manifesto → Footer.

## Where the real assets go

| Asset | Drop location | Notes |
| --- | --- | --- |
| **Hero film** | `public/video/hero.mp4` (+ `hero-poster.jpg`) | Muted autoplay loop. Until it exists, a cinematic dark fallback shows. |
| **Editorial / story photography** | `components/sections/WhyAforce.tsx`, `Stories.tsx`, `Ritual.tsx` | Labeled gradient placeholders mark each full-bleed slot. |
| **Product renders** | `public/cans/` + `public/sticks/` (source) → `public/cans-cut/` + `public/sticks-cut/` (transparent) | Cutouts are generated from the white-bg renders; re-run the knockout if you swap the source. |

## Waitlist form

`components/sections/Membership.tsx` captures the email into component state and
shows a success state. **No backend is wired** — search `STUB` / `TODO(founder)`
and POST to your Founding 200 endpoint when ready.

## Brand note

Palette + type are locked to `../design/aforce-design-tokens.md` (v2.1.0). The
tokens live in `app/globals.css` under `@theme`. Do not substitute values.
