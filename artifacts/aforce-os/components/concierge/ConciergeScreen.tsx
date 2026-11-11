/**
 * AForce Concierge — the conversation screen.
 *
 * Layout: AFMasthead (wordmark · breadcrumb · back, with history + new chat at
 * the wordmark row's right edge) → transcript (FlatList: statement, context
 * pill, turns, Ask next, Recent) → composer → AI disclosure line. The empty state is the OPENING: the app's
 * current approved move (verbatim), one reason, Why this? · Ask a question,
 * one suggested question (more on demand), Personalize (intro in a sheet).
 * Design review 2026-10-05: one action, one reason, no stack of boxes.
 *
 * Black Issue (2026-10-07): presentation only. The pill, Ask next chips and
 * Recent rows draw ONLY data this screen already holds — the context a turn
 * would send, the existing suggested questions, the already-loaded history
 * list (nothing is fetched to fill them; an unloaded list draws no section).
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
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFDisclosureSheet, AFMasthead, AFScreen, AFSectionLabel, AFSkeleton } from '@/components/ui';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAFGutter } from '@/hooks/useAFGutter';
import { useActionsSlice, useEngineSlice, useUserSlice, useVoiceSettingsSlice } from '@/store/slices';
import { useCoachMode } from '@/services/coachMode';
import { speak } from '@/services/textToSpeech';
import { ActionLedger, type LogIntakeFn } from '@/services/concierge/conciergeActions';
import { conciergeApi, type ConciergeStatus } from '@/services/concierge/conciergeApi';
import type { ConciergeAssistantTurn, ConciergeChatItem } from '@/services/concierge/conciergeTypes';
import { useConciergeContext, useConciergeDemoMode } from '@/hooks/useConciergeContext';
import { useConciergeConversation } from '@/hooks/useConciergeConversation';
import { ConciergeComposer, type ConciergeComposerHandle } from './ConciergeComposer';
import { ConciergePill } from './conciergeKit';
import { ConciergeHistorySheet } from './ConciergeHistorySheet';
import { ConciergeIntroCard, type IntroResult } from './ConciergeIntroCard';
import { ConciergeMessageBubble } from './ConciergeMessageBubble';
import { ConciergeOpening } from './ConciergeOpening';
import { askNextKeys, contextSegments, seedText, unavailableBodyFor } from './conciergePresentation';
import { pickSuggestedQuestion, SUGGESTED_KEYS } from './openingLogic';

interface ConciergeActions {
  logIntake: LogIntakeFn;
}

export function ConciergeScreen() {
  const { t, i18n } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  const gutter = useAFGutter();
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
  const [introOpen, setIntroOpen] = React.useState(false);
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const composerRef = React.useRef<ConciergeComposerHandle>(null);
  // The opening renders from the SAME context object a turn would send, so the
  // move shown here and the move the model explains are one string.
  const openingContext = React.useMemo(() => buildContext(), [buildContext, engine, userState]);
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
      void convo.send(text);
    },
    [convo],
  );

  const onIntroStart = React.useCallback(
    (result: IntroResult) => {
      setIntroOpen(false);
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
  // The pill reads the SAME context object a turn would send.
  const pillSegments = React.useMemo(() => contextSegments(openingContext, t), [openingContext, t]);
  const showTail = state.items.length > 0 && !state.loadingTranscript && !state.sending;
  const askNext = React.useMemo(() => askNextKeys(pickSuggestedQuestion(openingContext), SUGGESTED_KEYS), [openingContext]);
  const recent = React.useMemo(
    () => state.history.list.filter((c) => c.id !== state.conversationId).slice(0, 3),
    [state.history.list, state.conversationId],
  );

  const header = (
    <View style={styles.header}>
      <AFMasthead
        wordmark={false}
        title={empty ? t('concierge.opening_line') : t('concierge.masthead.ask_title')}
        testID="concierge-masthead"
      />
      {!empty && pillSegments.length > 0 ? (
        <View
          style={styles.contextPill}
          accessibilityRole="text"
          accessibilityLabel={`${t('concierge.context.label')}: ${pillSegments.join(', ')}`}
          testID="concierge-context-pill"
        >
          <View style={styles.contextDot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <Text style={[styles.contextText, eyebrowType]}>{[t('concierge.context.label'), ...pillSegments].join(' · ')}</Text>
        </View>
      ) : null}
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
          <ConciergeOpening
            context={openingContext}
            biometrics={userState.biometrics}
            confidence={engine.command?.confidence ?? null}
            onAsk={() => composerRef.current?.focus()}
            onPickQuestion={onPickSuggestion}
            onPersonalize={() => setIntroOpen(true)}
          />
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
    <View style={styles.tail}>
      {showTail ? (
        <View style={styles.block} testID="concierge-ask-next">
          <AFSectionLabel label={t('concierge.ask_next')} rule={false} />
          <View style={styles.chips}>
            {askNext.map((k) => (
              <ConciergePill
                key={k}
                label={t(`concierge.suggested.${k}`)}
                onPress={() => onPickSuggestion(t(`concierge.suggested.${k}`))}
                testID={`concierge-ask-next-${k}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      {showTail && recent.length > 0 ? (
        <View style={styles.block} testID="concierge-recent">
          <AFSectionLabel label={t('concierge.recent')} rule={false} />
          <View>
            {recent.map((c) => {
              const when = new Date(c.updatedAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
              const title = c.title ?? t('concierge.new_chat');
              return (
                <Pressable
                  key={c.id}
                  onPress={() => void convo.open(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}, ${when}`}
                  style={styles.recentRow}
                  testID={`concierge-recent-${c.id}`}
                >
                  <Text style={styles.recentTitle} numberOfLines={2}>{title}</Text>
                  <Text style={[styles.recentMeta, eyebrowType]}>{when}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={styles.footerSpacer} />
    </View>
  );

  return (
    <AFScreen padded={false} center={false} edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
          <View style={styles.mastheadWrap}>
            <AFMasthead
              breadcrumb={empty ? t('concierge.masthead.opening_crumb') : t('concierge.masthead.ask_crumb')}
              onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              backLabel={t('common.back')}
              testID="concierge-topbar"
            />
            <View style={styles.actionsSlot}>
              {[
                { icon: 'clock' as const, label: t('concierge.history'), onPress: openHistory, testID: 'concierge-history-btn' },
                { icon: 'plus' as const, label: t('concierge.new_chat'), onPress: convo.newChat, testID: 'concierge-new-chat-btn' },
              ].map((a) => (
                <Pressable
                  key={a.testID}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  hitSlop={4}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
                  testID={a.testID}
                >
                  <Icon name={a.icon} size={20} color={af.textPrimary} />
                </Pressable>
              ))}
            </View>
          </View>
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
          contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          testID="concierge-transcript"
        />
        <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          <ConciergeComposer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSend={onSend}
            onCancel={convo.cancel}
            sending={state.sending}
          />
          <Text style={[styles.disclosure, { paddingHorizontal: gutter }]} accessibilityRole="text">{t('concierge.ai_disclosure')}</Text>
        </View>
      </KeyboardAvoidingView>

      <AFDisclosureSheet visible={introOpen} onClose={() => setIntroOpen(false)} title={t('concierge.opening.personalize')} testID="concierge-intro-sheet">
        <ConciergeIntroCard onStart={onIntroStart} onSkip={() => setIntroOpen(false)} />
      </AFDisclosureSheet>

      <ConciergeHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        list={state.history.list}
        loading={state.history.loading}
        error={state.history.error}
        activeId={state.conversationId}
        onOpen={(id) => {
          setHistoryOpen(false);
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
  topBar: { paddingTop: 8, paddingBottom: 4 },
  mastheadWrap: { position: 'relative' },
  // Free right side of the wordmark row: 44pt targets centred on the 20pt
  // wordmark line (top = (20 - 44) / 2), as on Hydration.
  actionsSlot: { position: 'absolute', top: -12, right: -12, flexDirection: 'row' },
  actionBtn: {
    width: afLayout.controlMinHeight,
    height: afLayout.controlMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: afLayout.controlMinHeight / 2,
  },
  actionPressed: { backgroundColor: af.surfacePressed },
  listContent: { paddingBottom: 12 },
  header: { gap: 14, paddingTop: 4, paddingBottom: 8 },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  contextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.redText },
  contextText: { ...afType.eyebrow, color: af.textSecondary, flex: 1, textTransform: 'uppercase' },
  disclosure: { ...afType.caption, color: af.textTertiary, paddingTop: 6 },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  demoText: { ...afType.caption, color: af.textSecondary, flex: 1 },
  statusBanner: {},
  emptyWrap: { paddingTop: 0 },
  skeletons: { gap: 10, paddingTop: 8 },
  thinking: { gap: 8, paddingVertical: 12, alignSelf: 'flex-start', width: '70%' },
  tail: { gap: 28, paddingTop: 20 },
  block: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: afLayout.controlMinHeight + 8,
    paddingVertical: 10,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  recentTitle: { ...afType.body, color: af.textPrimary, flex: 1 },
  recentMeta: { ...afType.eyebrow, color: af.textTertiary, textTransform: 'uppercase' },
  footerSpacer: { height: 8 },
});
