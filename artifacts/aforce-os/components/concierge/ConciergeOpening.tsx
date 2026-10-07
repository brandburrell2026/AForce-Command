/**
 * AForce Concierge — the opening (empty-state) surface.
 *
 *   [AFORCE · time]
 *   YOUR NEXT MOVE
 *   [the app's current approved command — same guarded string Home shows]
 *   One sentence on why it matters now (the engine's own explanation).
 *   Why this? · Ask a question
 *   ASK A FOLLOW-UP
 *   One suggested question · More · Personalize
 *
 * Nothing here is generated: the command and reason come from the engine
 * through the Decision Guard, exactly as Home renders them, so the opening and
 * the chat can never disagree about today's move. "Why this?" opens the
 * production Data-Behind-This sheet (§53/§54 freshness + quality), not model
 * text. Typography and hairlines come from the af tokens.
 *
 * Black Issue (2026-10-07): the screen masthead (wordmark, breadcrumb,
 * statement) is drawn by ConciergeScreen; this component draws the briefing
 * card — red "A" avatar + mono meta, red "YOUR NEXT MOVE" eyebrow, the command
 * — and the outlined follow-up chips. The reference's HYDRATION / EXPOSURE /
 * TRAVEL rows, bold summary sentence, SOURCES rows and spoken-briefing player
 * have no producer today (openingLogic yields one command, one reason, one
 * recheck clock, one suggested question) and are not drawn.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFDisclosureSheet, AFSectionLabel } from '@/components/ui';
import { AFCard } from '@/components/ui/AFCard';
import { AF_WORDMARK } from '@/components/ui/AFMasthead';
import { DataBehindThisSheet } from '@/components/DataBehindThisSheet';
import { gatherDataBehindSignals } from '@/utils/confidence/gatherDataBehindSignals';
import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import type { ConciergeClientContext } from '@/services/concierge/conciergeTypes';
import type { ProviderBiometrics, CommandConfidenceLevel } from '@/types';
import { ConciergeAvatar, ConciergePill } from './conciergeKit';
import { formatTurnTime } from './conciergePresentation';
import { firstSentence, pickSuggestedQuestion, recheckMinutesFrom, SUGGESTED_KEYS, type SuggestedKey } from './openingLogic';

export interface ConciergeOpeningProps {
  /** The SAME context object the server receives for a turn. */
  context: ConciergeClientContext;
  biometrics: ProviderBiometrics | undefined;
  confidence: CommandConfidenceLevel | null;
  onAsk: () => void;
  onPickQuestion: (text: string) => void;
  onPersonalize: () => void;
  testID?: string;
}

export function ConciergeOpening({ context, biometrics, confidence, onAsk, onPickQuestion, onPersonalize, testID = 'concierge-opening' }: ConciergeOpeningProps) {
  const { t } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const command = context.command;
  const parsed = command ? parseEngineActionCopy(command.action) : null;
  const reason = firstSentence(command?.explanation);
  const recheck = recheckMinutesFrom(context);
  const suggested = pickSuggestedQuestion(context);
  const signals = React.useMemo(() => gatherDataBehindSignals(biometrics), [biometrics]);
  // The reading's own clock (the context a turn would send), never a made-up time.
  const readTime = formatTurnTime(context.localTime.iso, context.locale);
  const metaLine = [AF_WORDMARK, readTime].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap} testID={testID}>
      <AFCard style={styles.card} testID={parsed ? `${testID}-command` : undefined}>
        <View style={styles.metaRow}>
          <ConciergeAvatar />
          <Text style={[styles.meta, eyebrowType]}>{metaLine}</Text>
        </View>

        {parsed ? (
          <View style={styles.command}>
            <Text style={[styles.eyebrow, eyebrowType]} accessibilityRole="header">
              {t('concierge.opening.title')}
            </Text>
            <Text style={styles.commandTitle}>{parsed.title}</Text>
            {parsed.instruction ? <Text style={styles.commandInstruction}>{parsed.instruction}</Text> : null}
            {reason ? <Text style={styles.reason}>{reason}</Text> : null}
            {recheck ? (
              <Text style={[styles.recheck, eyebrowType]}>{t('concierge.opening.recheck', { minutes: recheck })}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.noCommand} testID={`${testID}-no-command`}>{t('concierge.opening.no_command')}</Text>
        )}

        <View style={styles.actionsRow}>
          {parsed ? (
            <ConciergePill
              label={t('concierge.why_this')}
              onPress={() => setWhyOpen(true)}
              testID={`${testID}-why`}
            />
          ) : null}
          <ConciergePill
            label={t('concierge.opening.ask')}
            onPress={onAsk}
            testID={`${testID}-ask`}
          />
        </View>
      </AFCard>

      <View style={styles.followUp}>
        <AFSectionLabel label={t('concierge.opening.follow_up')} rule={false} />
      </View>
      <View style={styles.chips}>
        <ConciergePill
          label={t(`concierge.suggested.${suggested}`)}
          onPress={() => onPickQuestion(t(`concierge.suggested.${suggested}`))}
          testID={`${testID}-suggested-${suggested}`}
        />
        <ConciergePill label={t('concierge.opening.more')} onPress={() => setMoreOpen(true)} tone="quiet" testID={`${testID}-more`} />
        <ConciergePill label={t('concierge.opening.personalize')} onPress={onPersonalize} tone="quiet" testID={`${testID}-personalize`} />
      </View>

      <DataBehindThisSheet visible={whyOpen} onDismiss={() => setWhyOpen(false)} confidence={confidence} signals={signals} />

      <AFDisclosureSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={t('concierge.opening.more')} testID={`${testID}-more-sheet`}>
        <View style={styles.moreList}>
          {SUGGESTED_KEYS.filter((k) => k !== suggested).map((k: SuggestedKey) => (
            <Pressable
              key={k}
              onPress={() => {
                setMoreOpen(false);
                onPickQuestion(t(`concierge.suggested.${k}`));
              }}
              accessibilityRole="button"
              accessibilityLabel={t(`concierge.suggested.${k}`)}
              style={styles.moreRow}
              testID={`${testID}-more-${k}`}
            >
              <Text style={styles.moreText}>{t(`concierge.suggested.${k}`)}</Text>
              <Icon name="arrow-up-right" size={14} color={af.textTertiary} />
            </Pressable>
          ))}
        </View>
      </AFDisclosureSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16, gap: 14 },
  // The reference's briefing card carries a red rule down its left edge.
  card: { borderLeftWidth: 2, borderLeftColor: af.red, gap: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { ...afType.micro, color: af.textTertiary, flexShrink: 1 },
  eyebrow: { ...afType.eyebrow, color: af.redText, textTransform: 'uppercase' },
  followUp: { marginTop: 10 },
  command: { gap: 8 },
  commandTitle: { ...afType.title2, color: af.textPrimary },
  commandInstruction: { ...afType.title3, color: af.textPrimary },
  reason: { ...afType.secondary, color: af.textSecondary },
  recheck: { ...afType.eyebrow, color: af.textTertiary, textTransform: 'uppercase' },
  noCommand: { ...afType.title3, color: af.textSecondary },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreList: { gap: 2 },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: afLayout.controlMinHeight + 8, borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider },
  moreText: { ...afType.body, color: af.textPrimary, flex: 1 },
});
