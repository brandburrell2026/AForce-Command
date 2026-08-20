# training/edited — Edited content (before/after pairs)

The most information-dense training input: the AI/draft version **and** the version leadership actually shipped, side by side in one file.

Format per file:

```
ORIGINAL:
...
FINAL:
...
REASON (optional):
...
```

The Voice Training Engine diffs each pair and extracts the underlying rule. Also log the pair in `../../data/content_feedback.csv`.
