/**
 * Voice Overlay — the full-screen capture / response sheet.
 *
 * Owns the voice session lifecycle:
 *   1. Tap mic → start STT
 *   2. Tap again or stop → finalize transcript → classify → build response
 *   3. Render response card → execute side-effect (logIntake / navigate / etc.)
 *   4. Auto-dismiss after a short window
 *
 * Note: AI voice playback is globally disabled in `services/textToSpeech.ts`
 * (`VOICE_PLAYBACK_ENABLED = false`). The `speak()` calls below remain as
 * silent no-ops so this overlay continues to drive the visual prompt
 * pipeline without an audio response.
 *
 * No long dialogue. No conversation history. ONE command at a time.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
} from 'react-native';
import { AFModal } from './ui/AFModal';
import { Icon } from './Icon';
import { useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import { VoiceWaveform } from './VoiceWaveform';
import { useAppStore, useFeatureFlags } from '../store/useAppStore';
import {
  startSpeechRecognition, type STTHandle,
} from '../services/speechToText';
import { speak, stopSpeaking, VOICE_PLAYBACK_ENABLED } from '../services/textToSpeech';
import { processTranscript } from '../services/voiceService';
import { useProactiveCoach } from '../hooks/useProactiveCoach';
import { useAdaptiveResponse } from '../hooks/useAdaptiveResponse';
import { localDayKey } from '../utils/voiceCheckIn';
import type {
  VoiceCommandResponse, VoiceState, VoiceAction,
} from '../types/voice';

interface Props {
  visible: boolean;
  /**
   * If true, the overlay starts listening automatically the moment it opens.
   * Used when the Phantom Band emits a voice_trigger — per spec the band
   * trigger should put the app immediately into listening, not idle.
   */
  autoStart?: boolean;
  onClose: () => void;
  /** When true, skip the listening step and immediately show the demo result. */
  demoMode?: boolean;
}

const ACCENT_BY_STATE: Record<VoiceState, string> = {
  idle:       Colors.text.primary,
  listening:  Colors.states.PEAK.primary,
  processing: Colors.states.RECOVERING.primary,
  responding: Colors.states.BALANCED.primary,
  error:      Colors.states.DEPLETED.primary,
};

const STATE_LABEL_KEY: Record<VoiceState, string> = {
  idle:       'voice.tap_to_speak',
  listening:  'voice.listening',
  processing: 'voice.processing',
  responding: 'voice.responding',
  error:      'voice.try_again',
};

