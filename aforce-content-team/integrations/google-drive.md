# GOOGLE DRIVE / ASSET LIBRARY — ARCHITECTURE

**Status: SPECIFICATION ONLY. No Drive is connected yet.** This defines the future content library structure and how the repo references it. Until a Drive (or Dropbox — a Dropbox connector already exists at the Claude level and can serve the same architecture) is provisioned, `asset_url` fields simply stay empty.

## The library structure (create when provisioning)

```
AForce Content Library/
├── 00-BRAND-ASSETS/          logos, N–N monogram files, fonts, color refs, templates
├── 01-PRODUCT-PHOTOGRAPHY/   sticks, cans, variety pack — by SKU/flavor/rev
├── 02-RAW-VIDEO/             by shoot date + location (matches filming-list batches)
├── 03-EDITED-CONTENT/        by content_id — work-in-progress cuts
├── 04-FINAL-APPROVED/        by content_id — the exact files that go live (immutable)
├── 05-UGC/                   by creator handle / campaign; raw deliverables + rights notes
├── 06-CAMPAIGNS/             by campaign slug (mirrors campaigns/ in repo)
├── 07-FOUNDER/               founder shoots, 4:58 batches, podcast video
├── 08-PODCAST/               episodes, clips, quote-card exports
├── 09-PACKAGING/             packaging photography + dielines by revision
└── 10-REFERENCE/             mood boards, competitor captures, visual references
```

## Conventions

- **File naming:** `contentid_platform_version` (e.g., `SF-007_tiktok_v2.mp4`); raw clips `YYYYMMDD_location_shot##`.
- **`asset_url`:** every content_database/calendar row carries the share URL of its FINAL-APPROVED file once it exists. Editing links point to 03; the database points to 04.
- **Rights & retention:** UGC folders include the usage-rights note per creator; nothing from 05 ships without rights confirmed (Agent 19 tracks).
- **The repo stores text and data; the Drive stores media.** No video/image binaries are committed to git.

## Interim behavior (today)

- `asset_url` empty until the library exists.
- Local/session media handling uses the repo's `content/production/` for notes only (shot logs, edit notes), never media files.
- When leadership provisions the Drive: create the tree above, add the root URL here, and backfill `asset_url` for anything already produced.
