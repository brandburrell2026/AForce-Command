/**
 * AForce Concierge — the opening (empty-state) surface.
 *
 *   YOUR NEXT MOVE.
 *   [the app's current approved command — same guarded string Home shows]
 *   One sentence on why it matters now (the engine's own explanation).
 *   Why this? · Ask a question
 *   ───────────────────────────
 *   One suggested question · More
 *
 * Nothing here is generated: the command and reason come from the engine
 * through the Decision Guard, exactly as Home renders them, so the opening and
 * the chat can never disagree about today's move. "Why this?" opens the
 * production Data-Behind-This sheet (§53/§54 freshness + quality), not model
 * text. Typography and hairlines come from the af tokens; no boxes.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFDisclosureSheet } from '@/components/ui';
import { DataBehindThisSheet } from '@/components/DataBehindThisSheet';
import { gatherDataBehindSignals } from '@/utils/confidence/gatherDataBehindSignals';
import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import type { ConciergeClientContext } from '@/services/concierge/conciergeTypes';
import type { ProviderBiometrics, CommandConfidenceLevel } from '@/types';
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

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.eyebrow, eyebrowType]} accessibilityRole="header">
        {t('concierge.opening.title').toUpperCase()}
      </Text>

      {parsed ? (
        <View style={styles.command} testID={`${testID}-command`}>
          <Text style={styles.commandTitle}>{parsed.title}</Text>
          {parsed.instruction ? <Text style={styles.commandInstruction}>{parsed.instruction}</Text> : null}
          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
          {recheck ? (
            <Text style={styles.recheck}>{t('concierge.opening.recheck', { minutes: recheck })}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.noCommand} testID={`${testID}-no-command`}>{t('concierge.opening.no_command')}</Text>
      )}

      <View style={styles.actionsRow}>
        {parsed ? (
          <Pressable
            onPress={() => setWhyOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('concierge.why_this')}
            style={styles.linkBtn}
            hitSlop={8}
            testID={`${testID}-why`}
          >
            <Text style={styles.link}>{t('concierge.why_this')}</Text>
          </Pressable>
        ) : null}
        {parsed ? <Text style={styles.dot}>·</Text> : null}
        <Pressable
          onPress={onAsk}
          accessibilityRole="button"
          accessibilityLabel={t('concierge.opening.ask')}
          style={styles.linkBtn}
          hitSlop={8}
          testID={`${testID}-ask`}
        >
          <Text style={styles.link}>{t('concierge.opening.ask')}</Text>
        </Pressable>
      </View>

      <View style={styles.rule} />

      <Pressable
        onPress={() => onPickQuestion(t(`concierge.suggested.${suggested}`))}
        accessibilityRole="button"
        accessibilityLabel={t(`concierge.suggested.${suggested}`)}
        style={styles.suggestionRow}
        testID={`${testID}-suggested-${suggested}`}
      >
        <Text style={styles.suggestion}>{t(`concierge.suggested.${suggested}`)}</Text>
        <Icon name="arrow-up-right" size={16} color={af.textSecondary} />
      </Pressable>

      <View style={styles.footerRow}>
        <Pressable onPress={() => setMoreOpen(true)} accessibilityRole="button" accessibilityLabel={t('concierge.opening.more')} hitSlop={8} style={styles.linkBtn} testID={`${testID}-more`}>
          <Text style={styles.linkQuiet}>{t('concierge.opening.more')}</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={onPersonalize} accessibilityRole="button" accessibilityLabel={t('concierge.opening.personalize')} hitSlop={8} style={styles.linkBtn} testID={`${testID}-personalize`}>
          <Text style={styles.linkQuiet}>{t('concierge.opening.personalize')}</Text>
        </Pressable>
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
  wrap: { paddingTop: 12, gap: 14 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  command: { gap: 8 },
  commandTitle: { ...afType.displayHero, color: af.textPrimary },
  commandInstruction: { ...afType.title3, color: af.textPrimary },
  reason: { ...afType.body, color: af.textSecondary, marginTop: 4 },
  recheck: { ...afType.caption, color: af.textTertiary },
  noCommand: { ...afType.title3, color: af.textSecondary },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  linkBtn: { minHeight: afLayout.controlMinHeight, justifyContent: 'center' },
  link: { ...afType.bodyStrong, color: af.textPrimary },
  linkQuiet: { ...afType.secondary, color: af.textSecondary },
  dot: { ...afType.secondary, color: af.textTertiary },
  rule: { height: afLayout.hairline, backgroundColor: af.divider, marginTop: 6 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: afLayout.controlMinHeight + 8 },
  suggestion: { ...afType.body, color: af.textPrimary, flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moreList: { gap: 2 },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: afLayout.controlMinHeight + 8, borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider },
  moreText: { ...afType.body, color: af.textPrimary, flex: 1 },
});
