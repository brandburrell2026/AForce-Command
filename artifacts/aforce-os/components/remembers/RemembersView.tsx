/**
 * What AFORCE remembers — the approved prototype's page, for Phase 1.
 *
 * Presentational only: it draws what it is given and reports taps. The
 * member's lessons (review, edit, pause, delete), the Replays they answered,
 * and the Learning switch. Every destructive action asks once, in place.
 *
 * Not drawn, because nothing real is behind them yet: voice words,
 * shortcuts, and "Download a copy".
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { AFScreen } from '@/components/ui';
import { MOMENT_LESSON_TEXT_MAX } from '@/config/hydroStateModel';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import type { LessonRow, ReplayRow } from '@/utils/lessonPresentation';

const MONO = 'IBMPlexMono_400Regular';
const GUTTER = 20;

export interface RemembersViewProps {
  backLabel: string;
  onBack: () => void;
  learningOn: boolean;
  onLearning: (on: boolean) => void;
  lessons: readonly LessonRow[];
  onLessonOn: (id: string, on: boolean) => void;
  /** Returns false when the new wording was not kept (blank). */
  onLessonEdit: (id: string, text: string) => boolean;
  onLessonDelete: (id: string) => void;
  replays: readonly ReplayRow[];
  /** `keepLesson` only matters when the Replay made a lesson. */
  onReplayDelete: (id: string, keepLesson: boolean) => void;
  onDeleteAll: () => void;
  /** Said once after something could not be saved. */
  error?: string;
}

type Asking =
  | { kind: 'lesson'; id: string }
  | { kind: 'replay'; id: string }
  | { kind: 'all' }
  | null;

