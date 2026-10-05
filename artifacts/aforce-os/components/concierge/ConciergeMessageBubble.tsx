/**
 * AForce Concierge — one turn in the transcript.
 *
 * Assistant turns render the governed structure: direct answer → one next
 * step → optional action card → expandable "Why this?" → sources with
 * provenance + freshness. Simple answers collapse to the first line alone.
 * Notices (unavailable / gated) render as honest states with retry.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFTextButton } from '@/components/ui';
import type { ActionLedger, ExecuteDeps } from '@/services/concierge/conciergeActions';
import { actionIdFor } from '@/services/concierge/conciergeActions';
import type { ConciergeAssistantTurn, ConciergeChatItem } from '@/services/concierge/conciergeTypes';
import { ConciergeActionCard } from './ConciergeActionCard';
import { describeSource, localNoticeCopy, noticeCopyFor, speakableText } from './conciergePresentation';

export interface ConciergeMessageBubbleProps {
  item: ConciergeChatItem;
  ledger: ActionLedger;
  actionDeps: Omit<ExecuteDeps, 'ledger'>;
  onRetry?: (itemId: string) => void;
  onSpeak?: (text: string) => void;
  canSpeak: boolean;
  onRemember?: (itemId: string, turn: ConciergeAssistantTurn) => void;
  rememberState?: 'pending' | 'saved' | 'declined';
  onDeclineRemember?: (itemId: string) => void;
}

export function ConciergeMessageBubble(props: ConciergeMessageBubbleProps) {
  const { item, ledger, actionDeps, onRetry, onSpeak, canSpeak, onRemember, rememberState, onDeclineRemember } = props;
  const { t } = useTranslation();
  const [showWhy, setShowWhy] = React.useState(false);

  if (item.role === 'user') {
    return (
      <View style={styles.userRow} accessibilityRole="text" accessibilityLabel={item.text} testID={`concierge-user-${item.id}`}>
        <Text style={styles.userText}>{item.text}</Text>
      </View>
    );
  }

  if (item.role === 'local') {
    const copy = localNoticeCopy(item.kind, t);
    return (
      <View style={[styles.assistantRow, styles.notice]} accessibilityRole="alert" testID={`concierge-local-${item.id}`}>
        <View style={styles.noticeHead}>
          <Icon name={item.kind === 'offline' ? 'wifi-off' : 'alert-circle'} size={16} color={af.textSecondary} />
          <Text style={styles.noticeTitle}>{copy.title}</Text>
        </View>
        <Text style={styles.noticeBody}>{copy.body}</Text>
        {copy.retryable && onRetry ? (
          <AFTextButton label={t('common.retry')} onPress={() => onRetry(item.id)} testID={`concierge-retry-${item.id}`} />
        ) : null}
      </View>
    );
  }

  const { turn } = item;
  const notice = noticeCopyFor(turn, t);
  if (notice) {
    return (
      <View style={[styles.assistantRow, styles.notice]} accessibilityRole="alert" testID={`concierge-notice-${item.id}`}>
        <View style={styles.noticeHead}>
          <Icon name="alert-circle" size={16} color={af.textSecondary} />
          <Text style={styles.noticeTitle}>{notice.title}</Text>
        </View>
        <Text style={styles.noticeBody}>{notice.body}</Text>
      </View>
    );
  }

  const urgent = turn.status === 'urgent';
  const clarify = turn.kind === 'clarify';
  return (
    <View style={[styles.assistantRow, urgent && styles.urgent]} testID={`concierge-assistant-${item.id}`}>
      {urgent ? (
        <View style={styles.noticeHead}>
          <Icon name="alert-triangle" size={16} color={af.redText} />
          <Text style={[styles.noticeTitle, styles.urgentTitle]}>{t('concierge.state.urgent_label')}</Text>
        </View>
      ) : null}
      {clarify ? <Text style={styles.kicker}>{t('concierge.state.clarify_label').toUpperCase()}</Text> : null}
      <Text style={styles.answer} accessibilityRole="text">{turn.answer}</Text>
      {turn.nextStep ? (
        <View style={styles.nextStep}>
          <Icon name="arrow-right" size={14} color={af.textPrimary} />
          <Text style={styles.nextStepText}>{turn.nextStep}</Text>
        </View>
      ) : null}

      {turn.action && !urgent ? (
        <ConciergeActionCard
          actionId={actionIdFor(item.id)}
          action={turn.action}
          ledger={ledger}
          deps={actionDeps}
          testID={`concierge-action-${item.id}`}
        />
      ) : null}

      {turn.remember && onRemember ? (
        <View style={styles.remember} testID={`concierge-remember-${item.id}`}>
          <Text style={styles.rememberTitle}>{t('concierge.remember.title')}</Text>
          <Text style={styles.rememberBody}>{t('concierge.remember.body', { value: turn.remember.value })}</Text>
          {rememberState === 'saved' ? (
            <Text style={styles.rememberSaved}>{t('concierge.remember.saved')}</Text>
          ) : rememberState === 'declined' ? null : (
            <View style={styles.row}>
              <AFTextButton label={t('concierge.remember.no')} onPress={() => onDeclineRemember?.(item.id)} />
              <AFTextButton label={t('concierge.remember.yes')} onPress={() => onRemember(item.id, turn)} testID={`concierge-remember-yes-${item.id}`} />
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.footer}>
        {turn.why ? (
          <Pressable
            onPress={() => setShowWhy((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('concierge.why_this')}
            accessibilityState={{ expanded: showWhy }}
            hitSlop={10}
            style={styles.whyBtn}
            testID={`concierge-why-${item.id}`}
          >
            <Text style={styles.whyLabel}>{t('concierge.why_this')}</Text>
            <Icon name={showWhy ? 'chevron-left' : 'chevron-right'} size={12} color={af.textSecondary} />
          </Pressable>
        ) : null}
        {canSpeak && onSpeak ? (
          <Pressable
            onPress={() => onSpeak(speakableText(turn))}
            accessibilityRole="button"
            accessibilityLabel={t('concierge.read_aloud')}
            hitSlop={10}
            style={styles.whyBtn}
            testID={`concierge-speak-${item.id}`}
          >
            <Icon name="volume-2" size={14} color={af.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {showWhy ? (
        <View style={styles.why} testID={`concierge-why-body-${item.id}`}>
          <Text style={styles.whyText}>{turn.why}</Text>
          {turn.sources.length > 0 ? (
            <View style={styles.sources}>
              <Text style={styles.sourcesLabel}>{t('concierge.sources_label').toUpperCase()}</Text>
              {turn.sources.map((s) => (
                <Text key={s.id} style={styles.source}>
                  {describeSource(s, t)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: af.surfaceRaised,
    borderRadius: 16,
    borderBottomRightRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 6,
  },
  userText: { ...afType.body, color: af.textPrimary },
  assistantRow: {
    alignSelf: 'stretch',
    marginVertical: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    gap: 6,
  },
  urgent: { borderColor: af.redHairline, backgroundColor: af.redDim },
  kicker: { ...afType.eyebrow, color: af.textTertiary },
  answer: { ...afType.body, color: af.textPrimary },
  nextStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  nextStepText: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  whyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  whyLabel: { ...afType.caption, color: af.textSecondary },
  why: { marginTop: 4, gap: 8 },
  whyText: { ...afType.secondary, color: af.textSecondary },
  sources: { gap: 2 },
  sourcesLabel: { ...afType.eyebrow, color: af.textTertiary },
  source: { ...afType.caption, color: af.textTertiary },
  notice: { backgroundColor: af.canvasElevated },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { ...afType.bodyStrong, color: af.textPrimary },
  urgentTitle: { color: af.redText },
  noticeBody: { ...afType.secondary, color: af.textSecondary },
  remember: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: af.canvasElevated,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    gap: 4,
  },
  rememberTitle: { ...afType.bodyStrong, color: af.textPrimary },
  rememberBody: { ...afType.caption, color: af.textSecondary },
  rememberSaved: { ...afType.caption, color: af.green },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
