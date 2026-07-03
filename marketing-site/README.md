# AForce — Marketing Site

Luxury single-page marketing site for AForce. One job: capture emails into the
**Founding 200** waitlist.

> **Standalone by design.** This folder is *not* part of the AForce-Command pnpm
> workspace. It has its own `package.json` and `node_modules`, installed with
> `npm`, so the fragile monorepo install is never touched. Run every command
> below from inside `marketing-site/`.

## Run locally

```bash
cd marketing-site
npm install
npm run dev        # → http://localhost:4321
```

Build / preview production output:

```bash
npm run build
npm run preview
```

## Stack

- Vite + React 19 + Tailwind CSS v4
- No animation library — scroll reveals are a ~40-line IntersectionObserver hook
  (`src/hooks/useReveal.ts`), and honor `prefers-reduced-motion`
- Fonts (Google Fonts): Archivo Black (display), IBM Plex Mono (labels), Inter (body)

## Brand system

Locked to `../design/aforce-design-tokens.md` (v2.1.0). Tokens live in
`src/index.css` under `@theme`. Do not substitute values.

| Role | Value |
| --- | --- |
| Canvas | `#0D0D0D` |
| Bone (text) | `#F5F0E8` |
| Signal Red (sparingly) | `#C1281B` |
| Soursop / Watermelon / Berry (flavor coding) | `#1FA35A` / `#C1281B` / `#1E5BFF` |

## Where the real assets go

- **Can photography:** replace the PNGs in `public/cans/` (`soursop.png`,
  `watermelon.png`, `berry.png`). They currently hold the icon-row silver can
  renders (11 fl oz), shown on white product plates. Alt text lives in
  `src/data/flavors.ts`.
- **Stick photography:** replace the PNGs in `public/sticks/` (`soursop.png`,
  `watermelon.png`, `berry.png`) — single-serve silver stick packs (0.28 oz / 8 g),
  shown on white plates in the "Also in sticks" section.
- **Hero editorial shot:** the hero is type-led; drop a background/foreground
  image into `src/components/Hero.tsx` where marked if desired.

## Waitlist form

`src/components/Founding200.tsx` captures the email to component state and shows
a success state. **No backend is wired.** Search for `STUB` /
`TODO(founder)` and POST the email to your waitlist endpoint when ready.
