/**
 * What AFORCE remembers — container. Reads the member's lessons and their
 * answered Replays from this device and hands them to the view.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  deleteAllLessons,
  deleteLesson,
  editLesson,
  hydrateMomentLessons,
  releaseLessonFromReplay,
  setLearningOn,
  setLessonOn,
  useMomentLessons,
} from '@/services/momentLessons';
import { commitReviewedMoment, hydrateMoments, useMomentsStore } from '@/services/momentsStore';
import type { Moment } from '@/types/moments';
import { lessonRows, replayRows } from '@/utils/lessonPresentation';

import { RemembersView } from './RemembersView';

const transaction = () => `replay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** The same Moment with its Replay answer removed. Nothing else changes:
 * the plan, its seal and its Return stay exactly as they were. */
export function withoutReplay(moment: Moment): Moment {
  if (!moment.preparation) return moment;
  const { replay: _r, replayObstacle: _o, replayNote: _n, ...rest } = moment.preparation;
  return { ...moment, preparation: { ...rest, transactionId: transaction() } };
}

export function RemembersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const lessons = useMomentLessons();
  const store = useMomentsStore();
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    void hydrateMomentLessons();
    void hydrateMoments();
  }, []);

  const removeReplays = async (ids: readonly string[]): Promise<boolean> => {
    let ok = true;
    for (const id of ids) {
      const moment = store.moments.find((m) => m.id === id);
      if (!moment?.preparation?.replay) continue;
      try {
        await commitReviewedMoment(withoutReplay(moment), moment);
      } catch {
        ok = false;
      }
    }
    return ok;
  };

  const replays = replayRows(store.moments, lessons.lessons, t('moments.private_event'));

  return (
    <RemembersView
      backLabel="Back"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
      learningOn={lessons.learningOn}
      onLearning={setLearningOn}
      lessons={lessonRows(lessons.lessons)}
      onLessonOn={setLessonOn}
      onLessonEdit={(id, text) => editLesson(id, text, new Date().toISOString())}
      onLessonDelete={deleteLesson}
      replays={replays}
      onReplayDelete={(id, keepLesson) => {
        setError('');
        void removeReplays([id]).then((ok) => {
          // The lesson is only released once the Replay is really gone.
          if (ok) releaseLessonFromReplay(id, keepLesson);
          else setError('That Replay could not be deleted. Try again.');
        });
      }}
      onDeleteAll={() => {
        setError('');
        deleteAllLessons();
        void removeReplays(replays.map((r) => r.id)).then((ok) => {
          if (!ok) setError('Some Replays could not be deleted. Try again.');
        });
      }}
      error={error}
    />
  );
}
