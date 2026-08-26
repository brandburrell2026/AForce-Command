# SOCIAL ANALYTICS INTEGRATION — ARCHITECTURE

**Status: SPECIFICATION ONLY. No platform is connected yet.** This document defines how analytics data will flow when integrations exist — and how the system behaves honestly until then. Nothing in the content OS may pretend a connection exists: pre-integration, data arrives only by manual export/upload, and absent metrics stay absent.

## Target platforms

Instagram (Reels/Stories/posts) · TikTok · YouTube (Shorts + long) · LinkedIn · X.
Candidate paths per platform, in preference order: official APIs (IG Graph, TikTok Business/Display, YouTube Data+Analytics, LinkedIn Community Mgmt, X API) → scheduled connector tools (e.g., Metricool is already connected at the Claude level and can serve as the first live source for scheduling + analytics) → manual CSV/screenshot exports (works today).

## The normalized model — `data/social_performance.csv`

All platform data, whatever its source, normalizes into one row per (content_id × platform × snapshot):

```
content_id,platform,post_id,publish_date,content_type,pillar,campaign,hook_type,video_length,
views,reach,impressions,likes,comments,shares,saves,watch_time,average_watch_time,
completion_rate,followers_generated,profile_visits,link_clicks,conversions,revenue
```

Conventions:
- `content_id` joins to `content_database.csv` — the join is what makes analysis possible; posts without ids get retro-tagged before analysis.
- Metrics are platform-reported numbers only. **A metric the platform doesn't provide is left empty** (e.g., X provides no saves; LinkedIn no completion rate). Empty ≠ zero: `0` means "measured zero."
- `video_length` in seconds; `completion_rate` and `average_watch_time` as the platform defines them, with the definition noted in `integrations/` docs per platform when connected.
- Snapshots: append rows at 48h and 30d (convention) rather than overwriting — velocity needs time-series.
- `revenue`/`conversions` only when real attribution exists (Shopify UTM/affiliate); otherwise empty.

## Per-platform field availability (expected, verify at connection time)

| Field | IG | TikTok | YT | LinkedIn | X |
|---|---|---|---|---|---|
| views/plays | ✓ | ✓ | ✓ | ✓ impressions | ✓ |
| reach | ✓ | ✓ | — | — | — |
| completion/retention | ✓ | ✓ | ✓ | — | — |
| saves | ✓ | ✓ | — | — | bookmarks |
| shares | ✓ | ✓ | ✓ | ✓ reposts | ✓ reposts |
| profile visits | ✓ | ✓ | — | ✓ | ✓ |
| link clicks | limited | limited | ✓ | ✓ | ✓ |

## Ingestion paths

1. **Manual (available now):** leadership exports platform analytics (CSV or screenshots) → drop into a session or `reports/raw/` → Agent 15 normalizes into `social_performance.csv`, recording source + export date in a `# provenance` note in the commit.
2. **Metricool (first live path):** pull per-post metrics via the connected Metricool tools; map Metricool fields → the normalized schema; note Metricool as source.
3. **Native APIs (future):** per-platform connectors writing the same schema. Each connector gets its own doc in this folder when actually built, including auth model, rate limits, and field mappings.

## Honesty rules (bind Agent 15 and everyone downstream)

1. Never fabricate or interpolate a missing metric; report coverage explicitly ("TikTok: views/likes/comments only — no retention export provided").
2. Partial data is analyzable data — baselines and winners compute from whatever exists, with the gaps named.
3. Source + date accompany every ingest; unverifiable numbers (screenshots without account context) are marked low-trust.
4. No connection is claimed until a real pull has succeeded and its mapping doc exists in this folder.
