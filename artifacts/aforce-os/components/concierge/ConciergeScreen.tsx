/**
 * AForce Concierge — the conversation screen.
 *
 * Layout: AFTopBar (back · history · new chat) → AI disclosure line →
 * transcript (FlatList) → composer. The empty state carries the opening line,
 * the on-demand briefing, the optional intro and the suggested questions.
 *
 * Honest states: offline / unavailable / gated / rate-limited turns are items
 * in the transcript with retry where retry can help; a request in flight shows
 * a working indicator and a Stop control; nothing is fabricated while waiting.
 *
 * Score-Protection: every effect this screen can cause goes through
 * services/concierge/conciergeActions.ts (intake path, navigation, local
 * reminders). It never dispatches into the score.
 */
import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFScreen, AFSkeleton, AFTopBar } from '@/components/ui';
import { useActionsSlice, useVoiceSettingsSlice } from '@/store/slices';
import { useCoachMode } from '@/services/coachMode';
import { speak } from '@/services/textToSpeech';
import { ActionLedger, type LogIntakeFn } from '@/services/concierge/conciergeActions';
import { conciergeApi, type ConciergeStatus } from '@/services/concierge/conciergeApi';
import type { ConciergeAssistantTurn, ConciergeChatItem } from '@/services/concierge/conciergeTypes';
import { useConciergeContext, useConciergeDemoMode } from '@/hooks/useConciergeContext';
import { useConciergeConversation } from '@/hooks/useConciergeConversation';
import { ConciergeBriefingCard } from './ConciergeBriefingCard';
import { ConciergeComposer } from './ConciergeComposer';
import { ConciergeHistorySheet } from './ConciergeHistorySheet';
import { ConciergeIntroCard, type IntroResult } from './ConciergeIntroCard';
import { ConciergeMessageBubble } from './ConciergeMessageBubble';
import { ConciergeSuggestedQuestions } from './ConciergeSuggestedQuestions';
import { seedText, unavailableBodyFor } from './conciergePresentation';

interface ConciergeActions {
  logIntake: LogIntakeFn;
}

