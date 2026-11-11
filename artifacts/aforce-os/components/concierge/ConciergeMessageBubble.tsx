/**
 * AForce Concierge — one turn in the transcript.
 *
 * Assistant turns render the governed structure: direct answer → one next
 * step → optional action card → expandable "Why this?" → sources with
 * provenance + freshness. Simple answers collapse to the first line alone.
 * Notices (unavailable / gated) render as honest states with retry.
 *
 * Black Issue (2026-10-07): member turns are right-aligned surface bubbles
 * with a mono "YOU · time" meta; AForce turns are an AFCard with the red "A"
 * avatar, a bold headline (the answer's own first sentence — the string is
 * never rewritten), the next step as a row, the reply's existing sources as a
 * mono SOURCES line, its existing action as pills, and a quiet mono footer.
 * Every element is drawn from data the turn already carries; absent data
 * (a reply with no sources, no clock) draws nothing.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFCard } from '@/components/ui/AFCard';
import { AF_WORDMARK } from '@/components/ui/AFMasthead';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import type { ActionLedger, ExecuteDeps } from '@/services/concierge/conciergeActions';
import { actionIdFor } from '@/services/concierge/conciergeActions';
import type { ConciergeAssistantTurn, ConciergeChatItem } from '@/services/concierge/conciergeTypes';
import { ConciergeActionCard } from './ConciergeActionCard';
import { ConciergeAvatar, ConciergePill } from './conciergeKit';
import { describeSource, formatTurnTime, localNoticeCopy, noticeCopyFor, speakableText, splitAnswer } from './conciergePresentation';

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
  const { t, i18n } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  const [showWhy, setShowWhy] = React.useState(false);
  const time = formatTurnTime(item.createdAt, i18n.language);

  if (item.role === 'user') {
    const meta = [t('concierge.reply.you'), time].filter(Boolean).join(' · ');
    return (
      <View style={styles.userWrap}>
        <View style={styles.userBubble} accessibilityRole="text" accessibilityLabel={item.text} testID={`concierge-user-${item.id}`}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
        <Text style={[styles.meta, eyebrowType, styles.userMeta]}>{meta}</Text>
      </View>
    );
  }

  if (item.role === 'local') {
    const copy = localNoticeCopy(item.kind, t);
    return (
      <AFCard style={styles.noticeCard} testID={`concierge-local-${item.id}`}>
        <View accessibilityRole="alert" style={styles.noticeInner}>
          <View style={styles.noticeHead}>
            <Icon name={item.kind === 'offline' ? 'wifi-off' : 'alert-circle'} size={16} color={af.textSecondary} />
            <Text style={styles.noticeTitle}>{copy.title}</Text>
          </View>
          <Text style={styles.noticeBody}>{copy.body}</Text>
          {copy.retryable && onRetry ? (
            <ConciergePill label={t('common.retry')} onPress={() => onRetry(item.id)} testID={`concierge-retry-${item.id}`} />
          ) : null}
        </View>
      </AFCard>
    );
  }

  const { turn } = item;
  const notice = noticeCopyFor(turn, t);
  if (notice) {
    return (
      <AFCard style={styles.noticeCard} testID={`concierge-notice-${item.id}`}>
        <View accessibilityRole="alert" style={styles.noticeInner}>
          <View style={styles.noticeHead}>
            <Icon name="alert-circle" size={16} color={af.textSecondary} />
            <Text style={styles.noticeTitle}>{notice.title}</Text>
          </View>
          <Text style={styles.noticeBody}>{notice.body}</Text>
        </View>
      </AFCard>
    );
  }

  const urgent = turn.status === 'urgent';
  const clarify = turn.kind === 'clarify';
  const { headline, rest } = splitAnswer(turn.answer);
  const sourceLabels = turn.sources.map((s) => s.label).filter(Boolean);
  const footerMeta = [
    AF_WORDMARK,
    time,
    turn.sources.length > 0 ? t('concierge.reply.source_aware') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.assistantWrap} testID={`concierge-assistant-${item.id}`}>
      <View style={styles.assistantRow}>
        <ConciergeAvatar />
        <AFCard variant={urgent ? 'alert' : 'standard'} style={[styles.replyCard, !urgent && styles.replyAccent]}>
          {urgent ? (
            <View style={styles.noticeHead}>
              <Icon name="alert-triangle" size={16} color={af.redText} />
              <Text style={[styles.noticeTitle, styles.urgentTitle]}>{t('concierge.state.urgent_label')}</Text>
            </View>
          ) : null}
          {clarify ? <Text style={[styles.contextLine, eyebrowType]}>{t('concierge.state.clarify_label')}</Text> : null}

          <View accessible accessibilityRole="text" accessibilityLabel={turn.answer} style={styles.answerBlock}>
            {headline ? <Text style={styles.headline}>{headline}</Text> : null}
            {rest ? <Text style={styles.answer}>{rest}</Text> : null}
          </View>

          {turn.nextStep ? (
            <View style={styles.stepRow}>
              <View style={styles.stepDot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              <Text style={styles.stepText}>{turn.nextStep}</Text>
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
                  <ConciergePill label={t('concierge.remember.no')} onPress={() => onDeclineRemember?.(item.id)} />
                  <ConciergePill label={t('concierge.remember.yes')} onPress={() => onRemember(item.id, turn)} testID={`concierge-remember-yes-${item.id}`} />
                </View>
              )}
            </View>
          ) : null}

          {sourceLabels.length > 0 ? (
            <View style={styles.sourcesRule}>
              <Text style={[styles.sourcesLine, eyebrowType]} testID={`concierge-sources-${item.id}`}>
                {[t('concierge.reply.sources'), ...sourceLabels].join(' · ')}
              </Text>
            </View>
          ) : null}

          {turn.why || (canSpeak && onSpeak) ? (
            <View style={styles.footer}>
              {turn.why ? (
                <ConciergePill
                  label={t('concierge.why_this')}
                  onPress={() => setShowWhy((v) => !v)}
                  trailingIcon={showWhy ? 'chevron-left' : 'chevron-right'}
                  expanded={showWhy}
                  testID={`concierge-why-${item.id}`}
                />
              ) : null}
              {canSpeak && onSpeak ? (
                <ConciergePill
                  icon="volume-2"
                  accessibilityLabel={t('concierge.read_aloud')}
                  onPress={() => onSpeak(speakableText(turn))}
                  testID={`concierge-speak-${item.id}`}
                />
              ) : null}
            </View>
          ) : null}
          {showWhy ? (
            <View style={styles.why} testID={`concierge-why-body-${item.id}`}>
              <Text style={styles.whyText}>{turn.why}</Text>
              {turn.sources.length > 0 ? (
                <View style={styles.sources}>
                  <Text style={[styles.sourcesLabel, eyebrowType]}>{t('concierge.sources_label')}</Text>
                  {turn.sources.map((s) => (
                    <Text key={s.id} style={styles.source}>
                      {describeSource(s, t)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </AFCard>
      </View>
      <Text style={[styles.meta, eyebrowType, styles.assistantMeta]}>{footerMeta}</Text>
    </View>
  );
}

// Reply column sits right of the 28pt avatar (+ 10pt gap).
const AVATAR_GUTTER = 38;

const styles = StyleSheet.create({
  userWrap: { alignSelf: 'flex-end', maxWidth: '86%', alignItems: 'flex-end', marginTop: 16, gap: 6 },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: afLayout.radiusHero,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  userText: { ...afType.body, color: af.textPrimary },
  meta: { ...afType.micro, color: af.textTertiary, textTransform: 'uppercase' },
  userMeta: { textAlign: 'right' },
  assistantWrap: { alignSelf: 'stretch', marginTop: 16, gap: 6 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  replyCard: { flex: 1, gap: 10 },
  // The reply's left edge: the red rule the reference draws down the card.
  replyAccent: { borderLeftWidth: 2, borderLeftColor: af.red },
  assistantMeta: { marginLeft: AVATAR_GUTTER },
  contextLine: { ...afType.eyebrow, color: af.redText, textTransform: 'uppercase' },
  answerBlock: { gap: 6 },
  headline: { ...afType.title3, color: af.textPrimary },
  answer: { ...afType.body, color: af.textPrimary },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.redText, marginTop: 9 },
  stepText: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  sourcesRule: { borderTopWidth: afLayout.hairline, borderTopColor: af.divider, paddingTop: 10, marginTop: 2 },
  sourcesLine: { ...afType.eyebrow, color: af.textTertiary, textTransform: 'uppercase' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  why: { gap: 8 },
  whyText: { ...afType.secondary, color: af.textSecondary },
  sources: { gap: 2 },
  sourcesLabel: { ...afType.eyebrow, color: af.textTertiary, textTransform: 'uppercase' },
  source: { ...afType.caption, color: af.textTertiary },
  noticeCard: { marginTop: 16 },
  noticeInner: { gap: 8 },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeTitle: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  urgentTitle: { color: af.redText },
  noticeBody: { ...afType.secondary, color: af.textSecondary },
  remember: {
    padding: 12,
    borderRadius: afLayout.radiusCard,
    backgroundColor: af.canvas,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    gap: 4,
  },
  rememberTitle: { ...afType.bodyStrong, color: af.textPrimary },
  rememberBody: { ...afType.caption, color: af.textSecondary },
  rememberSaved: { ...afType.caption, color: af.green },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
