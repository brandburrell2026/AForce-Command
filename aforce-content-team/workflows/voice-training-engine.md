# VOICE TRAINING ENGINE

Turns real source material and leadership feedback into learned voice rules. The Brand Brain says who AForce is; this engine learns **how AForce actually sounds** from evidence — and never fabricates a rule.

**Inputs:** `training/` (source material) + `data/content_feedback.csv` (approve/edit/reject history).
**Output:** `learning/voice_lessons.md` — rules with evidence, confidence, counts, dates.
**Consumers:** Agents 02, 05, 06, 08 (and through them, everything).

## Part 1 — Mining source material (`training/`)

When leadership drops material in (or on `/analyze-voice` request), analyze per folder:

| Folder | What to extract |
|---|---|
| `approved/` | The strongest signal: patterns leadership shipped |
| `edited/` | Before/after diffs — the most information-dense input |
| `rejected/` | Anti-patterns, with reasons where given |
| `website/`, `packaging/`, `decks/`, `product/` | Canonical register per surface |
| `founder/` | Brandon/Julius natural speech — vocabulary, rhythm, stories |
| `customer-language/` | How real people phrase the problem/product (hook fuel; audience diction) |
| `competitors/` | What to structurally learn and verbally avoid |
| `scientific/` | Substantiation → candidate claims (route to CLAIMS process, not voice lessons) |

**Analysis dimensions:** sentence length & rhythm · vocabulary (frequent words / avoided words) · tone & energy · confidence markers · emotional intensity · storytelling patterns · opening styles · CTA styles · product language · founder language · educational language · phrases that feel premium vs. generic · messaging patterns · brand beliefs.

**The rule about rules:** do NOT memorize wording — infer the underlying rule. The lesson from "We don't chase performance. We prepare for it." is not that sentence; it's *the two-beat reversal* as a construction.

## Part 2 — Learning from feedback (`content_feedback.csv`)

**EDITED content** — the diff protocol:
1. Align AI version vs. leadership version.
2. Name each change type: vocabulary swap / cut length / claim removed / energy shift / structure change / CTA change.
3. Extract the underlying lesson (the rule that, applied beforehand, would have produced the leadership version).
4. Search history for the same lesson; increment its example count or log a new LOW-confidence lesson.

Worked example (format):
```
AI: "Hydration that helps you unlock your full potential."
LEADERSHIP: "Hydration built for performance."
CHANGES: removed cliché ("unlock…potential"); abstract→concrete; 8→4 words
LESSON: AForce prefers concise performance language over abstract self-improvement language.
```

**REJECTED content:** log reason category (too generic / too salesy / too corporate / too soft / too long / doesn't sound like AForce / weak hook / bad product integration / unsupported claim / boring / too similar to competitor / wrong audience) + what the piece did that triggered it.

## Part 3 — The lesson record (every lesson, no exceptions)

```
LESSON V-0xx [category: LEADERSHIP PREFERENCE | BRAND FACT]
SOURCE OBSERVATION: … (what was seen, where)
RULE: … (the transferable instruction)
EVIDENCE: … (files/rows cited)
CONFIDENCE: LOW (1–2 examples) / MEDIUM (3–4 consistent) / HIGH (5+ consistent, or explicit leadership instruction)
SUPPORTING EXAMPLES: n
DATE LEARNED: … · LAST REINFORCED: …
```

## Confidence discipline

- **One example never makes a permanent rule** — unless leadership explicitly instructs it ("make this a rule" → HIGH, category LEADERSHIP PREFERENCE).
- LOW-confidence lessons are *suggestions* to writers; MEDIUM are defaults; HIGH are enforced by the Guardian like Brand Brain rules.
- Contradicting evidence lowers confidence and is recorded — leadership taste can change, and the file must follow reality.
- Periodic consolidation: overlapping lessons merge; the merged record keeps all evidence.

## Prohibitions

No rule without a cited source. No confidence inflation. No copying competitor phrasing into lessons as "good examples." No treating one loud edit as doctrine.
