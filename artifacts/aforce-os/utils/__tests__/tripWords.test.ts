/**
 * One Breath hands a flight sentence to trip entry, and nothing else.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTripSentence } from '../travel/tripWords';
import { PHRASING_SET } from './oneBreath/phrasingSet';

const NOW = new Date(2026, 10, 19, 10, 0);
const trip = (w: string) => isTripSentence(w, NOW);
const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('is it a trip?', () => {
  it('a flight number makes it a trip', () => {
    for (const w of ['Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM', 'united 88 tomorrow', 'AA 100 friday at 6 am']) expect(trip(w), w).toBe(true);
  });

  it('a flying word with a place or an airline makes it a trip', () => {
    for (const w of ["I'm flying to LA Friday", 'flying to Miami tomorrow', 'flight from Newark to Boston sunday', 'flying delta on monday', 'flying to Houston next week']) expect(trip(w), w).toBe(true);
  });

  it('a flying word with no place stays an ordinary Moment, as it is today', () => {
    for (const w of ['I have a flight Friday at 6:15 am', 'flight tomorrow', 'flying soon']) expect(trip(w), w).toBe(false);
  });

  it('a place with no flying word is not a trip: dinner in Miami is a Moment', () => {
    for (const w of ['Dinner in Miami Friday at 8 pm', 'meeting in Boston tomorrow at 2 pm', 'heading to the gym', 'going to Miami for the weekend']) expect(trip(w), w).toBe(false);
  });

  it('none of the Moment, drink, status or Lock In phrases One Breath is graded on is mistaken for a trip', () => {
    const allowed = new Set(['I have a flight Friday at 6:15 am']);
    const taken = PHRASING_SET.filter((p) => !allowed.has(p.text) && trip(p.text)).map((p) => `${p.id} ${p.text}`);
    expect(taken).toEqual([]);
  });
});

describe('the hand-off on the screens', () => {
  const ONE_BREATH = read('components/oneBreath/MomentPreparationScreen.tsx');
  const TRAVEL = read('components/travel/TravelIntelligenceScreen.tsx');
  const ENTRY = read('components/travel/TellAforceYourTrip.tsx');

  it('One Breath hands over only where Travel is available, never from Social, and saves nothing itself', () => {
    const at = ONE_BREATH.indexOf('isTripSentence(words, new Date())');
    const block = ONE_BREATH.slice(ONE_BREATH.lastIndexOf('if (', at), ONE_BREATH.indexOf('return;', at));
    expect(block).toContain('!social');
    expect(block).toContain('travelPilotAvailable(app.featureFlags)');
    expect(block).toContain('router.push({ pathname: "/travel-intelligence", params: { trip: words } }');
    expect(block).not.toMatch(/commit|addMoment|save\(/);
  });

  it('Travel opens trip entry with the words, once, and still saves only on Confirm', () => {
    expect(TRAVEL).toContain('const handedTrip = typeof params.trip === "string" ? params.trip : "";');
    expect(TRAVEL).toContain('initialWords={handedTrip}');
    expect(TRAVEL.match(/saveDraft\(/g)).toHaveLength(1);
    expect(ENTRY).toContain('if (handed.current || !initialWords?.trim()) return;');
  });
});

describe('the older Travel screen is no longer where a trip is added', () => {
  it('every way to add a trip leads to the current screen', () => {
    expect(read('app/modules.tsx')).toContain("href: '/travel-intelligence'");
    expect(read('components/travel/TravelHomeCard.tsx')).toContain("router.push('/travel-intelligence' as never)");
    const confirm = read('components/oneBreath/ConfirmMomentScreen.tsx');
    expect(confirm.match(/router\.push\('\/travel-intelligence'\)/g)).toHaveLength(2);
    expect(confirm).not.toContain("router.push('/travel')");
  });

  it('a flight saved on the older screen can still be opened: its reminder and its Moment still lead there', () => {
    expect(read('components/travel/TravelLifecycleMount.tsx')).toContain("router.push('/travel' as never)");
    expect(read('app/moment/[id].tsx')).toContain('<Redirect href="/travel" />');
    expect(read('app/travel.tsx')).toContain('TravelScreen');
  });
});
