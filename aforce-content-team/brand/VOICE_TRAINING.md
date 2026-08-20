# AFORCE VOICE TRAINING

**Version:** 1.0 · 2026-08-19
**Purpose:** teach the system the AForce voice from real examples — not by memorizing sentences, but by inferring the stylistic rule behind them. Raw source material lives in `training/`; the extraction process is `workflows/voice-training-engine.md`; learned rules accumulate in `learning/voice_lessons.md` with evidence, confidence, and dates.

---

## 1. GOOD AFORCE CONTENT — canonical examples (real, from live brand surfaces)

Each example names the rule it teaches. These are BRAND FACTS: they shipped on canonical surfaces.

**"We don't chase performance. We prepare for it."** *(manifesto)*
→ Rule: the two-beat reversal — reject the expected frame, assert the AForce frame. Short. No hedge.

**"The moment does not make you ready. It reveals whether you prepared."** *(manifesto)*
→ Rule: reframe familiar ideas (pressure, game day) around preparation. AForce's angle on any topic is *the before*.

**"Everyone performs. Not everyone prepares."** *(homepage)*
→ Rule: inclusion first, standard second. The reader is invited in, then challenged.

**"The world is loud. Readiness is quiet."** *(manifesto)*
→ Rule: contrast against culture's volume. AForce never shouts; that restraint *is* the differentiation.

**"Hydration is not a claim. It is a process."** *(science page)*
→ Rule: honesty as authority. When discussing the product, under-claim and over-explain.

**"Nothing added without a reason. Nothing claimed without a lane."** *(science page)*
→ Rule: parallel construction; discipline as a brand feature, not a legal burden.

**"Drop one into any water — the ritual travels with you."** *(shop, sticks)*
→ Rule: product copy = concrete action + meaning. What you do, then what it means. No adjectives doing fake work.

**"Precision includes the fine print. Stated Plainly."** *(shop)*
→ Rule: transparency is on-brand. Fine print is delivered with pride, not buried.

**"04:58 AM — Before the World Wakes."** *(our story)*
→ Rule: specificity is the premium cue. 4:58, not "early morning." pH 8.8, not "alkaline formula." 250, not "a select few."

## 2. NOT AFORCE CONTENT — contrast examples

These are **synthetic negative examples written for training contrast** — they never shipped. Each shows a common failure.

❌ "Stay hydrated and unlock your potential! 💧🔥 Grab yours today!!"
→ Fails: cliché ("unlock"), emoji cluster, exclamation enthusiasm, sale-first.

❌ "In today's fast-paced world, hydration is more important than ever. Whether you're an athlete or a busy professional, AForce has you covered."
→ Fails: three AI patterns in two sentences; says nothing specific; no point of view.

❌ "Our revolutionary, game-changing formula boosts your immunity and detoxifies your body!"
→ Fails: banned claims (immunity, detox), banned words (revolutionary, game-changing), zero evidence lane.

❌ "It's not just hydration — it's a lifestyle. Elevate your wellness journey with AForce."
→ Fails: "it's not just X, it's Y" pattern, generic wellness language, no meaning.

❌ "GUYS. You NEED this. Running to buy more before they sell out 😭😭"
→ Fails: manufactured hype and fake scarcity. AForce doesn't beg; it earns.

**The corrected instinct, in one pair:**
Instead of: *"Stay hydrated and unlock your potential!"*
Prefer: *"Performance starts before the workout."*
The lesson is not the sentence — it's the rule: **AForce trades motivational abstraction for a concrete claim about the before.**

## 3. How leadership trains the system

For every significant piece of AI-drafted content, leadership marks one of three statuses (in `dashboard/APPROVALS.md`, the calendar, or directly in `data/content_feedback.csv`):

- **APPROVED** — shipped as written. The piece may be copied into `training/approved/`. Repeated approval of a pattern raises that pattern's confidence in `learning/voice_lessons.md`.
- **EDITED** — leadership changed it. Record both versions in `data/content_feedback.csv`. The Voice Training Engine diffs them, names what changed (vocabulary? length? claim? energy?), and drafts the underlying lesson.
- **REJECTED** — capture the reason, using the categories: too generic · too salesy · too corporate · too soft · too long · doesn't sound like AForce · weak hook · bad product integration · unsupported claim · boring · too similar to competitor · wrong audience.

**Confidence discipline:** one example = an observation, logged at LOW confidence. A rule becomes standing guidance only after **3+ consistent examples** or an explicit leadership instruction ("make this a rule"). Lessons carry: evidence, rule, confidence, supporting-example count, date. See `learning/voice_lessons.md` for the format.

## 4. Where source material goes

Leadership drops real material into `training/` (see its README): approved and rejected content, founder interviews, decks, packaging and website copy, customer comments and reviews, competitor content, scientific substantiation. The Voice Training Engine mines it on request (`workflows/voice-training-engine.md`) — extracting patterns, never copying sentences wholesale into new content (canonical lines in `MESSAGING.md` §2 are the exception: they may be used verbatim).
