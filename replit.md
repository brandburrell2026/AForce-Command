# Overview

AForce OS is a production-ready React Native / Expo mobile application complemented by an Express 5 and PostgreSQL API server. It functions as a real-time human performance operating system, specializing in hydration intelligence and AI-driven decision-making. The project aims to deliver personalized insights and foster community engagement for enhancing athletic performance and overall wellness. Key capabilities include hydration tracking and AI coaching, social and competitive features ("Circles" and "Territory"), and integrated e-commerce with Stripe for purchases and subscriptions. The architecture is designed for scalability to support a large user base (50M+).

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces with `tsc --noEmit` and `tsc --build`.
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod.
- **Mobile:** React Native / Expo SDK 54 with Expo Router 6, React Native Reanimated 3, `i18next`, `@tanstack/react-query`.
- **State Management (mobile):** React Context + `useReducer` organized as a slice-based store (`store/slices.tsx`).
- **API Tools:** Orval for OpenAPI codegen, generating React Query hooks in `@workspace/api-client-react`.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette includes lime, teal, amber, red, Clutch teal, and Guardian purple.
- **Design Language:** "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND," with a "Phantom-card" aesthetic.
- **Visuals:** Stylized maps for "Territory" and smooth animations with Reanimated.
- **Home Screen Layout:** Composable section components under `components/home/*`.

## Authentication & Identity (Clerk)
- **Provider:** Clerk via `@clerk/expo` for mobile and `@clerk/express` for server-side.
- **Sign-in:** Custom email+password flow and Google SSO via `useSSO()`.
- **Token Bridge:** `components/ClerkAuthBridge.tsx` integrates Clerk's `getToken` with `services/authToken.ts` and the OpenAPI client.
- **Auth-gated routes:** Mobile routes are gated by `app/(tabs)/_layout.tsx`; server-side routes require `@clerk/express` middleware.

## Subscription & Entitlement (Stripe)
- **Source of Truth:** Stripe and `stripe-replit-sync` mirror webhook events into PostgreSQL.
- **Client Hook:** `hooks/useEntitlement.ts` pulls plan tier for paywall gating.
- **Server Hardening:** Pricing, shipping, and tax are computed server-side; webhook events use signature verification.

## Server Hardening (`artifacts/api-server`)
- **Routing:** Express 5 with Zod input/output validation from OpenAPI spec.
- **Concurrency:** `SELECT ... FOR UPDATE` for serializing concurrent posts per user.
- **Rate Limiting & Cache:** OpenWeather is proxied with an in-memory TTL cache; public and auth-gated endpoints have rate limits.
- **Logging:** Route handlers use `req.log`; non-request code uses a singleton logger.
- **Real-time:** REST mutations are broadcast over a shared HTTP/WebSocket server.

## Technical Implementations & Feature Specifications
- **Persistence & Real-Time Backend:** PostgreSQL via Drizzle; REST API broadcasts mutations to WebSocket clients.
- **Per-Event Hydration Scoring:** Defines point values, absorption caps, and release curves.
- **AForce Protocol Screen:** Synchronous derivation of protocol stage based on user state and engine output.
- **Water Cycle / "Become AForce":** Modals for water and hydration stick intake, with flavor inference.
- **Social Mode → Hydration Score:** Alcohol intake impacts hydration scores and decay rate.
- **Multi-Provider Health Signals:** Integrates various health platforms (Apple Health, Oura, etc.) with "freshest-wins" logic.
- **Hydration Depletion Math:** Pure, dependency-free helper modeling score-points-per-minute decay based on physiological standards.
- **Mobile Application (`artifacts/aforce-os`):** Includes HydroScan, Circles, Territory, Ring (Calm Coach + Sport Mode), Voice Engine, Voice Commands, Heat Guard Escalation, Subscription System, Product Comparison, Core Loop, Social Mode, Hydration Journal, Sweat Calculator, Phantom Band integration, Sensor Import, and Achievements.
- **HydroScan AI Coach Voice:** After every Hydration Scan the AI Coach speaks a verdict-aware comparison between the scanned product and its best AForce equivalent. Pure builder `services/scanCoachVoice.ts` derives a 4-case narrative (A: scanned IS AForce + optimal → lock-in, B: AForce equivalent stronger → comparison transcript + 4 metric bullets [Electrolytes / Sugar load / Uptake speed / Recovery fit], C: scanned acceptable + no upgrade → fits-as-is, D: sub-par scanned → mirrors `recommendation.command` when an AForce alternative is recommended, otherwise water fallback). UI lives in `components/ScanAICoachCard.tsx`, auto-speaks via the existing `services/textToSpeech.speak()` (ElevenLabs proxy → Expo Speech device fallback) gated by the global voice-playback toggle, with a HEAR IT AGAIN / STOP control and a tracked finish-timer ref so stale timeouts cannot fire post-unmount.

