// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Moment, MomentRecommendation } from '@/types/moments';
const h = vi.hoisted(() => ({ moments: [] as any[], internal: true, action: true }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: any) => params?.action ?? key }) }));
vi.mock('@/components/travel/TravelHomeCard', () => ({ TravelMomentsEntry: () => null }));
vi.mock('@/components/profile/ProfileEntryButton', () => ({ ProfileEntryButton: () => null }));
vi.mock('@/components/ui', () => ({ AFMasthead: () => null, AFScreen: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/editorial/index', () => ({ EdSurface: ({ children }: any) => <div>{children}</div>, EdRule: () => null, EdStatement: ({ children }: any) => <div>{children}</div>, useEdSettle: () => ({}) }));
vi.mock('@/components/editorial/moments/EdReturn', () => ({ EdReturn: () => null }));
vi.mock('@/components/moments/MomentsSkeleton', () => ({ MomentsOverviewSkeleton: () => null }));
vi.mock('@/components/moments/WhyThisSheet', () => ({ WhyThisSheet: () => null }));
vi.mock('@/hooks/useTabBarClearance', () => ({ useTabBarClearance: () => 90 }));
vi.mock('@/hooks/useMomentsFirstExperience', () => ({ useMomentsFirstExperience: () => h.internal }));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({ moments_calendar_enabled: false }) }));
vi.mock('@/components/moments/useMomentsData', () => ({ useMomentsData: () => ({ hydrated: true, surfaced: h.moments, nowIso: '2026-11-02T12:00:00Z', recFor: () => ({ prepWindowStartIso: '2026-11-03T11:30:00Z', prepWindowEndIso: '2026-11-03T12:00:00Z', primaryAction: h.action ? { labelKey: 'command', labelParams: { action: 'Canonical preparation action' } } : undefined }) }) }));
import { EditorialMomentsScreen } from '../editorial/moments/EditorialMomentsScreen';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement;
function render() { act(() => root.render(<EditorialMomentsScreen tabRoot />)); }
function row(id: string) { return host.querySelector(`[data-testid="editorial-moment-row-${id}"]`)!; }
beforeEach(() => { h.internal = true; h.action = true; h.moments = [7, 8, 9, 14].map((hour, index) => ({ id: String(index), title: ['Gym workout', 'Meeting with Julius', 'One Breath test', 'Meeting with Kendra'][index], startAtIso: `2026-11-03T${String(hour + 5).padStart(2, '0')}:00:00Z`, type: 'personal' })); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
// The internal Moments tab is laid out as the approved prototype since 2026-11-18:
// a hero for the next Moment, "Plan a Moment · say it", then Upcoming and Done as
// quiet rows. The engine's instruction is not repeated on the list (it lives on the
// Moment's own screen); the public layout is unchanged.
function proto(id: string) { return host.querySelector(`[data-testid="moments-row-${id}"]`)!; }
describe('internal Moments tab (prototype layout)', () => {
  it('shows every upcoming Moment once as a quiet row, with no instruction on the list', () => {
    render();
    expect(host.textContent).not.toContain('Canonical preparation action');
    for (const [id, title] of [['0', 'Gym workout'], ['1', 'Meeting with Julius'], ['2', 'One Breath test'], ['3', 'Meeting with Kendra']] as const) {
      expect(proto(id).textContent).toContain(title);
      expect(proto(id).getAttribute('aria-label')).toContain('not prepared');
      expect(proto(id).textContent).toContain('Plan');
    }
    expect(host.textContent).toContain('UPCOMING');
    expect(host.textContent).toContain('Plan a Moment · say it');
  });
  it('leads with the next Moment in the hero', () => {
    render();
    const hero = host.querySelector('[data-testid="moments-hero"]')!;
    expect(hero.textContent).toContain('Gym workout');
    expect(hero.textContent).toContain('NEXT');
  });
  it('moves a returned Moment to Done and keeps it quiet', () => {
    h.moments[0].preparation = { sealedAtIso: '2026-11-02T10:00:00Z', returnedAtIso: '2026-11-02T11:00:00Z' };
    render();
    expect(host.textContent).toContain('DONE');
    expect(proto('0').getAttribute('aria-label')).toContain('Replay ready');
    expect(proto('0').getAttribute('aria-label')).not.toContain('not prepared');
    expect(host.querySelector('[data-testid="moments-hero"]')!.textContent).toContain('Meeting with Julius');
  });
  it('shows the first-Moment hero and an empty note when nothing is planned', () => {
    h.moments = []; render();
    expect(host.textContent).toContain('Your first Moment');
    expect(host.querySelector('[data-testid="moments-empty"]')).toBeTruthy();
  });
  it('preserves the public layout when the internal gate is off', () => {
    h.internal = false; render();
    expect((host.textContent!.match(/Canonical preparation action/gi) ?? [])).toHaveLength(5);
    expect(row('0')).toBeTruthy();
  });
});
