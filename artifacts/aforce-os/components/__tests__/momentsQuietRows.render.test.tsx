// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Moment, MomentRecommendation } from '@/types/moments';
const h = vi.hoisted(() => ({ moments: [] as any[], internal: true, action: true }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: any) => params?.action ?? key }) }));
vi.mock('@/components/travel/TravelHomeCard', () => ({ TravelMomentsEntry: () => null }));
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
describe('internal Moments quiet rows', () => {
  it('renders the canonical instruction exactly once while keeping every title and prep window', () => {
    render(); expect(host.textContent!.split('Canonical preparation action')).toHaveLength(2);
    expect(row('0').getAttribute('aria-label')).toContain('Canonical preparation action');
    for (const id of ['1', '2', '3']) {
      expect(row(id).textContent).not.toContain('Canonical preparation action');
      expect(row(id).getAttribute('aria-label')).not.toContain('moments.do_this');
      expect(row(id).textContent).toContain('moments.prep_window');
    }
    expect(host.textContent).toContain('Meeting with Julius'); expect(host.textContent).toContain('Meeting with Kendra');
  });
  it('moves the single brief past completed and already prepared rows', () => {
    h.moments[0].startAtIso = '2026-11-02T07:00:00Z'; h.moments[1].preparedAtIso = '2026-11-02T11:00:00Z'; render();
    expect(row('0').getAttribute('aria-label')).not.toContain('Canonical preparation action');
    expect(row('1').textContent).toContain('MOMENTS.STAGE_DONE');
    expect(row('1').getAttribute('aria-label')).toContain('moments.stage_done');
    expect(row('1').getAttribute('aria-label')).not.toContain('moments.do_this');
    expect(row('2').getAttribute('aria-label')).toContain('Canonical preparation action');
    expect(host.textContent!.split('Canonical preparation action')).toHaveLength(2);
  });
  it('keeps an absent command silent and preserves the public layout when the internal gate is off', () => {
    h.action = false; render(); expect(host.textContent).not.toContain('Canonical preparation action');
    expect(row('0').getAttribute('aria-label')).not.toContain('moments.do_this');
    h.action = true; h.internal = false; render(); expect((host.textContent!.match(/Canonical preparation action/gi) ?? [])).toHaveLength(5);
  });
});
