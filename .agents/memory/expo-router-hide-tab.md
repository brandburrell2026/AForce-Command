---
name: Expo Router — conditionally hide a tab
description: Pattern for keeping a (tabs)/ route deep-linkable while hiding its tab-bar button.
---

For Classic `Tabs.Screen`: set `options.href = condition ? '/route' : null`. `null` hides the bar button but the route is still reachable via deep link.

For `NativeTabs` (Liquid Glass iOS): conditionally render the `<NativeTabs.Trigger>` — there is no `href: null` equivalent. Changing the trigger set mid-session causes a navigator remount, so only toggle from rarely-flipped flags (e.g. developer settings), not per-render UI state.

**Why:** Files inside `app/(tabs)/` auto-create tabs; deleting the file removes the route entirely. `href: null` is the only way to keep the route registered (for QA deep links, legacy preservation) while removing the visible button.

**How to apply:** Use when preserving a legacy screen behind a dev/admin flag, or when a tab is contextual (only shown after some user action).