export function ConciergeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
  const { logIntake } = useActionsSlice<ConciergeActions>();
  const coachMode = useCoachMode();
  const { voiceCoachEnabled } = useVoiceSettingsSlice();
  const demoMode = useConciergeDemoMode();

  const [stated, setStated] = React.useState<{ constraints?: string } | undefined>(undefined);
  const buildContext = useConciergeContext(stated);
  const convo = useConciergeConversation(buildContext);
  const { state } = convo;

  const [draft, setDraft] = React.useState(() => seedText(params.seed, t));
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [introDismissed, setIntroDismissed] = React.useState(false);
  const [rememberStates, setRememberStates] = React.useState<Record<string, 'pending' | 'saved' | 'declined'>>({});
  // Provider availability, probed by the server (key, billing, reachability).
  // Shown as a banner BEFORE the member types, so a known outage is never
  // discovered by sending a message into it.
  const [status, setStatus] = React.useState<ConciergeStatus | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    conciergeApi
      .status(controller.signal)
      .then((s) => setStatus(s))
      .catch(() => setStatus(null));
    return () => controller.abort();
  }, []);
  const ledger = React.useRef(new ActionLedger()).current;
  const listRef = React.useRef<FlatList<ConciergeChatItem>>(null);

  const canSpeak = coachMode === 'spoken' && voiceCoachEnabled;
  const actionDeps = React.useMemo(() => ({ logIntake, router }), [logIntake, router]);

  const onSend = React.useCallback(() => {
    const text = draft;
    setDraft('');
    void convo.send(text);
  }, [convo, draft]);

  const onPickSuggestion = React.useCallback(
    (text: string) => {
      setIntroDismissed(true);
      void convo.send(text);
    },
    [convo],
  );

  const onIntroStart = React.useCallback(
    (result: IntroResult) => {
      setIntroDismissed(true);
      const summary = [
        result.prefs.primaryGoal ? `goal: ${result.prefs.primaryGoal}` : null,
        result.prefs.routine ? `routine: ${result.prefs.routine}` : null,
        result.prefs.tone ? `tone: ${result.prefs.tone}` : null,
      ].filter(Boolean);
      // Session-only by default; the server stores nothing unless `save` is on.
      if (summary.length > 0) setStated({ constraints: summary.join('; ') });
      if (result.save) {
        void conciergeApi.savePreferences(result.prefs).catch(() => {
          /* the next send still carries the session context; memory screen shows truth */
        });
      }
    },
    [],
  );

  const onRemember = React.useCallback(async (itemId: string, turn: ConciergeAssistantTurn) => {
    if (!turn.remember) return;
    const { key, value } = turn.remember;
    try {
      if (key === 'note') {
        const current = await conciergeApi.getPreferences();
        const notes = [...(current.preferences?.prefs.notes ?? []), value].slice(-12);
        await conciergeApi.savePreferences({ notes });
      } else if (key === 'tone') {
        const tone = ['rock', 'bb', 'surge', 'sage'].includes(value.toLowerCase())
          ? (value.toLowerCase() as 'rock' | 'bb' | 'surge' | 'sage')
          : null;
        if (tone) await conciergeApi.savePreferences({ tone });
      } else {
        await conciergeApi.savePreferences({ [key]: value });
      }
      setRememberStates((s) => ({ ...s, [itemId]: 'saved' }));
    } catch {
      setRememberStates((s) => ({ ...s, [itemId]: 'pending' }));
    }
  }, []);

  const openHistory = React.useCallback(() => {
    setHistoryOpen(true);
    void convo.refreshHistory();
  }, [convo]);

  React.useEffect(() => {
    if (state.items.length > 0) {
      const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state.items.length, state.sending]);

  const empty = state.items.length === 0 && !state.loadingTranscript;

  const header = (
    <View style={styles.header}>
      <Text style={styles.disclosure} accessibilityRole="text">{t('concierge.ai_disclosure')}</Text>
      {status && !status.available ? (
        <View style={[styles.demoBanner, styles.statusBanner]} accessibilityRole="alert" testID="concierge-status-banner">
          <Icon name="alert-circle" size={14} color={af.textSecondary} />
          <Text style={styles.demoText}>
            {t('concierge.state.status_banner_prefix')} {unavailableBodyFor(status.reason, t)}
          </Text>
        </View>
      ) : null}
      {demoMode ? (
        <View style={styles.demoBanner} accessibilityRole="text" testID="concierge-demo-banner">
          <Icon name="info" size={14} color={af.amber} />
          <Text style={styles.demoText}>{t('concierge.state.demo_banner')}</Text>
        </View>
      ) : null}
      {empty ? (
        <View style={styles.emptyWrap} testID="concierge-empty-state">
          <Text style={styles.opening} accessibilityRole="header">{t('concierge.opening_line')}</Text>
          <ConciergeBriefingCard
            turn={state.briefing.turn}
            generatedAt={state.briefing.generatedAt}
            loading={state.briefing.loading}
            error={state.briefing.error}
            onRequest={() => void convo.refreshBriefing()}
          />
          {!introDismissed ? <ConciergeIntroCard onStart={onIntroStart} onSkip={() => setIntroDismissed(true)} /> : null}
          <ConciergeSuggestedQuestions onPick={onPickSuggestion} />
        </View>
      ) : null}
      {state.loadingTranscript ? (
        <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
          <AFSkeleton height={56} radius={16} width="70%" />
          <AFSkeleton height={88} radius={16} />
        </View>
      ) : null}
    </View>
  );

  const footer = state.sending ? (
    <View style={styles.thinking} accessibilityRole="progressbar" accessibilityLabel={t('concierge.thinking')} testID="concierge-thinking">
      <AFSkeleton height={14} width="52%" />
      <AFSkeleton height={14} width="36%" />
    </View>
  ) : (
    <View style={styles.footerSpacer} />
  );

  return (
    <AFScreen padded={false} center={false} edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <AFTopBar
            eyebrow={t('concierge.eyebrow')}
            title={t('concierge.title')}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            actions={[
              { icon: 'clock', label: t('concierge.history'), onPress: openHistory },
              { icon: 'plus', label: t('concierge.new_chat'), onPress: convo.newChat },
            ]}
            testID="concierge-topbar"
          />
        </View>
        <FlatList
          ref={listRef}
          data={state.items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ConciergeMessageBubble
              item={item}
              ledger={ledger}
              actionDeps={actionDeps}
              onRetry={(id) => void convo.retry(id)}
              canSpeak={canSpeak}
              onSpeak={(text) => speak(text)}
              onRemember={(id, turn) => void onRemember(id, turn)}
              rememberState={rememberStates[item.id]}
              onDeclineRemember={(id) => setRememberStates((s) => ({ ...s, [id]: 'declined' }))}
            />
          )}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          testID="concierge-transcript"
        />
        <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          <ConciergeComposer
            value={draft}
            onChange={setDraft}
            onSend={onSend}
            onCancel={convo.cancel}
            sending={state.sending}
          />
        </View>
      </KeyboardAvoidingView>

      <ConciergeHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        list={state.history.list}
        loading={state.history.loading}
        error={state.history.error}
        activeId={state.conversationId}
        onOpen={(id) => {
          setHistoryOpen(false);
          setIntroDismissed(true);
          void convo.open(id);
        }}
        onDelete={(id) => void convo.deleteConversation(id)}
        onDeleteAll={() => {
          setHistoryOpen(false);
          void convo.deleteAll();
        }}
        onRefresh={() => void convo.refreshHistory()}
      />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: af.canvas },
  fill: { flex: 1 },
  topBar: { paddingHorizontal: afLayout.screenPaddingX },
  listContent: { paddingHorizontal: afLayout.screenPaddingX, paddingBottom: 12 },
  header: { gap: 14, paddingTop: 4, paddingBottom: 8 },
  disclosure: { ...afType.caption, color: af.textTertiary },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: af.canvasElevated,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  demoText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  statusBanner: { borderColor: af.borderStrong },
  emptyWrap: { gap: 16, paddingTop: 8 },
  opening: { ...afType.title2, color: af.textPrimary },
  skeletons: { gap: 10, paddingTop: 8 },
  thinking: { gap: 8, paddingVertical: 12, alignSelf: 'flex-start', width: '70%' },
  footerSpacer: { height: 8 },
});
