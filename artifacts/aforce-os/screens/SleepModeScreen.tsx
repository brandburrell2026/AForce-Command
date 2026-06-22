/**
 * SLEEP MODE — Phase 1.
 *
 * Purpose: connect pre-sleep hydration behavior to overnight recovery
 * outcomes. Water only. No product in Phase 1.
 *
 * Phase 1 surfaces:
 *   • Pre-sleep window  — triggers 90 min before the user's set sleep
 *     time. Command: "Drink 12–16oz water now." Countdown to recovery
 *     window opening (60 min before sleep).
 *   • Morning-after card — one sentence only, derived from
 *     `sleepHoursLastNight` vs. a 7-night rolling average. No charts,
 *     no causal claims.
 *   • Set-sleep-time row — local-only, persisted via AsyncStorage.
 *
 * Sleep weight in Recovery Capacity is held at 5–10% in Phase 1.
 * Hydration remains the primary driver always. This screen does NOT
 * mutate Recovery Capacity — the existing recoveryCapacity engine
 * stays the source of truth.
 *
 * Compliance vocabulary: supports / assists / may help support /
 * recovery guidance / hydration guidance ONLY. No cures, treats,
 * prevents, medical claims, or diagnosis language.
 *
 * Health platform integration: Phase 1 reads
 * `userState.sleepHoursLastNight` which is already populated by the
 * existing Apple Health (iOS) and Google Health Connect (Android)
 * provider bridge. No new platform code in Phase 1.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GradientBackground } from '@/components/GradientBackground';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { useUserSlice, useFlagsSlice } from '@/store/slices';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';

const SLEEP_TIME_KEY = '@aforce/sleepMode/targetTimeHHMM';
const SEVEN_NIGHT_KEY = '@aforce/sleepMode/sevenNightAvg';
const PRE_SLEEP_LEAD_MIN = 90;
const RECOVERY_WINDOW_LEAD_MIN = 60;
const LIME = '#C1281B';

type Phase = 'idle' | 'pre_sleep' | 'recovery_window' | 'morning';

interface ParsedTime { h: number; m: number }

function parseHHMM(s: string | null | undefined): ParsedTime | null {
  if (!s) return null;
  // Accepts both 24-hour ("23:00") and regular 12-hour ("11:00 PM") input.
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (!(min >= 0 && min <= 59)) return null;
  if (ap) {
    if (!(h >= 1 && h <= 12)) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  } else if (!(h >= 0 && h <= 23)) {
    return null;
  }
  return { h, m: min };
}

/** 24-hour HH:MM — used only for persistence so storage stays unambiguous. */
function formatHHMM(t: ParsedTime): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
}

