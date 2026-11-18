/**
 * Which drink categories a build may offer for logging (stop-ship SS-26,
 * founder decision 2026-11-18).
 *
 * Alcohol has no age or regional-eligibility check anywhere in the app, so
 * the member-facing drink picker must not offer it in an ordinary production
 * build. It stays available in local development and internal TestFlight
 * builds, where Night Out work is tested. When an eligibility check exists,
 * this is the one place to route it through.
 *
 * This is a presentation rule. The `/drinks` API still accepts the category,
 * because internal builds use the same server.
 */
import { CATEGORY_ORDER, type DrinkCategoryId } from '../../data/drinkCatalog';
import { currentUnlockContext, type UnlockContext } from '../../featureFlags/flags';

/** Categories that need an age / jurisdiction eligibility check before logging. */
export const AGE_RESTRICTED_DRINK_CATEGORIES: readonly DrinkCategoryId[] = ['alcohol'];

export function ageRestrictedDrinksAvailable(ctx: UnlockContext = currentUnlockContext()): boolean {
  return ctx.dev || ctx.internalTestflight;
}

export function isDrinkCategoryAvailable(
  categoryId: DrinkCategoryId,
  ctx: UnlockContext = currentUnlockContext(),
): boolean {
  if (!AGE_RESTRICTED_DRINK_CATEGORIES.includes(categoryId)) return true;
  return ageRestrictedDrinksAvailable(ctx);
}

/** `CATEGORY_ORDER` without the categories this build may not offer. */
export function availableCategoryOrder(ctx: UnlockContext = currentUnlockContext()): DrinkCategoryId[] {
  return CATEGORY_ORDER.filter((id) => isDrinkCategoryAvailable(id, ctx));
}

/** Categories to hide from search results in this build. */
export function unavailableDrinkCategories(ctx: UnlockContext = currentUnlockContext()): DrinkCategoryId[] {
  return CATEGORY_ORDER.filter((id) => !isDrinkCategoryAvailable(id, ctx));
}
