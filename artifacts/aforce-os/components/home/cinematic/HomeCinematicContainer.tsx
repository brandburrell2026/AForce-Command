/**
 * HomeCinematicContainer — feeds HomeCinematic with the member's real data.
 *
 * It reads the next Moment from the Moments store and turns the values the
 * Home screen has already resolved (HydroState, evidence, the engine's next
 * move, intake, data source) into the words on the screen. It computes no
 * score, changes no target and logs nothing itself: logging stays with the
 * Home screen's existing open-only picker.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { useMomentsStore } from '@/services/momentsStore';
import { useMomentPrepScheduling } from '@/components/moments/useMomentPrepScheduling';
import type { Moment } from '@/types/moments';
import { HomeCinematic } from './HomeCinematic';
import { worldPhotoForMoment } from '@/components/world/worldPhotoSources';
import { HomeMomentCards } from './HomeMomentCards';
import { HomeFirstMomentCard } from './HomeFirstMomentCard';
import { useFirstMomentAvailable } from '@/hooks/useFirstMomentAvailable';
import { readFirstMomentChoice } from '@/services/firstMomentChoice';
import { firstMomentCard, type FirstMomentChoice } from '@/utils/firstMoment';
import { homeBeforeCard, homeReturnCard } from './homeMomentCardsLogic';
import {
  homeClock,
  homeDateLine,
  homeGreeting,
  homeIntakeNote,
  homeMomentHero,
  homeRing,
  homeStatusLine,
  type HomeEvidence,
} from './homeCinematicLogic';

export interface HomeCinematicContainerProps {
  now: Date;
  firstName?: string | null;
  profileEntry?: React.ReactNode;
  evidence: HomeEvidence;
  /** HydroState 0–100, already resolved by the scoring engine. */
  score: number;
  moveTitle: string;
  why?: string;
  consumedOz: number;
  targetOz: number;
  /** Null when nothing has been logged in the current window. */
  lastLoggedAt: Date | null;
  confidenceLine?: string;
  sourceLabel?: string;
  sourceFetchedAtMs?: number | null;
  notice?: string;
  logLabel: string;
  onLog: () => void;
  logBusy?: boolean;
  fixtureMoments?: Moment[];
  fixtureNowIso?: string;
  children?: React.ReactNode;
}

export function HomeCinematicContainer(props: HomeCinematicContainerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const data = useMomentsData(
    props.fixtureMoments ? { fixtureMoments: props.fixtureMoments, fixtureNowIso: props.fixtureNowIso } : undefined,
  );
  // Same scheduling side effect the previous Home ran from its Moment line.
  useMomentPrepScheduling();

  const next = data.hydrated ? data.next ?? null : null;
  const hero = homeMomentHero(next, props.now, t('moments.private_event'));
  const ring = homeRing(props.evidence, props.score);
  // The prototype's two Moment cards. They appear only when they apply and
  // only open the Moment's own screen.
  const [skippedReturns, setSkippedReturns] = React.useState<ReadonlySet<string>>(() => new Set());
  // Read from the member's own Moments, not the today-forward list: a Moment
  // that began last night can still be waiting for its replay this morning.
  const store = useMomentsStore();
  const allMoments = props.fixtureMoments ?? (store.hydrated ? store.moments : []);
  const privateLabel = t('moments.private_event');
  const beforeCard = homeBeforeCard(allMoments, props.now, privateLabel);
  const returnCard = homeReturnCard(allMoments, props.now, privateLabel, skippedReturns);
  // The prototype's "Your first Moment" card: only for a member with no
  // Moment yet, and only where One Breath really ends in a plan to seal.
  const firstMomentAvailable = useFirstMomentAvailable();
  const [firstChoice, setFirstChoice] = React.useState<FirstMomentChoice | null>(null);
  React.useEffect(() => {
    if (!firstMomentAvailable) return;
    let live = true;
    void readFirstMomentChoice().then((c) => { if (live) setFirstChoice(c); });
    return () => { live = false; };
  }, [firstMomentAvailable]);
  const firstCard =
    firstMomentAvailable && !props.fixtureMoments
      ? firstMomentCard(firstChoice, { hydrated: store.hydrated, count: store.moments.length })
      : null;
  const source =
    props.sourceLabel && props.sourceFetchedAtMs
      ? `${props.sourceLabel} · ${homeClock(new Date(props.sourceFetchedAtMs))}`
      : props.sourceLabel;

  return (
    <HomeCinematic
      dateLine={homeDateLine(props.now)}
      greeting={homeGreeting(props.now, props.firstName)}
      profileEntry={props.profileEntry}
      // The Moment's World photograph: internal builds only, else no photo.
      photo={worldPhotoForMoment(next)}
      momentEyebrow={hero.eyebrow}
      momentTitle={hero.title}
      momentStatus={hero.status}
      onPressMoment={() => router.push(hero.target === 'moments' ? '/moments-tab' : '/one-breath')}
      statusLine={homeStatusLine(data.hydrated ? data.surfaced : [], next)}
      ring={ring}
      ringAccessibilityLabel={
        ring.label === 'Collecting' ? 'HydroState. Collecting.' : `HydroState ${ring.value} out of 100`
      }
      moveTitle={props.moveTitle}
      intakeNote={homeIntakeNote(props.consumedOz, props.targetOz, props.lastLoggedAt)}
      readingNote={ring.label === 'HydroState' ? props.confidenceLine : undefined}
      logLabel={props.logLabel}
      onLog={props.onLog}
      logBusy={props.logBusy}
      scanLabel={t('hydration.v2.scan_a_drink')}
      onScan={() => router.push('/scan')}
      why={props.why}
      sourceLine={source}
      notice={props.notice}
    >
      <HomeFirstMomentCard card={firstCard} onPlan={() => router.push('/one-breath')} />
      <HomeMomentCards
        before={beforeCard}
        back={returnCard}
        onOpen={(id) => router.push(`/moment/${id}`)}
        onSkipReturn={(id) => setSkippedReturns((prev) => new Set(prev).add(id))}
      />
      {props.children}
    </HomeCinematic>
  );
}
