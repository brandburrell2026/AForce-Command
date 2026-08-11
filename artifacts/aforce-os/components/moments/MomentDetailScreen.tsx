/**
 * MomentDetailScreen — the flagship Moments surface (Phases 1–2, founder
 * approval 2026-08-12): one moment's PAUSE → HYDRATE → LOCK IN → PERFORM
 * ritual as a compact vertical progression. Visually benchmarked against
 * Recovery Stage / Community / Performance Signal: AFTopBar header, charcoal
 * cards, one dominant active stage (green), muted upcoming stages, no giant
 * standalone cards, no decorative motion.
 *
 * Stage titles reuse the shipped Opening Sequence ritual keys
 * (opening.ritual_*) — one ritual identity across the OS. The ritual states
 * are pure engine output (services/momentRecommendation.ts); I'M READY marks
 * the moment prepared in the Moments store only (Score Protection: nothing
 * here touches score or hydration state).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFPrimaryButton } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { af, afType, Spacing } from '@/theme';
import type { Moment, MomentRecommendation, RitualStage } from '@/types/moments';
import { updateMoment } from '@/services/momentsStore';
import { clockLabel, prepWindowLabel, startsIn } from './momentsPresentation';
import { WhyThisSheet } from './WhyThisSheet';

const STAGE_ICON: Record<RitualStage['key'], IconName> = {
  pause: 'pause',
  hydrate: 'droplet',
  lock_in: 'target',
  perform: 'zap',
};

const STAGE_TITLE_KEY: Record<RitualStage['key'], string> = {
  pause: 'opening.ritual_pause',
  hydrate: 'opening.ritual_hydrate',
  lock_in: 'opening.ritual_lock_in',
  perform: 'opening.ritual_perform',
};

export function MomentDetailScreen({
  moment,
  rec,
  nowIso,
  readOnly,
}: {
  moment: Moment;
  rec: MomentRecommendation;
  nowIso: string;
  /** Gallery/demo fixtures render without store writes. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const eta = startsIn(moment.startAtIso, nowIso);
  const prepared = Boolean(moment.preparedAtIso);

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={clockLabel(moment.startAtIso)}
        title={moment.title}
        onBack={() => router.back()}
      />

      {/* Window + countdown — compact metric pair, comp layout */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>{t('moments.prep_window')}</Text>
          <Text style={styles.metaValue}>{prepWindowLabel(rec)}</Text>
        </View>
        {eta ? (
          <View style={[styles.metaCell, styles.metaCellEnd]}>
            <Text style={styles.metaLabel}>{t('moments.starts_in')}</Text>
            <Text style={[styles.metaValue, { color: af.green }]}>
              {eta.hours > 0
                ? t('moments.in_h_m', { h: eta.hours, m: eta.minutes })
                : t('moments.in_m', { m: eta.minutes })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* The Ritual — one linear progression, active stage dominant */}
      <View style={styles.ritual} testID="moment-ritual">
        {rec.ritual.map((stage, i) => (
          <RitualStageRow
            key={stage.key}
            stage={stage}
            last={i === rec.ritual.length - 1}
            t={t}
          />
        ))}
      </View>

      {/* WHY THIS — concise, plain language, no scores */}
      <View style={styles.why} testID="moment-why">
        <Text style={styles.whyLabel}>{t('moments.why_this')}</Text>
        <Text style={styles.whyBody}>{t(rec.evidence.summaryKey)}</Text>
      </View>

      <AFPrimaryButton
        label={prepared ? t('moments.status_completed') : t('moments.im_ready')}
        onPress={() => {
          if (!prepared && !readOnly) {
            updateMoment(moment.id, { preparedAtIso: new Date().toISOString() });
          }
        }}
        disabled={prepared}
        testID="moment-im-ready"
      />

      <WhyThisSheet rec={rec} visible={whyOpen} onClose={() => setWhyOpen(false)} />
    </AFScreen>
  );
}

function RitualStageRow({
  stage,
  last,
  t,
}: {
  stage: RitualStage;
  last: boolean;
  t: TFunction;
}) {
  const active = stage.state === 'active';
  const done = stage.state === 'completed';
  const accent = done ? af.green : active ? af.green : af.textTertiary;

  return (
    <View style={styles.stageRow}>
      <View style={styles.stageRail}>
        <View
          style={[
            styles.stageNode,
            { borderColor: accent },
            (done || active) && { backgroundColor: done ? af.green : `${af.green}26` },
          ]}
        >
          {done ? (
            <Icon name="check" size={12} color={af.canvas} />
          ) : (
            <Icon name={STAGE_ICON[stage.key]} size={13} color={active ? af.green : af.textTertiary} />
          )}
        </View>
        {!last && <View style={[styles.stageConnector, done && { backgroundColor: `${af.green}66` }]} />}
      </View>
      <View
        style={[
          styles.stageBody,
          active && styles.stageBodyActive,
          last && styles.stageBodyLast,
        ]}
      >
        <View style={styles.stageHeader}>
          <Text style={[styles.stageTitle, active && { color: af.green }, done && { color: af.textPrimary }]}>
            {t(STAGE_TITLE_KEY[stage.key])}
          </Text>
          <Text style={[styles.stageMeta, active && { color: af.green }]}>
            {active ? t('moments.do_this_now') : clockLabel(stage.atIso)}
          </Text>
        </View>
        <Text style={[styles.stageInstruction, active && { color: af.textPrimary }]}>
          {t(stage.instructionKey, stage.instructionParams)}
        </Text>
      </View>
    </View>
  );
}

const NODE = 26;
const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8], gap: 20 },
  metaRow: {
    flexDirection: 'row', marginTop: 6, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  metaCell: { flex: 1, gap: 3 },
  metaCellEnd: { alignItems: 'flex-end' },
  metaLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  metaValue: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  ritual: { marginTop: 4 },
  stageRow: { flexDirection: 'row', gap: 14 },
  stageRail: { alignItems: 'center', width: NODE },
  stageNode: {
    width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: af.surface,
  },
  stageConnector: { flex: 1, width: 2, backgroundColor: af.divider, marginVertical: 4 },
  stageBody: { flex: 1, paddingBottom: 22, gap: 3 },
  stageBodyActive: {
    backgroundColor: `${af.green}0D`, borderWidth: 1, borderColor: `${af.green}44`,
    borderRadius: 14, padding: 12, marginBottom: 22, paddingBottom: 12,
  },
  stageBodyLast: { paddingBottom: 0, marginBottom: 0 },
  stageHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  stageTitle: { ...afType.eyebrow, color: af.textSecondary, letterSpacing: 1.6 },
  stageMeta: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  stageInstruction: { ...afType.body, color: af.textSecondary },
  why: {
    padding: 14, borderRadius: 14, gap: 6,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  whyLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  whyBody: { ...afType.body, color: af.textSecondary, lineHeight: 22 },
});
