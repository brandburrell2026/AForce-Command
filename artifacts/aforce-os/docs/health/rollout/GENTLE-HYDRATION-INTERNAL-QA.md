# Gentle Hydration Mode — internal device QA

Status: **internal TestFlight only**. Public defaults stay off. Record evidence before any release decision.

## Access and privacy

1. Verify the card is absent with public/default flags and appears only through the internal TestFlight overlay.
2. Enable the mode, relaunch, and verify the preference persists.
3. Turn it off, relaunch, and verify all preferences are deleted and no gentle copy remains.
4. On two devices signed into the same Apple ID, enable it on one and confirm it does not appear on the other.
5. Inspect network activity and analytics/debug output while changing preferences. Confirm no mode state, copy, or GLP context is present.
6. Confirm no Circle membership, sharing, activity, rank, score, or recovery payload contains Gentle Hydration data.

## Presentation and controls

1. Confirm the existing target and score are unchanged and there is no shortfall framing.
2. Enable **Pause streak display** and verify only the Hydration streak display hides. Underlying data stays unchanged.
3. Verify prompts default off and remain blocked until `gentle_hydration_prompts_enabled` is approved.
4. Verify prompt policy: in-app only, never backgrounded, max one per three hours, max four per day, quiet 9pm–8am local.
5. Confirm no product, Shop, checkout, or electrolyte suggestion appears.

## Safety and accessibility

1. Verify the clinician line is always visible and matches approved copy.
2. Verify GLP-1 context is absent under 18 or when age is unknown.
3. Test VoiceOver, largest Dynamic Type, and Reduce Motion. No clipping or celebratory animation is permitted.

## Open implementation limit

The current Circle implementation has no server-authoritative per-member visibility setting for rank. **Hide my rank in Circle** is not included because a local preference cannot reliably hide a member from other people’s views without changing shared Circle/ranking behavior. It requires a separately reviewed server-backed privacy design.
