---
name: AForce wordmark in the pitch deck
description: The pitch deck chrome renders the brand via the official AFORCE logo artwork (image), not as a typeset string.
---

The pitch deck displays the brand using the **official AFORCE wordmark artwork** — the custom geometric all-caps cut with a ™, supplied by the user as an Adobe Illustrator file.

**Why:** The user provided their real logo and asked the deck mark to match that exact style. A typeface cannot reproduce the custom letterforms, so the mark is rendered from artwork.

**How to apply:**
- Use the shared `Wordmark` component (`src/components/Wordmark.tsx`) for any chrome/masthead that shows the brand mark — do not typeset `AForce`/`AFORCE` as text for the logo.
- `Wordmark` renders a transparent PNG in the brand red (`#e41e2b`); a black variant also exists alongside it. Size via a Tailwind height class (e.g. `h-[1.5vw]` chrome, `h-[2.2vw]` masthead); width auto-scales.
- The source artwork is a PDF-compatible `.ai`; render with `pdftoppm`/`magick` and key out white to alpha to regenerate the PNGs.
- Body copy and uppercased UI labels (e.g. `AFORCE PROTOCOL`) remain plain text — only the logo mark uses the image.
