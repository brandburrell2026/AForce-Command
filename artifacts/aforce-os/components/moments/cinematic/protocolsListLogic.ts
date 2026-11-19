/**
 * The Protocols page — the approved prototype's list of the three plans that
 * sit around a member's Moments: Recovery, Sleep and Travel. Pure: the words
 * on each tile and where it leads.
 *
 * The prototype's own page is a design-review concept whose tiles open
 * placeholder pages ("no advice here yet"). In the app each tile opens the
 * real screen that already exists, so nothing is promised that is not there:
 *   Recovery → today's protocol     (/protocol)
 *   Sleep    → the Sleep screen     (/sleep)
 *   Travel   → the Travel page      (/travel-intelligence), only where the
 *              Travel pilot is available — otherwise the tile is not listed.
 */

export type ProtocolTileKey = 'recovery' | 'sleep' | 'travel';

export interface ProtocolTile {
  key: ProtocolTileKey;
  /** Small line above the name. */
  eyebrow: string;
  name: string;
  /** One line under the name. */
  note: string;
  route: '/protocol' | '/sleep' | '/travel-intelligence';
}

const TILES: readonly ProtocolTile[] = [
  {
    key: 'recovery',
    eyebrow: 'After a hard Moment',
    name: 'Recovery',
    note: 'The day after a game, a long run or a late night.',
    route: '/protocol',
  },
  {
    key: 'sleep',
    eyebrow: 'Before a big day',
    name: 'Sleep',
    note: 'The night before a presentation, a race or an early flight.',
    route: '/sleep',
  },
  {
    key: 'travel',
    eyebrow: 'Across time zones',
    name: 'Travel',
    note: 'Flights, layovers and landing ready.',
    route: '/travel-intelligence',
  },
];

export const PROTOCOLS_TITLE = 'Plans for the Moments around your Moments.';

/** The tiles to show. Travel is listed only where the Travel page can open. */
export function protocolTiles(opts: { travelAvailable: boolean }): ProtocolTile[] {
  return TILES.filter((t) => t.key !== 'travel' || opts.travelAvailable);
}

/** The line under "Protocols" on the Moments page: only what the list holds. */
export function protocolsSubline(opts: { travelAvailable: boolean }): string {
  return protocolTiles(opts).map((t) => t.name).join(' · ');
}
