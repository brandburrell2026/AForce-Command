# AForce Concierge — engineering brief for counsel (privacy disclosure + urgent copy)

**Prepared:** 2026-10-05 · **For:** counsel (privacy policy update, D-02) and counsel + clinical reviewer (urgent-situation copy, D-04) · **Decision record:** `governance/decisions/DR-018-aforce-concierge-rulings.md` · **Status of the feature:** internal TestFlight testers only; production flag OFF.

This brief states what the software does. It proposes no policy wording; that is counsel's.

## 1. What AForce Concierge is

A text assistant inside the AForce OS app. A member types a question; the app sends it, together with a structured snapshot of the member's current app data, to the AForce server; the server sends both to OpenAI (the same processor already used for Smart Capture photos) and returns a structured, filtered answer. There is no voice input, no calendar, location, booking, order or payment access, and no background processing: nothing leaves the device unless the member sends a message or taps "Today's briefing".

## 2. Exactly what is sent to the processor, per turn

| Item | Example | Source | Stored by AForce? |
|---|---|---|---|
| The member's typed message (≤ 600 chars) | "I slept poorly. Help me adjust today." | member | Yes — `aforce_concierge_messages` |
| Up to 12 prior turns of the same conversation | — | member + prior answers | Yes (same table) |
| HydroState score, band, urgency, confidence | 72, BALANCED, moderate | app engine (derived) | No (transient) |
| Today's command text and explanation | "Drink 16 oz water now. Recheck in 20 min." | app engine (derived) | No |
| Logged intake today and target | 40 oz of 96 oz, 3 of 8 units, last log 145 min ago | member logging (server copy preferred) | Already stored elsewhere |
| Wearable signals present in the app, each labelled measured/estimated with freshness and observation time | sleep 6.5 h (WHOOP, aging), HRV 48 ms (stale) | connected provider snapshots already held by the app | Already stored elsewhere |
| Provider connection status and last sync time | whoop connected, synced 08:00 | app | Already stored elsewhere |
| Up to 7 daily journal summaries (average score, log count) | 2026-10-04: 78, 6 logs | journal | Already stored elsewhere |
| Stored weather reading (temperature, humidity, city) when fresh | 31 °C, 60 %, Miami | server's OpenWeather reading | Already stored elsewhere |
| Facts the member typed about travel/schedule this session | "Flight 6 am ET, land 9 am MT" | member | No (session only) |
| Remembered preferences, only if the member consented | goal, routine, tone, notes | member | Yes — `aforce_concierge_preferences` |
| Local time, time zone, app language, whether the profile is a demo | — | device | No |

Not sent: name, email, Clerk identity, payment data, raw photos, raw provider exports, contacts, location coordinates.

## 3. Processor and retention

- Processor: OpenAI API, `api.openai.com`, model `gpt-5.4`, invoked server-side from Railway with a server-held key. The mobile app never holds the key.
- OpenAI's API data-usage terms apply to the request (counsel to confirm the organization's zero-data-retention / no-training settings as part of the policy update).
- AForce stores conversation transcripts and consented preferences in the production Postgres database (Neon), keyed by the member's Clerk user id. Members can delete any conversation, all conversations, any preference, or all preferences from the app; account deletion removes all of it in the same transaction as other personal data.

## 4. What the member sees

- A permanent line on the chat screen: "AForce Concierge is AI. Performance and wellness information, not medical advice."
- Every answer can be expanded ("Why this?") to show which data it used, each labelled measured / logged / estimated / sample data with its freshness.
- Preferences are saved only after an explicit tap; the optional setup's "save to my account" switch defaults to OFF.

## 5. Safety filters applied before any answer is shown

Every generated reply is rejected (never edited) if it contains: any term on the Claims Register block list (diagnosis, treat, cure, disease, symptom, risk, injury, …); population comparisons; any quantity (oz, ml, minutes, %, mg) that does not already appear in the member's own message or data; an action the app did not offer; a cited data source that was not supplied. A rejected reply is regenerated once; if it fails again the member sees "Couldn't give a safe answer" and nothing else.

## 6. Urgent-situation handling (for counsel + clinical review, D-04)

When a member's message matches any of the trigger patterns below, the model is **not** called. The member sees this fixed text:

> This sounds like it may need urgent attention, and that comes before anything about hydration or training. If you or someone with you is in danger, contact local emergency services or a clinician right now. AForce OS does not monitor for or detect emergencies, so please do not wait on the app.
>
> Next step: Reach a clinician or local emergency services now.

Trigger patterns (case-insensitive; `api-server/src/lib/concierge/urgent.ts`): chest pain / pressure / tightness; can't breathe, trouble breathing, shortness of breath; passed out / fainting / blacked out; unconscious / unresponsive; seizure; stroke / heart attack / cardiac; severe or crushing pain or headache; confusion, disorientation, slurring; vomiting blood or vomiting that will not stop; blood in urine, stool or vomit; no urination for many hours or a day; heat stroke, overheating, body temperature 103 °F or more; allergic reaction, anaphylaxis, throat closing or swelling; suicidal statements; overdose or poisoning; the words emergency, 911, ambulance.

Questions for the reviewers: (a) is the wording acceptable as-is; (b) should the trigger list be widened or narrowed; (c) should the response also present a tappable emergency-services affordance (none exists today; the app shows text only).

## 7. Where the controls live in code (for verification)

- Gates: `artifacts/api-server/src/lib/concierge/gates.ts`, `lib/claimsGate.ts`
- Urgent boundary: `artifacts/api-server/src/lib/concierge/urgent.ts`
- Prompt rules sent to the model: `artifacts/api-server/src/lib/concierge/prompt.ts`
- Storage and deletion: `lib/db/src/conciergeRepo.ts`, `lib/db/src/accountDeletionCascade.ts`
- Data-class rows: `governance/DATA-CLASSIFICATION-MATRIX.md` §2 (Privacy review pending)
