# Gentle Hydration Mode — internal device validation

Status: **internal preview only**. This checklist is evidence for product,
clinical, privacy, accessibility, and device review. It is not authorization
to enable the feature in a public build.

## Build and access

1. Install an internal TestFlight build that exposes **You → Developer**.
2. In **Developer**, turn on **Gentle Hydration preview** only. Do not use
   **Unlock all** for this check.
3. Open **Hydration** and confirm the existing intake ring, target, recent
   intake, and normal water logger still appear.
4. Confirm the Gentle Hydration card appears below the primary hydration
   actions and is labelled **Private**.

## Core member flow

1. Select **Set up gentle hydration**.
2. Change each pace: Gentle, Steady, and Minimal. Confirm the card describes
   only the number of check-ins and never recommends a fluid amount.
3. Select each comfort option, including **Prefer not to say**. Close and
   reopen the app; confirm the preference persists for that signed-in account.
4. Tap **Log water**. Confirm the existing explicit amount picker opens;
   choose an amount and verify the normal hydration confirmation and intake
   update occur exactly once.
5. Tap **Not now**. Confirm the card changes to the no-penalty waiting state.
   Tap **I'm ready now** and confirm logging becomes available again.
6. Tap **Pause today**. Confirm the regular Hydration screen remains usable.
   Confirm the Gentle Hydration card offers **Resume gentle hydration**.
7. Tap **Turn off**. Relaunch the app and confirm pacing and comfort context
   have been cleared.

## Safety and privacy checks

1. Tap **When to contact your clinician** before choosing any comfort option.
   Confirm the guidance is visible and includes both persistent-symptom and
   urgent/severe escalation language.
2. Choose **Stomach upset** and confirm the same guidance is shown
   automatically.
3. Confirm the card says it is private and not shared with Circle or used for
   ranking.
4. Open **Circles** on both connected accounts. Confirm no Gentle Hydration
   pace or comfort context appears in membership, sharing, or recorded
   activity views.
5. Check the hydration target and score before and after enabling the mode and
   after each pace selection. They must not change because of the mode.

## Reminder containment

1. Enable the mode, defer, pause, resume, and relaunch the app.
2. Confirm no local/push reminder is scheduled by this preview.
3. Confirm no prompt appears during the device's quiet period.

## Accessibility

1. Test with VoiceOver. Pace and comfort options must announce as radio
   controls with their selected state. The clinician guidance control must
   announce its expanded state.
2. Test at the largest supported system text size. No pace label, guidance,
   or action may clip or overlap.
3. Verify every touch target is reachable and the regular water picker remains
   dismissible.

## Release gates

All items below require recorded owner approval before a public flag change:

- Clinical/legal review of all health and escalation copy.
- Privacy review of secure account-scoped storage and deletion behavior.
- Accessibility sign-off from the device checks above.
- Internal device validation on a signed-in physical iPhone.
- Product approval for notification behavior. The current release has no
  native reminder scheduler.

Do not turn on `gentle_hydration_mode_enabled` in `DEFAULT_FLAGS` until these
gates are complete.