function Pill({
  label,
  onPress,
  filled,
  danger,
  a11y,
  testID,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  danger?: boolean;
  a11y: string;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={({ pressed }) => [styles.pill, filled && styles.pillFilled, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={[styles.pillText, filled && styles.pillTextFilled, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

export function RemembersView(props: RemembersViewProps) {
  const [asking, setAsking] = React.useState<Asking>(null);
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);

  const confirm = (line: string, actions: React.ReactNode, testID: string) => (
    <View style={styles.confirm} accessibilityRole="alert" aria-live="polite" testID={testID}>
      <Text style={styles.confirmText}>{line}</Text>
      <View style={styles.pills}>{actions}</View>
    </View>
  );
  const cancel = (id: string) => (
    <Pill label="Cancel" a11y="Cancel" onPress={() => setAsking(null)} testID={`${id}-cancel`} />
  );

  return (
    <AFScreen scroll padded={false} contentContainerStyle={styles.content} testID="remembers-screen">
      <View style={styles.topRow}>
        <Pressable
          onPress={props.onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.back}
          testID="remembers-back"
        >
          <Icon name="chevron-left" size={18} color={af.textPrimary} />
          <Text style={styles.backText}>{props.backLabel}</Text>
        </Pressable>
        <Text style={styles.eyebrow}>PRIVATE · ONLY YOU</Text>
      </View>

      <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
        What AFORCE remembers
      </Text>
      <Text style={styles.sub}>
        Only what you approved. Kept on this phone. Nothing here is shared, sold, or used for ads or analytics.
      </Text>

      {props.error ? (
        <Text style={[styles.sub, styles.danger]} accessibilityRole="alert" testID="remembers-error">
          {props.error}
        </Text>
      ) : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Learning</Text>
            <Text style={styles.rowSub}>
              {props.learningOn
                ? 'On · after a Replay you can write a rule for next time'
                : 'Off · Replay saves notes only. Your lessons are kept and not used'}
            </Text>
          </View>
          <Pressable
            onPress={() => props.onLearning(!props.learningOn)}
            accessibilityRole="switch"
            accessibilityState={{ checked: props.learningOn }}
            aria-checked={props.learningOn}
            accessibilityLabel="Learning"
            hitSlop={8}
            style={({ pressed }) => [styles.pill, props.learningOn && styles.pillFilled, pressed && styles.pressed]}
            testID="remembers-learning"
          >
            <Text style={[styles.pillText, props.learningOn && styles.pillTextFilled]}>
              {props.learningOn ? 'On' : 'Off'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.section}>LESSONS</Text>
      {props.lessons.length === 0 ? (
        <View style={[styles.card, styles.empty]} testID="remembers-lessons-empty">
          <Text style={styles.rowSub}>Nothing yet. Write a rule after a Replay and it shows up here.</Text>
        </View>
      ) : (
        <View style={styles.card} testID="remembers-lessons">
          {props.lessons.map((l, i) => {
            const last = i === props.lessons.length - 1;
            const isEditing = editing?.id === l.id;
            const isAsking = asking?.kind === 'lesson' && asking.id === l.id;
            return (
              <View key={l.id} style={[styles.item, !last && styles.ruled]} testID={`remembers-lesson-${l.id}`}>
                {isEditing ? (
                  <>
                    <TextInput
                      accessibilityLabel="Your lesson"
                      value={editing.text}
                      onChangeText={(text) => setEditing({ id: l.id, text })}
                      maxLength={MOMENT_LESSON_TEXT_MAX}
                      multiline
                      autoFocus
                      placeholderTextColor={af.textTertiary}
                      style={styles.input}
                      testID={`remembers-lesson-${l.id}-input`}
                    />
                    <View style={styles.pills}>
                      <Pill
                        label="Approve"
                        filled
                        a11y="Approve this wording"
                        onPress={() => {
                          if (props.onLessonEdit(l.id, editing.text)) setEditing(null);
                        }}
                        testID={`remembers-lesson-${l.id}-save`}
                      />
                      <Pill label="Cancel" a11y="Cancel" onPress={() => setEditing(null)} testID={`remembers-lesson-${l.id}-edit-cancel`} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.lessonText, !l.on && styles.paused]}>{l.text}</Text>
                    <Text style={styles.rowSub}>{l.meta}</Text>
                    {isAsking ? (
                      confirm(
                        'Delete this lesson? This cannot be undone.',
                        <>
                          <Pill
                            label="Delete"
                            danger
                            a11y="Delete this lesson"
                            onPress={() => {
                              setAsking(null);
                              props.onLessonDelete(l.id);
                            }}
                            testID={`remembers-lesson-${l.id}-delete-yes`}
                          />
                          {cancel(`remembers-lesson-${l.id}-delete`)}
                        </>,
                        `remembers-lesson-${l.id}-confirm`,
                      )
                    ) : (
                      <View style={styles.pills}>
                        <Pill
                          label={l.on ? 'Pause' : 'Resume'}
                          filled={l.on}
                          a11y={`${l.on ? 'Pause' : 'Resume'} lesson: ${l.text}`}
                          onPress={() => props.onLessonOn(l.id, !l.on)}
                          testID={`remembers-lesson-${l.id}-toggle`}
                        />
                        <Pill
                          label="Edit"
                          a11y={`Edit lesson: ${l.text}`}
                          onPress={() => {
                            setAsking(null);
                            setEditing({ id: l.id, text: l.text });
                          }}
                          testID={`remembers-lesson-${l.id}-edit`}
                        />
                        <Pill
                          label="Delete"
                          a11y={`Delete lesson: ${l.text}`}
                          onPress={() => {
                            setEditing(null);
                            setAsking({ kind: 'lesson', id: l.id });
                          }}
                          testID={`remembers-lesson-${l.id}-delete`}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text accessibilityRole="header" style={styles.section}>YOUR REPLAYS</Text>
      {props.replays.length === 0 ? (
        <View style={[styles.card, styles.empty]} testID="remembers-replays-empty">
          <Text style={styles.rowSub}>No Replays saved. Skipped Replays leave nothing behind.</Text>
        </View>
      ) : (
        <View style={styles.card} testID="remembers-replays">
          {props.replays.map((r, i) => {
            const last = i === props.replays.length - 1;
            const isAsking = asking?.kind === 'replay' && asking.id === r.id;
            return (
              <View key={r.id} style={[styles.item, !last && styles.ruled]} testID={`remembers-replay-${r.id}`}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                {r.said ? <Text style={styles.rowSub}>{r.said}</Text> : null}
                {isAsking ? (
                  r.hasLesson ? (
                    confirm(
                      'This Replay made a lesson. Delete both, or keep the lesson as your own rule?',
                      <>
                        <Pill
                          label="Delete both"
                          danger
                          a11y="Delete the Replay and its lesson"
                          onPress={() => {
                            setAsking(null);
                            props.onReplayDelete(r.id, false);
                          }}
                          testID={`remembers-replay-${r.id}-delete-both`}
                        />
                        <Pill
                          label="Keep the lesson"
                          a11y="Delete the Replay and keep the lesson as your own rule"
                          onPress={() => {
                            setAsking(null);
                            props.onReplayDelete(r.id, true);
                          }}
                          testID={`remembers-replay-${r.id}-keep-lesson`}
                        />
                        {cancel(`remembers-replay-${r.id}-delete`)}
                      </>,
                      `remembers-replay-${r.id}-confirm`,
                    )
                  ) : (
                    confirm(
                      'Delete this Replay? Your answer is removed from this phone.',
                      <>
                        <Pill
                          label="Delete"
                          danger
                          a11y="Delete this Replay"
                          onPress={() => {
                            setAsking(null);
                            props.onReplayDelete(r.id, false);
                          }}
                          testID={`remembers-replay-${r.id}-delete-yes`}
                        />
                        {cancel(`remembers-replay-${r.id}-delete`)}
                      </>,
                      `remembers-replay-${r.id}-confirm`,
                    )
                  )
                ) : (
                  <View style={styles.pills}>
                    <Pill
                      label="Delete"
                      a11y={`Delete Replay: ${r.title}`}
                      onPress={() => setAsking({ kind: 'replay', id: r.id })}
                      testID={`remembers-replay-${r.id}-delete`}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.note}>
        Lessons belong only to you. Your Circle never sees them, and signing in to another account never
        carries them over. They change no hydration target, score or reminder.
      </Text>

      {props.lessons.length > 0 || props.replays.length > 0 ? (
        <View style={styles.card}>
          {asking?.kind === 'all' ? (
            <View style={styles.item}>
              {confirm(
                'Delete every lesson and every Replay answer on this phone? This cannot be undone.',
                <>
                  <Pill
                    label="Delete everything"
                    danger
                    a11y="Delete every lesson and Replay answer"
                    onPress={() => {
                      setAsking(null);
                      setEditing(null);
                      props.onDeleteAll();
                    }}
                    testID="remembers-delete-all-yes"
                  />
                  {cancel('remembers-delete-all')}
                </>,
                'remembers-delete-all-confirm',
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => setAsking({ kind: 'all' })}
              accessibilityRole="button"
              accessibilityLabel="Delete everything AFORCE remembers"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID="remembers-delete-all"
            >
              <Text style={[styles.rowTitle, styles.danger]}>Delete everything AFORCE remembers</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 22 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 34, lineHeight: 38, letterSpacing: -0.9, color: af.textPrimary, marginBottom: 8 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: af.textSecondary, marginBottom: 14 },
  section: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary, marginTop: 20, marginBottom: 6 },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 18 },
  empty: { paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: af.textPrimary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  item: { paddingVertical: 14, gap: 8 },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider },
  lessonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: af.textPrimary },
  paused: { color: af.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: af.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFilled: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: af.textPrimary },
  pillTextFilled: { color: af.onPrimaryFill },
  pressed: { opacity: 0.72 },
  danger: { color: af.red },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: af.textPrimary,
    minHeight: 72,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  confirm: { gap: 10 },
  confirmText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, color: af.textSecondary, marginTop: 14, marginBottom: 14 },
});