/** Regular 12-hour clock with AM/PM — used for everything the user sees. */
function format12(t: ParsedTime): string {
  const ap = t.h >= 12 ? 'PM' : 'AM';
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${h12}:${String(t.m).padStart(2, '0')} ${ap}`;
}

/** Minutes from `now` until the next occurrence of HH:MM (today or tomorrow). */
function minutesUntilNext(target: ParsedTime, now: Date): number {
  const next = new Date(now);
  next.setHours(target.h, target.m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return Math.round((next.getTime() - now.getTime()) / 60000);
}

function derivePhase(minsUntil: number, hour: number): Phase {
  if (hour >= 5 && hour < 11) return 'morning';
  if (minsUntil <= RECOVERY_WINDOW_LEAD_MIN) return 'recovery_window';
  if (minsUntil <= PRE_SLEEP_LEAD_MIN) return 'pre_sleep';
  return 'idle';
}

function morningSentence(lastNight: number | null | undefined, avg: number | null): string {
  if (!Number.isFinite(lastNight ?? NaN) || lastNight == null) {
    return 'Sleep data not detected last night. Hydration guidance continues as usual.';
  }
  if (avg == null || !Number.isFinite(avg)) {
    return 'Recovery trend appeared steady overnight.';
  }
  const delta = lastNight - avg;
  if (delta >= 0.3) return 'Recovery trend appeared stronger than your recent average.';
  if (delta <= -0.3) return 'Recovery trend appeared lighter than your recent average.';
  return 'Recovery trend appeared in line with your recent average.';
}

export default function SleepModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUserSlice();
  const flags = useFlagsSlice();

  const [target, setTarget] = React.useState<ParsedTime | null>({ h: 23, m: 0 });
  const [draft, setDraft] = React.useState('23:00');
  const [editing, setEditing] = React.useState(false);
  const [sevenNightAvg, setSevenNightAvg] = React.useState<number | null>(null);
  const [demoPhase, setDemoPhase] = React.useState<Phase | null>(null);
  const [now, setNow] = React.useState<Date>(() => new Date());

  // Tick the clock once a minute so the countdown updates without
  // forcing a heavier subscription.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Hydrate persisted target time + rolling 7-night average on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedTime, storedAvg] = await Promise.all([
          AsyncStorage.getItem(SLEEP_TIME_KEY),
          AsyncStorage.getItem(SEVEN_NIGHT_KEY),
        ]);
        if (cancelled) return;
        const parsed = parseHHMM(storedTime);
        if (parsed) {
          setTarget(parsed);
          setDraft(format12(parsed));
        }
        if (storedAvg) {
          const n = Number(storedAvg);
          if (Number.isFinite(n)) setSevenNightAvg(n);
        }
      } catch { /* storage unavailable — keep defaults */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // `sleepHoursLastNight` lives on the provider biometric snapshot,
  // not directly on UserState. Apple Health populates it on iOS;
  // Google Health Connect (which aggregates Samsung Health and the
  // other Android sources) populates it on Android. Either feeds
  // `user.appleHealth` and the aggregated `user.biometrics` blob;
  // we accept whichever lands first.
  const sleepLastNight: number | null = React.useMemo(() => {
    const fromApple = user.appleHealth?.sleepHoursLastNight;
    if (fromApple != null && Number.isFinite(fromApple)) return fromApple;
    // Freshest-wins across all provider snapshots that carry a sleep value.
    const bio = user.biometrics;
    if (!bio) return null;
    let best: { v: number; at: number } | null = null;
    for (const snap of Object.values(bio)) {
      const v = snap?.sleepHoursLastNight;
      if (v == null || !Number.isFinite(v)) continue;
      const at = snap?.fetchedAt ?? 0;
      if (!best || at > best.at) best = { v, at };
    }
    return best?.v ?? null;
  }, [user.appleHealth, user.biometrics]);

  // Roll last-night sleep into the 7-night average whenever it lands.
  // EMA with alpha=1/7 keeps storage trivial and avoids a session list.
  React.useEffect(() => {
    const last = sleepLastNight;
    if (!Number.isFinite(last ?? NaN) || last == null) return;
    setSevenNightAvg((prev) => {
      const next = prev == null ? last : prev + (last - prev) / 7;
      AsyncStorage.setItem(SEVEN_NIGHT_KEY, String(next)).catch(() => {});
      return next;
    });
  }, [sleepLastNight]);

  const commitTarget = React.useCallback(() => {
    const parsed = parseHHMM(draft);
    if (!parsed) {
      // Reject invalid input: revert draft to last good value.
      setDraft(target ? format12(target) : '11:00 PM');
      setEditing(false);
      return;
    }
    setTarget(parsed);
    setEditing(false);
    AsyncStorage.setItem(SLEEP_TIME_KEY, formatHHMM(parsed)).catch(() => {});
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [draft, target]);

  const minsUntil = target ? minutesUntilNext(target, now) : Number.POSITIVE_INFINITY;
  const livePhase = derivePhase(minsUntil, now.getHours());
  const phase: Phase = demoPhase ?? livePhase;

  const minsToWindowOpen = Math.max(0, minsUntil - RECOVERY_WINDOW_LEAD_MIN);

  const sentence = morningSentence(sleepLastNight, sevenNightAvg);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  // Honor the public/internal kill switch. We still render the screen
  // if the user reached it directly (so internal QA can poke at it),
  // but a banner makes the gated state explicit.
  const gated = !flags.sleep_mode_enabled;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <Icon name="chevron-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <Text style={styles.eyebrow}>SLEEP MODE</Text>
            <View style={{ width: 22 }} />
          </View>

          {gated ? (
            <View style={styles.gatedBanner}>
              <Text style={styles.gatedText}>
                INTERNAL PREVIEW — sleep_mode_enabled is off for the public build.
              </Text>
            </View>
          ) : null}

          {/* Phase card */}
          {phase === 'idle' ? (
            <Section label="STATUS">
              <Text style={styles.statusHeadline}>Idle</Text>
              <Text style={styles.statusBody}>
                Pre-sleep protocol begins {PRE_SLEEP_LEAD_MIN} minutes before your set sleep time.
              </Text>
            </Section>
          ) : null}

          {phase === 'pre_sleep' ? (
            <Section label="PRE-SLEEP PROTOCOL">
              <Text style={styles.statusHeadline}>Drink 12–16oz of water now.</Text>
              <Text style={styles.statusBody}>
                Your recovery window opens in {minsToWindowOpen} minutes.
              </Text>
            </Section>
          ) : null}

          {phase === 'recovery_window' ? (
            <Section label="RECOVERY WINDOW">
              <Text style={styles.statusHeadline}>Recovery window open.</Text>
              <Text style={styles.statusBody}>
                Hydration may help support overnight recovery. Lights down. Devices away.
              </Text>
            </Section>
          ) : null}

          {phase === 'morning' ? (
            <Section label="LAST NIGHT">
              <Text style={styles.statusHeadline}>{sentence}</Text>
              <Text style={styles.statusBody}>
                Sleep guidance is informational only and supports — does not replace — your usual routine.
              </Text>
            </Section>
          ) : null}

          {/* Sleep target row */}
          <Section label="SLEEP TARGET">
            {editing ? (
              <View style={styles.timeRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="h:mm AM/PM"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                  style={styles.timeInput}
                  maxLength={8}
                  onSubmitEditing={commitTarget}
                  accessibilityLabel="Sleep target time (12-hour, e.g. 11:00 PM)"
                />
                <Pressable
                  onPress={commitTarget}
                  style={({ pressed }) => [styles.timeSave, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.timeSaveText}>SAVE</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setEditing(true)}
                style={styles.timeRow}
                accessibilityRole="button"
                accessibilityLabel={`Edit sleep target time, currently ${target ? format12(target) : 'unset'}`}
              >
                <Text style={styles.timeDisplay}>{target ? format12(target) : '—:—'}</Text>
                <Text style={styles.timeHint}>TAP TO EDIT</Text>
              </Pressable>
            )}
            {target ? (
              <Text style={styles.targetSub}>
                Next protocol trigger in {Math.max(0, minsUntil - PRE_SLEEP_LEAD_MIN)} minutes.
              </Text>
            ) : null}
          </Section>

          {/* Health source row (informational; provider bridge feeds the value) */}
          <Section label="HEALTH SOURCE">
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>
                {Platform.OS === 'ios' ? 'APPLE HEALTH' : 'GOOGLE HEALTH CONNECT'}
              </Text>
              {sleepLastNight != null ? (
                <Text style={styles.healthValue}>
                  {`${sleepLastNight.toFixed(1)}h last night`}
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Connect Journal"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push('/(tabs)/journal');
                  }}
                  hitSlop={8}>
                  <Text style={[styles.healthValue, styles.healthValueLink]}>
                    Waiting for recovery signals. Connect Journal.
                  </Text>
                </Pressable>
              )}
            </View>
            {sevenNightAvg != null ? (
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>7-NIGHT AVG</Text>
                <Text style={styles.healthValue}>{sevenNightAvg.toFixed(1)}h</Text>
              </View>
            ) : null}
            <Text style={styles.complianceFinePrint}>
              Sleep weight in Recovery Capacity is held at 5–10% in Phase 1.
              Hydration remains the primary driver.
            </Text>
          </Section>

          {/* Demo cycler */}
          <View style={styles.demoWrap}>
            {(['idle', 'pre_sleep', 'recovery_window', 'morning'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setDemoPhase((cur) => (cur === p ? null : p))}
                style={({ pressed }) => [
                  styles.demoChip,
                  demoPhase === p && { borderColor: LIME, backgroundColor: 'rgba(193,40,27,0.12)' },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${p} phase`}
              >
                <Text style={[
                  styles.demoChipText,
                  demoPhase === p && { color: LIME },
                ]}>
                  {p.replace('_', ' ').toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Compliance disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Sleep Mode provides hydration and recovery guidance only. It supports —
              and does not replace — your normal sleep, medical, or wellness routine.
              It is not a diagnostic or medical tool.
            </Text>
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const BORDER = 'rgba(255,255,255,0.06)';
const FAINT  = 'rgba(255,255,255,0.5)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { paddingHorizontal: 22, gap: 22 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 11, letterSpacing: 3, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  gatedBanner: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(245,165,36,0.4)',
    backgroundColor: 'rgba(245,165,36,0.08)',
  },
  gatedText: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.6,
    color: '#F5A524',
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 2.4, color: FAINT,
    fontFamily: 'Inter_700Bold',
  },
  sectionBody: {
    paddingVertical: 18, paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 8,
  },
  statusHeadline: {
    fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24,
    color: Colors.text.primary,
  },
  statusBody: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18,
    color: Colors.text.secondary,
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12,
  },
  timeDisplay: {
    fontFamily: 'Inter_700Bold', fontSize: 36, letterSpacing: -0.5,
    color: Colors.text.primary,
  },
  timeHint: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: FAINT,
  },
  timeInput: {
    flex: 1,
    fontFamily: 'Inter_700Bold', fontSize: 36, letterSpacing: -0.5,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  timeSave: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100,
    borderWidth: 1, borderColor: `${LIME}66`,
    backgroundColor: `${LIME}14`,
  },
  timeSaveText: {
    fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2,
    color: LIME,
  },
  targetSub: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: Colors.text.secondary,
  },
  healthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  healthLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8,
    color: FAINT,
  },
  healthValue: {
    fontFamily: 'Inter_500Medium', fontSize: 14,
    color: Colors.text.primary,
  },
  healthValueLink: {
    color: LIME,
    textDecorationLine: 'underline',
  },
  complianceFinePrint: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15,
    color: FAINT,
  },
  demoWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center',
  },
  demoChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  demoChipText: {
    fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.6,
    color: FAINT,
  },
  disclaimer: {
    padding: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  disclaimerText: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: FAINT,
  },
});