export function VoiceOverlay({ visible, onClose, autoStart = false, demoMode = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    state: appState,
    logIntake, updateSymptoms, confirmStatus,
    setSweatAutopilot,
    activateSocialMode, deactivateSocialMode,
  } = useAppStore();
  const flags = useFeatureFlags();
  // §64 rule 5 — the loaded Personal Response Library. Always computed (memoized,
  // read-only); only consumed when conversational_intelligence_enabled is ON, so
  // the reactive path is unchanged in the production binary.
  const adaptiveProfile = useAdaptiveResponse();

  // Section 64 — the proactive, speak-first coach line (null = stay silent, and
  // always null in production, where the flag is OFF).
  const proactive = useProactiveCoach();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [response, setResponse] = useState<VoiceCommandResponse | null>(null);
  // Remembers the last proactive line surfaced (spoken text + local day) so the
  // same value-moment never repeats within a day — the coach never nags.
  const proactiveShownKeyRef = useRef<string | null>(null);
  const sttRef = useRef<STTHandle | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonically-increasing session token so a stale timer can't finalize a
  // newer session if the user closes/reopens the overlay quickly.
  const sessionRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
  }, []);

  // Reset every time we open.
  useEffect(() => {
    if (visible) {
      sessionRef.current += 1;
      setVoiceState('idle');
      setResponse(null);
    } else {
      // Cancel any in-flight session on close.
      sessionRef.current += 1;
      sttRef.current?.cancel();
      sttRef.current = null;
      stopSpeaking();
      clearTimers();
    }
  }, [visible, clearTimers]);

  // Section 64 — surface the proactive coach line on open, while idle. Skipped
  // when auto-starting listening (band trigger) or in demo mode, and de-duped by
  // spoken text + day so a value-moment shows at most once per day. Inert in
  // production (the flag keeps `proactive` null). speak() is a no-op until voice
  // playback is enabled — the line still renders in the response card.
  useEffect(() => {
    if (!visible || autoStart || demoMode || voiceState !== 'idle' || !proactive) return;
    const key = `${proactive.spoken}::${localDayKey(new Date())}`;
    if (proactiveShownKeyRef.current === key) return;
    proactiveShownKeyRef.current = key;
    setResponse(proactive);
    void speak(proactive.spoken);
  }, [visible, autoStart, demoMode, voiceState, proactive]);

  /** Dispatch the side-effect declared by the orchestrator. */
  const executeAction = useCallback(async (action: VoiceAction) => {
    switch (action.type) {
      case 'LOG_INTAKE': {
        // silent=true so we don't stack the cycle-success hero modal on top
        // of the voice response card (RN-web only renders one Modal at a time).
        // ozOverride flows through to the engine so "log 12 oz of water"
        // logs exactly that, not the default per-serving size.
        const repeat = Math.max(1, Math.min(action.repeat ?? 1, 6));
        const opts: { silent: boolean; ozOverride?: number } = { silent: true };
        if (action.ozOverride !== undefined) opts.ozOverride = action.ozOverride;
        for (let i = 0; i < repeat; i++) {
          // Sequential awaits ensure the engine sees each intake atomically.
          // eslint-disable-next-line no-await-in-loop
          await logIntake(action.fluidType, opts);
        }
        return;
      }
      case 'COMPLETE_CYCLE':
        // Inline a silent intake instead of completeCycle() — the latter
        // calls logIntake without `silent: true`, which would stack the
        // CycleSuccessOverlay hero modal on top of the voice response card
        // (RN-web only renders one Modal at a time → the response would be
        // hidden behind the hero modal).
        await logIntake('aforce_stick', { silent: true });
        return;
      case 'UPDATE_SYMPTOMS':
        await updateSymptoms(action.symptoms);
        return;
      case 'CONFIRM_STATUS':
        await confirmStatus();
        return;
      case 'SET_AUTOPILOT':
        // The store wants a SweatAutopilot object (or null to disable).
        // Voice-triggered activation seeds a sensible default: 30-min
        // recheck cadence, moderate urgency, 4-hour recovery window
        // (matches the SweatCalculator demo defaults).
        setSweatAutopilot(
          action.on
            ? { intervalMin: 30, urgency: 'moderate', recoveryWindowHours: 4 }
            : null,
        );
        return;
      case 'ACTIVATE_SOCIAL':
        await activateSocialMode();
        return;
      case 'DEACTIVATE_SOCIAL':
        await deactivateSocialMode();
        return;
      case 'NAVIGATE':
        // Close the overlay first so the new screen renders cleanly.
        onClose();
        // Fire after a tick so React doesn't fight the modal teardown.
        setTimeout(() => router.push(action.route as never), 80);
        return;
      case 'START_PROTOCOL':
        // The voice service maps START_PROTOCOL to a NAVIGATE action, so
        // this branch is here purely to keep the union exhaustive for TS.
        return;
      case 'NONE':
      default:
        return;
    }
  }, [
    logIntake, updateSymptoms, confirmStatus,
    setSweatAutopilot,
    activateSocialMode, deactivateSocialMode,
    router, onClose,
  ]);

  const finishWithTranscript = useCallback(async (transcript: string) => {
    setVoiceState('processing');
    // Tiny delay so users perceive the "processing" beat (<1s per spec).
    await new Promise((r) => setTimeout(r, 220));
    const result = processTranscript(
      transcript,
      { engineOutput: appState.engineOutput, adaptiveProfile },
      { conversational_intelligence_enabled: flags.conversational_intelligence_enabled },
    );
    setResponse(result);
    setVoiceState(result.intent === 'UNKNOWN' ? 'error' : 'responding');
    // speak() is a no-op while voice playback is disabled — kept here
    // so re-enabling playback later requires only flipping the flag in
    // textToSpeech.ts. Side-effect dispatch follows so logIntake's
    // loading state can't visually compete with the response card.
    void speak(result.spoken);
    void executeAction(result.action);
    // Auto-dismiss after a comfortable read window. Navigation actions close
    // the sheet immediately via executeAction → onClose, so this timer only
    // matters for in-place actions like LOG_INTAKE / GET_STATUS / GET_COMMAND.
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      onClose();
    }, 8000);
  }, [appState.engineOutput, adaptiveProfile, flags.conversational_intelligence_enabled, executeAction, onClose]);

  const stopAndFinalize = useCallback(async () => {
    const handle = sttRef.current;
    sttRef.current = null;
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
    if (!handle) return;
    try {
      const result = await handle.stop();
      await finishWithTranscript(result.transcript);
    } catch {
      setVoiceState('error');
    }
  }, [finishWithTranscript]);

  // ESLint-friendly forward ref for the auto-start effect (defined further down).
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  // When opened with autoStart=true (band trigger), kick off listening on next
  // tick so the reset-on-open effect has finished re-initializing state.
  useEffect(() => {
    if (visible && autoStart) {
      const id = setTimeout(() => { void startListeningRef.current(); }, 60);
      return () => clearTimeout(id);
    }
  }, [visible, autoStart]);

  const startListening = useCallback(async () => {
    if (voiceState === 'listening' || voiceState === 'processing') return;
    setResponse(null);
    setVoiceState('listening');
    sttRef.current = startSpeechRecognition();
    // Auto-stop after 5s so the demo never hangs. We track the timer so a
    // user-initiated stop, close, or new session cancels the pending fire,
    // and we gate on the session token so a stale timer can never finalize
    // a session that has already moved on.
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    const session = sessionRef.current;
    autoStopTimerRef.current = setTimeout(() => {
      autoStopTimerRef.current = null;
      if (session !== sessionRef.current) return;
      if (sttRef.current) void stopAndFinalize();
    }, 5000);
  }, [voiceState, stopAndFinalize]);

  // Keep the ref pointed at the latest startListening so the autoStart effect
  // always invokes the current closure.
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const handleMicTap = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'responding' || voiceState === 'error') {
      void startListening();
    } else if (voiceState === 'listening') {
      void stopAndFinalize();
    }
    // Ignore taps during processing.
  }, [voiceState, startListening, stopAndFinalize]);

  const accent = ACCENT_BY_STATE[voiceState];

  return (
    <AFModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} testID="voice-overlay">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{t('voice.eyebrow')}</Text>
            <View style={styles.headerRight}>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('voice.close_a11y')}>
                <Icon name="x" size={18} color={Colors.text.muted} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.stateRow, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.stateLabel, { color: accent }]}>{t(STATE_LABEL_KEY[voiceState])}</Text>
          </View>

          <View style={styles.waveformWrap}>
            <VoiceWaveform active={voiceState === 'listening'} color={accent} height={48} />
          </View>

          {!VOICE_PLAYBACK_ENABLED && (
            <View style={styles.mutedPillRow}>
              <View style={styles.mutedPill} testID="voice-replies-muted-pill">
                <Icon name="volume-x" size={10} color={Colors.text.muted} />
                <Text style={styles.mutedPillText}>{t('voice.replies_muted')}</Text>
              </View>
            </View>
          )}

          {response ? (
            <View style={styles.responseCard} testID="voice-response">
              {response.transcript ? (
                <Text style={styles.transcript} numberOfLines={2}>
                  &ldquo;{response.transcript}&rdquo;
                </Text>
              ) : null}
              <Text style={styles.spoken} testID="voice-response-spoken">{response.spoken}</Text>
              {response.detail ? <Text style={styles.detail}>{response.detail}</Text> : null}
            </View>
          ) : (
            <Text style={styles.hint}>{t('voice.hint')}</Text>
          )}

          <Pressable
            onPress={handleMicTap}
            style={({ pressed }) => [
              styles.micBtn,
              { borderColor: accent, backgroundColor: voiceState === 'listening' ? `${accent}22` : Colors.background.elevated },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.mic_a11y')}
            testID="voice-mic-toggle"
          >
            <Icon
              name={voiceState === 'listening' ? 'square' : voiceState === 'processing' ? 'loader' : 'mic'}
              size={22}
              color={accent}
            />
            <Text style={[styles.micText, { color: accent }]}>
              {voiceState === 'listening' ? t('voice.stop') : voiceState === 'processing' ? t('voice.working') : t('voice.speak')}
            </Text>
          </Pressable>
        </View>
      </View>
    </AFModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  sheet: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.border.subtle,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mutedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 100, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
  },
  mutedPillText: {
    fontSize: 9, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 1.4,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  closeBtn: { padding: 6 },
  stateRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  waveformWrap: { paddingVertical: 8, alignItems: 'center' },
  mutedPillRow: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  hint: {
    fontSize: 13,
    color: Colors.text.muted,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingHorizontal: 18,
    minHeight: 70,
  },
  responseCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 14,
    gap: 6,
    minHeight: 70,
  },
  transcript: {
    fontSize: 12,
    color: Colors.text.muted,
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
  },
  spoken: {
    fontSize: 16,
    color: Colors.text.primary,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  detail: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'Inter_500Medium',
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  micText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1.6 },
});
