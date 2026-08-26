/**
 * OrbSection — Status Pulse Orb + prediction strip OR 24h empty-state.
 *
 * The empty-state ("No intake in 24h — log a drink to start") is driven
 * by `IntakeSlice.noRecentIntake`, which is derived from the count of
 * intake events whose `loggedAt` falls inside the last 24h window.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Icon } from '../Icon';
import { hapticSelection } from '@/services/haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../../theme/colors';
import { StatusPulseOrb } from '../StatusPulseOrb';
import { useEngineSlice, useIntakeSlice } from '../../store/slices';
import { useDisplayedAccent } from '../../hooks/useDisplayedAccent';
import {
  getPlaybackState,
  subscribePlayback,
  type PlaybackState,
} from '../../services/voice/commandVoiceBus';
import { useRecoverySnapshotFromStore } from '../../services/useRecoverySnapshot';
import { emit } from '../../analytics/event_dispatcher';
import { MODE_RECOVERY_SCORE } from '../../utils/modes/smartModes';

interface Props {
  onOpenBreakdown: () => void;
  orbSize: number;
}

function OrbSectionImpl({ onOpenBreakdown, orbSize }: Props) {
  const { t } = useTranslation();
  const engine = useEngineSlice();
  const intake = useIntakeSlice();
  // Prefer the displayed (in-flight) accent so the orb digit, ring,
  // glow, and prediction strip recolour on the same frame as every
  // other state-tinted element on the home screen. Falls back to the
  // engine's instantaneous accent when the provider isn't mounted.
  const displayed = useDisplayedAccent();
  // Ruling #5 (Recovery Mode tone): while Recovery Mode is active (score
  // below MODE_RECOVERY_SCORE), the orb ring/glow/digit and the
  // prediction strip shift from alarm-red to amber, and the orb's
  // visual dominance is softened so the Command reads as hero, not the
  // number. Gated on recoveryActive so normal mode is byte-identical.
  const recoveryActive = typeof engine.score === 'number' && engine.score < MODE_RECOVERY_SCORE;
  const recoveryAccent = recoveryActive
    ? { primary: Colors.states.RECOVERING.primary, glow: Colors.states.RECOVERING.glow }
    : undefined;
  const displayedAccentForOrb = recoveryAccent ?? (displayed ? { primary: displayed.primary, glow: displayed.glow } : undefined);
  const stateColor = recoveryAccent?.primary ?? displayed?.primary ?? engine.performanceState.color;

  const onTap = React.useCallback(() => {
    if (Platform.OS !== 'web') hapticSelection();
    onOpenBreakdown();
  }, [onOpenBreakdown]);

  const socialOverlay = engine.social?.active
    ? {
        alcoholLoad: Math.min(1, Math.max(0, (engine.social.alcoholMultiplier - 1) * 2)),
        unstable:
          engine.social.impairment.level === 'HIGH' ||
          engine.social.impairment.level === 'CRITICAL',
      }
    : undefined;

  // Track the voice engine's playback lifecycle so the orb can radiate
  // an extra halo while a command is being received or transmitted.
  const [playback, setPlayback] = React.useState<PlaybackState>(() => getPlaybackState());
  React.useEffect(() => subscribePlayback(setPlayback), []);
  const voiceActive = playback === 'received' || playback === 'playing';

  // Internal analytics pipeline (Task #39) — emit only on a REAL orb
  // performance-state transition (never on first mount). Consent-gated +
  // best-effort via the dispatcher.
  const prevLevel = React.useRef(engine.performanceState.level);
  React.useEffect(() => {
    const next = engine.performanceState.level;
    if (prevLevel.current !== next) {
      void emit('orb_state_changed', { from: prevLevel.current, to: next });
      prevLevel.current = next;
    }
  }, [engine.performanceState.level]);

  // Recovery Layer — null in production (flag default OFF). When on,
  // adds a small "RECOVERY · PRESSURE · TREND" strip beneath the
  // prediction line. Zero new pixels until the flag flips.
  const recovery = useRecoverySnapshotFromStore();
  const trendArrow =
    recovery?.trend === 'rising' ? '↑'
    : recovery?.trend === 'declining' ? '↓'
    : '·';

  return (
    <View style={styles.orbContainer}>
      <StatusPulseOrb
        pulseConfig={engine.pulseConfig}
        score={engine.score}
        burstAt={intake.lastIntakeBurstAt}
        onTap={onTap}
        size={orbSize}
        socialOverlay={socialOverlay}
        displayedAccent={displayedAccentForOrb}
        displayedScore={displayed?.displayedScore}
        voiceActive={voiceActive}
        deEmphasize={recoveryActive}
      />
      <Text style={styles.orbHint}>TAP ORB FOR FULL BREAKDOWN</Text>
      {intake.noRecentIntake ? (
        <View
          style={[
            styles.predictionStrip,
            { borderColor: `${Colors.text.muted}33`, backgroundColor: `${Colors.text.muted}14` },
          ]}
          testID="no-recent-intake"
          accessibilityLabel="No intake logged in the last 24 hours. Log a drink to start your day."
        >
          <Icon name="droplet" size={12} color={Colors.text.muted} />
          <Text style={[styles.predictionText, { color: Colors.text.secondary }]}>
            {t('home.no_recent_intake')}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.predictionStrip,
            { borderColor: `${stateColor}33`, backgroundColor: `${stateColor}10` },
          ]}
          testID="prediction-strip"
        >
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text style={[styles.predictionText, { color: stateColor }]}>
            {engine.prediction.label}
          </Text>
        </View>
      )}
      {recovery ? (
        <View
          style={[
            styles.recoveryStrip,
            { borderColor: `${stateColor}22` },
          ]}
          testID="recovery-strip"
          accessible
          accessibilityLabel={`Recovery ${recovery.recovery}. Pressure ${recovery.pressure}. Trend ${recovery.trend}.`}
        >
          <Text style={[styles.recoveryText, { color: Colors.text.secondary }]}>
            RECOVERY {recovery.recovery}  ·  PRESSURE {recovery.pressure}  {trendArrow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const OrbSection = React.memo(OrbSectionImpl);

const styles = StyleSheet.create({
  orbContainer: { alignItems: 'center', paddingVertical: 24, marginBottom: 8, overflow: 'visible' },
  orbHint: {
    fontSize: 8, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2.5,
    marginTop: 12, opacity: 0.45,
  },
  predictionStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  predictionText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  recoveryStrip: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  recoveryText: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.6,
  },
});
