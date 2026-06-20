---
name: AForce Fuel vs Store naming
description: The commerce surface is branded "Fuel" in UI but stays "store" in route/key/ids — rename labels only, never identifiers.
---

# AForce "Fuel" (user-facing) vs "store" (code)

The commerce/shopping surface is branded **"Fuel" (FUEL TAB™)** in all user-facing
copy, with a **"guided, not sold to"** tone. But every routing/code identifier stays
`store`.

**Rule:** rename only labels & copy. Never rename the route, i18n key, or internal ids.

- User-facing = **Fuel**: `tabs.store` value, StoreScreen eyebrow/title/subtitle,
  CartScreen empty-state, restock/CTA accessibility labels. Tone is guided
  (e.g. "Fuel Your Protocol", "We'll point you to what your protocol needs") — drop
  sales-y phrasing like "Shop the System" / "Subscribe and save".
- Code = **store** (unchanged): route `/store` (`app/store.tsx` + `app/_layout.tsx`
  `Stack.Screen name="store"`), the i18n **key** `tabs.store` (only its value changed),
  and ids `StoreScreen` / `STORE_SKUS` / `StoreSKU` / `StoreFormatId` / `useCartStore`.

**Why:** build-lock allows label renames but forbids navigation changes; renaming the
route file or i18n key would break deep links, cart navigation, and generated/typed
code for no user-visible benefit.

**Localization:** "Fuel" is kept **untranslated** across all 11 locales as a brand term,
even though other tab labels (Hydration, Community, etc.) ARE localized. If the owner
later wants it localized, only the six launch locales (en/es/fr/de/pt/it) should change;
hidden locales (ar/hi/ja/ko/zh) hold English placeholders by convention.

**How to apply:** when asked to touch the "Fuel"/"Store" surface, grep for both words —
fix user-facing "Store"/"Shop" strings to "Fuel", but leave `/store`, `tabs.store` key,
and the `*Store*`/`useCartStore` ids alone.
