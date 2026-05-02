/**
 * VoiceStatusModule — AForce Command Voice Engine status card.
 *
 * Premium command-center surface that lives on Home. Surfaces:
 *   - Live indicator + canonical engine name eyebrow.
 *   - 3-up status grid: Voice (on/scope) | Risk State | Intensity.
 *   - Last spoken line with relative timestamp + category badge.
 *   - Full-width Replay button (disabled until the engine has spoken).
 *
 * The card subscribes to the commandVoiceBus so it re-renders the
 * moment a new line lands — without polling. Color-tunes by the
 * current performance state so it harmonises with the orb / timer.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '../theme/colors';
import { useEngineSlice } from '../store/slices';
import { useAppStore } from '../store/useAppStore';
import {
  BRAND_LANGUAGE,
  scoreBand,
  type ScoreBand,
  type VoiceIntensity,
  type VoiceScope,
} from '../services/voice/commandVoice';
import {
  getLastCommand,
  replayLastCommand,
  subscribe,
  type SpokenCommand,
} from '../services/voice/commandVoiceBus';

const BAND_LABELS: Record<ScoreBand, string> = {
  PEAK:     'PEAK',
  STABLE:   'STABLE',
  CORRECT:  'CORRECT',
  RISK:     'RISK',
  CRITICAL: 'CRITICAL',
};

const BAND_ACCENT: Record<ScoreBand, string> = {
  PEAK:     Colors.states.PEAK.primary,
  STABLE:   Colors.states.BALANCED.primary,
  CORRECT:  Colors.states.BALANCED.primary,
  RISK:     Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

const INTENSITY_LABEL: Record<VoiceIntensity, string> = {
  calm:     'CALM',
  standard: 'STANDARD',
  pressure: 'PRESSURE',
};

const SCOPE_LABEL: Record<VoiceScope, string> = {
  all:      'ALL',
  risk:     'RISK ONLY',
  commands: 'CMDS ONLY',
  muted:    'MUTED',
};

const CATEGORY_LABEL: Record<NonNullable<SpokenCommand['category']>, string> = {
  score_band:     'SCORE BAND',
  risk_timer:     'RISK TIMER',
  system_command: 'PERFORMANCE COMMAND',
  completion:     'CYCLE COMPLETE',
};

function formatRelative(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function VoiceStatusModuleImpl() {
  const engine = useEngineSlice();
  const { voiceCoachEnabled, voiceIntensity, voiceScope } = useAppStore();

  // Re-render whenever the bus speaks a new line.
  const [last, setLast] = React.useState<SpokenCommand | null>(() => getLastCommand());
  React.useEffect(() => subscribe(setLast), []);

  // Tick once a minute so the relative timestamp stays fresh without
  // wasting render budget on a per-second clock.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const band = scoreBand(engine.score);
  const bandLabel = BAND_LABELS[band];
  const bandAccent = BAND_ACCENT[band];

  const isLive = voiceCoachEnabled && voiceScope !== 'muted';
  const liveAccent = isLive ? Colors.states.PEAK.primary : Colors.text.muted;

  const replayDisabled = !last || !isLive;
  const onReplay = React.useCallback(() => {
    replayLastCommand();
  }, []);

  return (
    <View
      style={[
        styles.card,
        { borderColor: `${bandAccent}33` },
      ]}
      testID="voice-status-module"
    >
      {/* Eyebrow row — engine name + live dot */}
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: liveAccent, shadowColor: liveAccent },
            ]}
          />
          <Text style={styles.eyebrow}>
            {BRAND_LANGUAGE.engineName.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.liveTag, { color: liveAccent }]}>
          {isLive ? 'LIVE' : 'OFF'}
        </Text>
      </View>

      {/* 3-up status grid */}
      <View style={styles.grid}>
        <View style={styles.gridCell}>
          <Text style={styles.cellLabel}>VOICE</Text>
          <Text
            style={[
              styles.cellValue,
              { color: isLive ? Colors.text.primary : Colors.text.muted },
            ]}
          >
            {voiceCoachEnabled ? 'ON' : 'OFF'}
          </Text>
          <Text style={styles.cellSub}>{SCOPE_LABEL[voiceScope]}</Text>
        </View>
        <View style={[styles.gridCell, styles.gridCellMid]}>
          <Text style={styles.cellLabel}>{BRAND_LANGUAGE.riskState.toUpperCase()}</Text>
          <Text style={[styles.cellValue, { color: bandAccent }]}>{bandLabel}</Text>
          <Text style={styles.cellSub}>SCORE {Math.round(engine.score)}</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.cellLabel}>INTENSITY</Text>
          <Text
            style={[
              styles.cellValue,
              voiceIntensity === 'pressure' && { color: Colors.states.DEPLETED.primary },
            ]}
          >
            {INTENSITY_LABEL[voiceIntensity]}
          </Text>
          <Text style={styles.cellSub}>
            {voiceIntensity === 'pressure'
              ? BRAND_LANGUAGE.pressureMode.toUpperCase()
              : voiceIntensity === 'calm'
                ? 'MEASURED'
                : 'CONTROLLED'}
          </Text>
        </View>
      </View>

      {/* Last command */}
      <View style={styles.lastBlock}>
        <View style={styles.lastHeader}>
          <Text style={styles.lastEyebrow}>LAST COMMAND</Text>
          {last ? (
            <Text style={styles.lastMeta}>
              {CATEGORY_LABEL[last.category]} · {formatRelative(now - last.at)}
            </Text>
          ) : (
            <Text style={styles.lastMeta}>STANDBY</Text>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.lastLine,
            !last && { color: Colors.text.muted, fontStyle: 'italic' },
          ]}
        >
          {last?.line ?? 'Engine standing by. Awaiting performance event.'}
        </Text>
      </View>

      {/* Replay */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Replay last AForce voice command"
        accessibilityState={{ disabled: replayDisabled }}
        disabled={replayDisabled}
        onPress={onReplay}
        style={({ pressed }) => [
          styles.replayBtn,
          {
            borderColor: replayDisabled ? Colors.border.subtle : `${bandAccent}55`,
            backgroundColor: replayDisabled
              ? 'transparent'
              : pressed ? `${bandAccent}1A` : `${bandAccent}10`,
          },
        ]}
        testID="voice-status-replay"
      >
        <Text
          style={[
            styles.replayText,
            { color: replayDisabled ? Colors.text.muted : bandAccent },
          ]}
        >
          {replayDisabled ? 'NOTHING TO REPLAY' : 'REPLAY LAST COMMAND'}
        </Text>
      </Pressable>
    </View>
  );
}

export const VoiceStatusModule = React.memo(VoiceStatusModuleImpl);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    gap: 14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  liveTag: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: 0,
    paddingTop: 4,
  },
  gridCell: {
    flex: 1,
    gap: 4,
  },
  gridCellMid: {
    paddingHorizontal: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.subtle,
  },
  cellLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    color: Colors.text.muted,
  },
  cellValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
    color: Colors.text.primary,
  },
  cellSub: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: Colors.text.muted,
  },
  lastBlock: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
    gap: 6,
  },
  lastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastEyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.muted,
  },
  lastMeta: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    color: Colors.text.muted,
  },
  lastLine: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.primary,
  },
  replayBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  replayText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
