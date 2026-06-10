---
name: AForce notification system mockups
description: Where the AForce notification design lives and the decision to keep it as sandbox mockups, not app push.
---

# AForce notification system

The AForce OS "premium notification system" (spec: an attached `Pasted-Yes-The-WHOOP-notification-is-elegant…` brief) was built as **canvas mockups** in the mockup-sandbox (`mockups/aforce-notifications/`: `LockScreen`, `Catalog`, shared `_shared.tsx`), **not integrated into the aforce-os app**.

**Why:** the user works iteratively on the canvas (welcome-luxury / splash variants) and asked for a design, not an app change. The app already has its own in-app notification surface (`NotificationBanner` + Day 0/1/3/7 cadence in `services/notifications`); these mockups are a separate visual exploration. Do not assume real push notifications use this design unless someone graduates it.

**Design language (distinct from the WHOOP-lime hero):** brand-red `#FF3B30` accent (the redesign-lock `accent.brand`, not lime), pure-black bg, frosted-glass cards (`backdrop-filter: blur`), white type, water-drop app-icon mark + red count badge, Apple-style rounded notification cards.

**Copy is locked to the spec and Water-First compliant:** hydration leads, "Pause. Hydrate. Lock In. Perform.", and the tone bans "Great job!/Awesome!/Congratulations!" in favor of performance/discipline language. Signature notification = "Readiness Window Open". If editing copy, preserve this tone.
