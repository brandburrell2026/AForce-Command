import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROTOCOLS_TITLE, protocolTiles, protocolsSubline } from '../cinematic/protocolsListLogic';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

describe('Protocols list — the prototype\'s three plans', () => {
  it('the title, word for word', () => {
    expect(PROTOCOLS_TITLE).toBe('Plans for the Moments around your Moments.');
  });

  it('Recovery, Sleep and Travel, with the prototype\'s lines', () => {
    expect(protocolTiles({ travelAvailable: true })).toEqual([
      { key: 'recovery', eyebrow: 'After a hard Moment', name: 'Recovery', note: 'The day after a game, a long run or a late night.', route: '/protocol' },
      { key: 'sleep', eyebrow: 'Before a big day', name: 'Sleep', note: 'The night before a presentation, a race or an early flight.', route: '/sleep' },
      { key: 'travel', eyebrow: 'Across time zones', name: 'Travel', note: 'Flights, layovers and landing ready.', route: '/travel-intelligence' },
    ]);
  });

  it('Travel is not listed where its page cannot open', () => {
    expect(protocolTiles({ travelAvailable: false }).map((t) => t.key)).toEqual(['recovery', 'sleep']);
  });

  it('the Moments sub-line names only what the list holds', () => {
    expect(protocolsSubline({ travelAvailable: true })).toBe('Recovery · Sleep · Travel');
    expect(protocolsSubline({ travelAvailable: false })).toBe('Recovery · Sleep');
  });

  it('every tile opens a route that exists', () => {
    expect(read('app/(tabs)/protocol.tsx')).toContain('export default');
    expect(read('app/(tabs)/sleep.tsx')).toContain('export default');
    expect(read('app/travel-intelligence.tsx')).toContain('travelPilotAvailable(flags)');
  });
});

describe('Protocols list — wiring', () => {
  const SCREEN = strip(read('components/moments/cinematic/ProtocolsScreen.tsx'));
  const MOMENTS = strip(read('components/editorial/moments/EditorialMomentsScreen.tsx'));

  it('Moments opens the list, not the old Protocol screen directly', () => {
    expect(MOMENTS).toContain("router.push('/protocols' as never)");
    expect(MOMENTS).not.toContain("router.push('/protocol')");
    expect(read('app/protocols.tsx')).toContain('return <ProtocolsScreen />;');
    expect(read('app/_layout.tsx')).toContain('<Stack.Screen name="protocols"');
  });

  it('Travel is its own row on Moments, under the same conditions as before', () => {
    expect(MOMENTS).toContain('const travelOn = travelPilotAvailable(flags) && !!isSignedIn && !fixtureMoments;');
    expect(MOMENTS).toMatch(/\.\.\.\(travelOn\s*\? \[\{ title: 'Travel', sub: 'Add or manage a flight', onPress: \(\) => router\.push\('\/travel-intelligence' as never\), testID: 'moments-link-travel' \}\]/);
  });

  it('the list shows Travel only for a signed-in member where the pilot is available', () => {
    expect(SCREEN).toContain('protocolTiles({ travelAvailable: travelPilotAvailable(flags) && !!isSignedIn })');
  });

  it('each tile only navigates; the page writes and fetches nothing', () => {
    expect(SCREEN.match(/router\.push\(/g)).toHaveLength(1);
    expect(SCREEN).toContain('router.push(tile.route as never)');
    expect(SCREEN).not.toMatch(/fetch\(|scopedStorage|AsyncStorage|useQuery|useMutation/);
    expect(SCREEN).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
