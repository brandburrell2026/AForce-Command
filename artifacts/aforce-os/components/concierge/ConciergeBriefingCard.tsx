/**
 * AForce Concierge — on-demand daily briefing.
 *
 * Nothing is generated until the member asks. The result is a normal gated
 * turn (answer + next step + optional why) rendered inline, with the
 * generation time stated so stale briefings are never mistaken for live.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { AFSecondaryButton, AFSkeleton, AFTextButton } from '@/components/ui';
import type { ConciergeAssistantTurn } from '@/services/concierge/conciergeTypes';
import type { ConciergeErrorKind } from '@/services/concierge/conciergeApi';
import { errorKindToLocal, localNoticeCopy, noticeCopyFor } from './conciergePresentation';

export interface ConciergeBriefingCardProps {
  turn: ConciergeAssistantTurn | null;
  generatedAt: string | null;
  loading: boolean;
  error: ConciergeErrorKind | null;
  onRequest: () => void;
  testID?: string;
}

export function ConciergeBriefingCard({ turn, generatedAt, loading, error, onRequest, testID = 'concierge-briefing' }: ConciergeBriefingCardProps) {
  const { t, i18n } = useTranslation();
  const notice = turn ? noticeCopyFor(turn, t) : null;
  const local = error ? localNoticeCopy(errorKindToLocal(error), t) : null;

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">{t('concierge.briefing_title')}</Text>
        {turn || error ? (
          <AFTextButton label={t('concierge.briefing_refresh')} onPress={onRequest} disabled={loading} testID={`${testID}-refresh`} />
        ) : null}
      </View>

      {loading ? (
        <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('concierge.thinking')}>
          <AFSkeleton height={16} width="92%" />
          <AFSkeleton height={16} width="78%" />
          <AFSkeleton height={16} width="60%" />
        </View>
      ) : local ? (
        <Text style={styles.notice} accessibilityRole="alert">{local.body}</Text>
      ) : notice ? (
        <Text style={styles.notice} accessibilityRole="alert">{notice.body}</Text>
      ) : turn ? (
        <View style={styles.body}>
          <Text style={styles.answer}>{turn.answer}</Text>
          {turn.nextStep ? <Text style={styles.next}>{turn.nextStep}</Text> : null}
          {turn.why ? <Text style={styles.why}>{turn.why}</Text> : null}
          {generatedAt ? (
            <Text style={styles.meta}>
              {t('concierge.briefing_generated', {
                time: new Date(generatedAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' }),
              })}
            </Text>
          ) : null}
        </View>
      ) : (
        <AFSecondaryButton label={t('concierge.briefing_cta')} onPress={onRequest} testID={`${testID}-request`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: afLayout.cardPadding,
    borderRadius: afLayout.radiusCard,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...afType.title3, color: af.textPrimary },
  skeletons: { gap: 8 },
  body: { gap: 6 },
  answer: { ...afType.body, color: af.textPrimary },
  next: { ...afType.bodyStrong, color: af.textPrimary },
  why: { ...afType.secondary, color: af.textSecondary },
  meta: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  notice: { ...afType.secondary, color: af.textSecondary },
});
