/**
 * Voice Overlay — the full-screen capture / response sheet.
 *
 * Owns the voice session lifecycle:
 *   1. Tap mic → start STT
 *   2. Tap again or stop → finalize transcript → classify → build response
 *   3. Render response card → execute side-effect (logIntake / navigate / etc.)
 *   4. Optional TTS playback
 *   5. Auto-dismiss after a short window
 *
 * No long dialogue. No conversation history. ONE command at a time.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '../theme/colors';
import { VoiceWaveform } from './VoiceWaveform';
import { useAppStore } from '../store/useAppStore';
import {
  startSpeechRecognition, type STTHandle,
} from '../services/speechToText';
import { speak, stopSpeaking } from '../services/textToSpeech';
import { processTranscript } from '../services/voiceService';
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

const STATE_LABEL: Record<VoiceState, string> = {
  idle:       'TAP TO SPEAK',
  listening:  'LISTENING…',
  processing: 'PROCESSING…',
  responding: 'COMMAND',
  error:      'TRY AGAIN',
};

export function VoiceOverlay({ visible, onClose, autoStart = false }: Props) {
  const router = useRouter();
  const { state: appState, logIntake, updateSymptoms, confirmStatus } = useAppStore();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [response, setResponse] = useState<VoiceCommandResponse | null>(null);
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

  /** Dispatch the side-effect declared by the orchestrator. */
  const executeAction = useCallback(async (action: VoiceAction) => {
    switch (action.type) {
      case 'LOG_INTAKE':
        // silent=true so we don't stack the cycle-success hero modal on top
        // of the voice response card (RN-web only renders one Modal at a time).
        await logIntake(action.fluidType, { silent: true });
        return;
      case 'UPDATE_SYMPTOMS':
        await updateSymptoms(action.symptoms);
        return;
      case 'CONFIRM_STATUS':
        await confirmStatus();
        return;
      case 'NAVIGATE':
        // Close the overlay first so the new screen renders cleanly.
        onClose();
        // Fire after a tick so React doesn't fight the modal teardown.
        setTimeout(() => router.push(action.route as never), 80);
        return;
      case 'NONE':
      default:
        return;
    }
  }, [logIntake, updateSymptoms, confirmStatus, router, onClose]);

  const finishWithTranscript = useCallback(async (transcript: string) => {
    setVoiceState('processing');
    // Tiny delay so users perceive the "processing" beat (<1s per spec).
    await new Promise((r) => setTimeout(r, 220));
    const result = processTranscript(transcript, { engineOutput: appState.engineOutput });
    setResponse(result);
    setVoiceState(result.intent === 'UNKNOWN' ? 'error' : 'responding');
    // Speak first, then dispatch the side-effect (so logIntake's loading
    // overlay doesn't visually compete with the response card).
    void speak(result.spoken);
    void executeAction(result.action);
    // Auto-dismiss after a comfortable read window. Navigation actions close
    // the sheet immediately via executeAction → onClose, so this timer only
    // matters for in-place actions like LOG_INTAKE / GET_STATUS / GET_COMMAND.
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      onClose();
    }, 8000);
  }, [appState.engineOutput, executeAction, onClose]);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} testID="voice-overlay">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>AFORCE VOICE</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close voice">
              <Feather name="x" size={18} color={Colors.text.muted} />
            </Pressable>
          </View>

          <View style={[styles.stateRow, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.stateLabel, { color: accent }]}>{STATE_LABEL[voiceState]}</Text>
          </View>

          <View style={styles.waveformWrap}>
            <VoiceWaveform active={voiceState === 'listening'} color={accent} height={48} />
          </View>

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
            <Text style={styles.hint}>
              Try “log a stick”, “how am I doing”, or “I feel dizzy”.
            </Text>
          )}

          <Pressable
            onPress={handleMicTap}
            style={({ pressed }) => [
              styles.micBtn,
              { borderColor: accent, backgroundColor: voiceState === 'listening' ? `${accent}22` : Colors.background.elevated },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle voice capture"
            testID="voice-mic-toggle"
          >
            <Feather
              name={voiceState === 'listening' ? 'square' : voiceState === 'processing' ? 'loader' : 'mic'}
              size={22}
              color={accent}
            />
            <Text style={[styles.micText, { color: accent }]}>
              {voiceState === 'listening' ? 'STOP' : voiceState === 'processing' ? 'WORKING' : 'SPEAK'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
