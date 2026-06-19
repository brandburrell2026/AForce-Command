---
name: AForce branded PDF export tooling
description: How to generate branded PDFs (spec sheets, reports) in this repo's environment.
---

# Generating branded PDFs in this repo

When asked to produce a PDF deliverable (spec sheet, report) from markdown/HTML content:

- **Use `wkhtmltopdf`** (installed system-wide, WebKit). It is the reliable HTML→PDF path here.
- **`weasyprint` is NOT viable**: pip install is blocked by PEP 668 (externally-managed env) and it also needs native pango/cairo libs. Don't burn time on it.
- Python `markdown` (with extensions `tables, fenced_code, sane_lists, attr_list`) converts the MD body; wrap it in a hand-built branded HTML shell.
- **Embed Inter** for on-brand type via `@font-face { src: url('file://<abs path>...ttf') }` and pass `--enable-local-file-access`. Inter TTFs live in `node_modules/.pnpm/@expo-google-fonts+inter@*/node_modules/@expo-google-fonts/inter/<WeightFolder>/Inter_<WeightFolder>.ttf`. Without it the only good system sans is DejaVu Sans.

**Why:** weasyprint repeatedly fails to install/load here; wkhtmltopdf + file:// fonts is the only combo that produced a clean branded result.

**How to apply / wkhtmltopdf gotchas:**
- It needs real page margins (`--margin-*`) for correct per-page top/bottom spacing — full-bleed dark across continuation pages is impractical (content touches edges with zero margins). So: striking dark **cover** as its own page, light/clean **body** for the rest.
- Backgrounds print by default (`--background`); don't pass `--no-background` or `--print-media-type` (the latter can drop them).
- Page numbers: `--footer-html` with a tiny HTML+JS file reading the injected query vars (`page`,`topage`); hide it on the cover by checking `page=='1'`.
- Brand: pure black cover, red `#FF3B30` accents/rules, lime `#B6FF00` used sparsely (e.g. ritual arrows), black table-header rows with zebra body.