- **AI Coach Status Color System (centralized 5-band):** Single source of truth `theme/statusColor.ts` exposes `getStatusColor(score, { pressure? })` returning the full color contract — `band` / `bandIndex` / `primary` / `glow` (#RRGGBBAA with band-appropriate alpha baked in) / `glowAlpha` / `glowRadius` / `animationSpeed` / `isPressure` — for the entire AI Coach surface area (status dot, headline accent line, voice bars, command card border + glow, CTA, Pressure Mode). Five score bands map to brand-spec hex values: OPTIMAL 85–100 (#39FF14 neon green, soft wide glow α 0.32 / r 22), STABLE 70–84 (#B4FF50 brand lime, subtle glow α 0.24 / r 14), DECLINING 50–69 (#FFD60A amber, minimal glow α 0.20 / r 10), RISK 30–49 (#FF8C1A orange, medium glow α 0.45 / r 14), CRITICAL 0–29 (#FF2D55 red, tight intense glow α 0.70 / r 8). Animation tempo monotonically accelerates worst → best (1.6× → 0.85× baseline), with `PRESSURE_SPEED_BOOST = 1.4×` multiplied on top of the band tempo. Pressure Mode swaps to a deeper-saturation palette (#FF0040 / #FF7A00 / #FFC000 / #A0FF20 / #22FF00) and amplifies glow alpha without changing band identity. Non-finite inputs safe-fail to CRITICAL so a broken upstream score lights the surface red rather than a calm green. Companion Reanimated hook `hooks/useAnimatedStatusColor.ts` tweens cross-band transitions in 400ms cubic ease via `useDerivedValue` + `interpolateColor` on a 0..4 `bandIndexSV` driver and a parallel `pressureSV` blend, plus an intensity oscillator at the band's tempo. Wired through `ScanAICoachCard.tsx`, `VoiceStatusModule.tsx`, `AIVideoPlayer.tsx`, and the `PulseBuildScene` voice bars (which scale their up/down/stagger durations by the band's animationSpeed multiplier so worse band + Pressure Mode literally beats faster). 22 dedicated tests in `services/__tests__/statusColor.test.ts` lock down boundary mapping, hex contracts, glow alpha monotonicity, animation speed monotonicity, pressure amplification ratios (~1.4×), and the design-rule contract (color is never an opaque fill, no two bands share a primary).
- **AI Coach Video Overlay Voice:** When the user opens the full-screen AI Coach video overlay (`AIVideoPlayer.tsx` expanded modal — e.g. CORRECT NOW / GO TIME / RESET), the coach speaks the same content the user sees: overlay title + subtitle + command action + explanation. Pure builder `services/videoCoachVoice.ts` assembles the spoken line, normalizes whitespace, ensures terminal punctuation for natural pauses, and skips the subtitle when it duplicates the leading clause of the action so the coach never stutters. Speech is keyed on `expanded` and the video/command identity, persona-tuned by `video.themeLevel`, and stopped on close, navigation away, or unmount.
- **AForce Command Voice Engine:** Elite ElevenLabs-powered voice layer that speaks 4 categories of performance events with brand-verbatim language. Pure script library `services/voice/commandVoice.ts` exposes `BRAND_LANGUAGE` constants (AForce Command Voice Engine / Performance Command / Hydration Cycle / System Reset / Risk State / Pressure Mode / Recovery Protocol / Performance Restored), score-band lines (PEAK / STABLE / CORRECT / RISK / CRITICAL across the 0–100 score), risk-timer lines at 16/8/4/0-minute thresholds, completion reward lines (deterministic-by-seed pick from 3 spec phrases), and `pressureCommandLine()` shortener for high-urgency states. Singleton bus `services/voice/commandVoiceBus.ts` (`commandSpeak` / `getLastCommand` / `replayLastCommand` / `subscribe`) records every utterance for the Voice Status module + replay; uses dependency-injected `setSpeakerImpl()` so tests run in Node without dragging in the RN runtime. React hooks `hooks/useScoreBandVoice.ts` (band-crossing state machine with suppress-first-fire) and `hooks/useRiskTimerVoice.ts` (descending threshold ladder with cycle-reset above 16) are mounted on Home and gate firing through `voiceCoachEnabled` + `categoryAllowedForScope(category, scope)`. The store wires the bus speaker on mount, persists `voiceIntensity` (`'calm' | 'standard' | 'pressure'`) and `voiceScope` (`'all' | 'risk' | 'commands' | 'muted'`) via AsyncStorage (`aforce.voiceIntensity` / `aforce.voiceScope`), routes the existing system-command auto-speak through `effectiveCommandLine()` (auto-engages Pressure Mode when intensity is `'standard'` and the user is `DEPLETED`), and speaks `completionRewardLine()` after every user-initiated `CYCLE_SUCCESS`. UI: premium dark `components/VoiceStatusModule.tsx` on Home (eyebrow + 3-up status grid + last-command line + replay button, color-tunes by current performance state, subscribes to the bus for live updates) and segmented intensity / scope pickers + replay row in `app/(tabs)/profile.tsx`. 50 dedicated unit tests cover every band boundary, every threshold, scope filtering, Pressure Mode shortening, bus pub/sub semantics, and the full playback lifecycle.

  - **Cinematic v2 refinement (additive on top of v1):** The bus now drives a parallel **playback lifecycle** state machine — `'idle' | 'received' | 'playing' | 'executed' | 'error'` — exposed via `subscribePlayback()` / `getPlaybackState()`. Every `commandSpeak()` flows through `idle → received` (immediate, ~220ms pre-roll handshake before audio) `→ playing` (~70ms × text length, clamped 1400-8000ms) `→ idle`. Synchronous speaker throws auto-mark `'error'` for ~2.4s. `markCycleExecuted()` (called from `useAppStore.logIntake()` after every non-silent `CYCLE_SUCCESS`) overrides any in-flight state with `'executed'` for ~2.4s — the visual "command executed" reward fires regardless of voice settings; voice is one of several expressions of it. Phantom-Band silent sips (`opts.silent: true`) stay quiet so background auto-logging does not pulse the orb. Timers are tracked via dual `activeTimer` + `nextTimer` slots and atomically cleared on every transition so back-to-back commands never produce orphan idle-fires.

  - **Reanimated cinematic surfaces:** `VoiceStatusModule.tsx` subscribes to both line + playback buses and renders a lifecycle pill that swaps through OFF / MUTED / LIVE / RECEIVED / TRANSMITTING / EXECUTED / AUDIO RETRY in time with the engine. The live dot uses a `useSharedValue` driven `withRepeat` cycle — fast pulse during active playback, slow breathing when LIVE, static when OFF / ERROR. The card border / shadow opacity breathes during `'playing'`, holds steady tint during `'executed'`, and flashes during `'error'` via a single shared value interpolated against the band accent hex. Replay button has press-scale (0.96) + `Haptics.Light` + `accessibilityState={{ disabled, busy }}` and swaps its label to `REPLAYING…` while mid-utterance. `StatusPulseOrb.tsx` accepts an additive `voiceActive` prop that renders two new rings — an outer halo that radiates outward (scale 1→1.45, opacity 0→0.85→0 over a 900ms repeat) and an inner core that breathes steadily — purely additive so every other animation continues underneath. `OrbSection.tsx` derives `voiceActive` from the bus playback state (`'received' | 'playing'`) and passes it through.

  - **Sharpened Pressure Mode language:** `pressureCommandLine()` now strips additional softeners (`you need to` / `try to` / `just` / `quickly` / `a little` / `some`), normalizes more urgency variants (`without delay → now`), digit-converts more number words (`one`-`eight`, `twenty-four`), collapses conjunctions (`and` / `and then` → `, `) for sharp comma cuts, cleans collision punctuation (`,\s*,+`), strips leading punctuation, and capitalizes the leading character so the sharpened line still reads as a command. All v1 pressure assertions trace clean through the new regex.

  - **"Ounces" canonical unit (user-facing):** The full surface area now reads "ounces" instead of "oz" — locale templates (en/pt/it/de/es/fr — `{{oz}}` interpolation placeholders preserved unchanged), score-band lines (`scoreBandLine` already shipped "12 ounces"), all 13 protocol commands in `utils/scoringEngine.ts` (calm + pressure variants), all voice templates in `data/voiceTemplates.ts` (`{oz}` template placeholders preserved), product/pricing/scan/video/RTD label data, the Sweat Calculator inputs/protocol/error messages + `suffix="ounces"` numeric input chrome, Ring Home/Sport screens, FlavorPickerModal button labels, intake history entries (`Logged AForce Stick (12 ounces)`), and the investor demo's signature pressure beat (`Drink 12 ounces. AForce. Now.`). Pressure Mode shortener no longer collapses "ounces" → "oz" — the brand canonical unit reads through every channel including Pressure cadence. Internal code identifiers (TS field names like `oz: number` / `ozAmount` / `ozTarget` / `overnightLossOz`, the `'oz' | 'ml'` `FluidUnit` type union, JSON event keys, and i18n placeholder names) remain unchanged so storage, scoring math, and API contracts are byte-identical.

- **Investor Demo (60-second cinematic flow):** A scripted full-screen overlay that walks an investor through every Voice Engine state in exactly 60 seconds — Optimal → Depletion → Risk → Calm Command → User Ignores → Pressure Mode → Sharp Command → Cycle Complete → System Reset → "Command executed. Performance restored." Pure beat schedule lives in `services/demo/investorDemoBeats.ts` (`INVESTOR_DEMO_BEATS` — 10 frozen beats summing to exactly `INVESTOR_DEMO_TOTAL_MS = 60_000`, with `DemoBeat` shape covering `score / band / riskMin / intensity / voice? / executed?`, plus `beatAtMs()` and `bandToLevel()` helpers). Voice cadence is verified against the bus's 70ms-per-character speech estimate so every utterance fits inside its beat window with a 220ms post-roll cushion. Pressure beats (beat 7: "Drink 12 oz. AForce. Now.") are asserted to be ≤8 words, contain `now` + a digit + oz, and never include `please`. The cinematic overlay component (`components/investorDemo/InvestorDemoOverlay.tsx`) is a Reanimated full-screen `Modal` with: top progress strip + beat counter + intensity chip, animated 96pt score readout that tweens between beats via `useSharedValue` + `useDerivedValue` + `withTiming`, a custom orb (band-tinted core + outer halo that pulses faster on CRITICAL bands) with an additive radiating voice halo that fires only while the bus playback state is `'received' | 'playing'`, beat title fade transitions, and a live voice-stream caption strip whose lifecycle pill swaps STANDBY / RECEIVED / TRANSMITTING / EXECUTED / AUDIO RETRY in real time. Every voice line is dispatched through the real `commandSpeak()` so the production ElevenLabs proxy, voice bus, and the live `VoiceStatusModule` on Home all light up exactly the way they would in the field; beat 8 also calls `markCycleExecuted()` for the cinematic EXECUTED pulse + a success haptic. The demo never mutates user state — no logIntake, no engine pipeline, no AsyncStorage. All 11 timers (10 beat triggers + 1 auto-close at 60.8s) live in a single `timersRef` that is cleared on close / unmount / re-open so an aborted demo can never fire a stale beat. Launched via a `▶ LAUNCH INVESTOR DEMO · 60s` Pressable on the Profile screen Voice section (testID `profile-investor-demo-launch`), driven by an `isInvestorDemoActive` boolean flag in `useAppStore` (transient — never persisted), and mounted at the AppShell layer in `app/_layout.tsx` so it floats above every tab and route. 16 dedicated unit tests cover total runtime, beat count + ordering, gap-free monotonic timeline, voice timing safety, narrative arc (downward score 1→6, upward 8→10), Pressure Mode cadence, the sign-off line, and `beatAtMs` / `bandToLevel` correctness.
- **API Server (`artifacts/api-server`):** Scaling blueprint for 50M+ users, Stripe integration, auth-gated routes, and social graph routes.
- **Store + Subscription System:** Defines SKU pricing, discounts, and bundles; five consumer subscription tiers with feature gating.

## Architecture Diagram (AForce OS)
- **`app/`**: Root layouts, screens, tab bar, gated routes.
- **`components/`**: Reusable UI elements, including home sections.
- **`services/`**: Business logic.
- **`store/`**: Slice-based reducer state.
- **`utils/`**: Pure helpers for calculations and data processing.
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: Brand colors.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, templates.

# External Dependencies

- **Stripe:** Payment processing and subscription management.
- **stripe-replit-sync:** Mirrors Stripe webhook events to PostgreSQL.
- **Clerk (`@clerk/expo`, `@clerk/express`):** Authentication.
- **Expo SDK 54:** React Native development framework.
- **Expo WebBrowser / AuthSession:** OAuth and in-app browser.
- **Expo Speech:** Text-to-speech fallback.
- **@expo-google-fonts/inter:** Custom font.
- **React Native Reanimated:** Declarative animations.
- **React Native Gesture Handler:** Gesture recognition.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Schema and query layer.
- **Orval:** OpenAPI codegen.
- **Zod:** Schema validation.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** Bundling.
- **OpenWeather API:** Environmental data.
- **ElevenLabs:** Text-to-speech service.
- **i18next:** Localization.