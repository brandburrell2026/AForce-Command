# Final Rules for Claude Code

The operating contract for building the AForce OS governance sections. Read alongside [`AForce-Constitution.md`](AForce-Constitution.md), [`Architecture-Appendix.md`](Architecture-Appendix.md), and [`Phase-Roadmap.md`](Phase-Roadmap.md).

---

1. Create the `/governance` folder structure first, before building any of Sections 58–64.
2. Build one numbered section at a time. Confirm completion before starting the next.
3. Test each section before moving to the next.
4. Every section in `Architecture-Appendix.md` must carry its Status tag — Build Now, Architecture Only, Phase 2, Phase 3, or Phase 4.
5. Section 58 is UI only — no new calculation engine.
6. Section 59 extends existing Decision Memory — do not build a parallel system. Language rule is non-negotiable: cause-and-effect only, never risk/diagnosis language.
7. Section 60 stays feature-flagged off until 60–90 days of personal data exists per user.
8. Section 61 daily lesson ships now; Your Body's Manual, Confidence Journey, and Legacy summary are architecture-only until their assigned phase. "Your body taught us" is a hard compliance rule, not a style preference. Legacy summaries never use prevention/causal medical language.
9. Section 62 Founder Mode is internal-only, never exposed in Production, accessible only to authenticated Julius/Brandon/internal team accounts. Writes only to Sandbox.
10. Section 63 compliance revisions apply to the existing Profile, Guardian, Clutch, and Cruise Mode specs — required updates, not new features.
11. Section 64 governs all AI Coach and conversational behavior from Phase 1 onward. The AI Coach must be built against these rules from the start — it does not default to a standard chatbot pattern and get corrected later.
12. The AForce Constitution is frozen after this email. No further philosophical principles without explicit approval from both Julius and Brandon, and only after real-world beta evidence.
13. All thresholds, weights, and tunable values continue to live in `config/hydroStateModel.ts`. Never hardcoded.
14. No redesign of existing navigation. No new tabs. No rebuild of existing systems.
