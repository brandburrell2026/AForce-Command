/**
 * Community Sharing — the circle privacy-visibility control, relocated from
 * the stranded `/circles` island (founder relocation ruling 2026-08-27:
 * "makes privacy discoverable; defaults to private/safe behavior; does not
 * expose health state publicly; preserves current settings; no second
 * Circle system").
 *
 * Durable authority is UNCHANGED: `services/privacyService` (api-server
 * `/api/privacy`, one row per member) — the exact service the island's
 * `MySharedStatusScreen` used, called verbatim, so existing settings are
 * preserved by construction. PRIVATE-BY-DEFAULT: the founder's 2026-08-27
 * ruling supersedes the previously recorded 'circle' default.
 *
 * TRUTH: the preview feeds REAL state only — score + performance state from
 * the engine, streak from `complianceStreak` (the S2-15 one-truth winner),
 * trend from `derivePerformanceForecast`'s trajectory (one authority, no
 * copied thresholds). `protocolComplete` has NO live producer anywhere, so
 * it previews as `false` — the island screen's hardcoded `streakDays: 9 /
 * protocolComplete: true / trend: 'up'` fabrications do not relocate.
 * `projectSharedStatus`'s only consumer remains this preview — no surface
 * sends health state to anyone.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFSectionLabel, AFListRow } from '@/components/ui';
import SharedStatusCard from '@/components/SharedStatusCard';
import { af, afLayout, afType } from '@/theme';
import { hapticSelection } from '@/services/haptics';
import { useAppStore } from '@/store/useAppStore';
import {
  getPrivacy, setScope, setField, projectSharedStatus, subscribePrivacy,
} from '@/services/privacyService';
import { derivePerformanceForecast } from '@/services/biometricIntelligence';
import type {
  PrivacySettings, ShareScope, SharedStatus, SharedStateLabel, TrendDirection,
} from '@/types/circle';

const SCOPES: ShareScope[] = ['private', 'circle', 'team_coach', 'public_card'];

function levelToStateLabel(level: string): SharedStateLabel {
  switch (level) {
    case 'PEAK':       return 'Peak';
    case 'RECOVERING': return 'Recovering';
    case 'DEPLETED':   return 'Depleted';
    default:           return 'Balanced';
  }
}

const TRAJECTORY_TO_TREND: Record<string, TrendDirection> = {
  rising: 'up', stable: 'flat', declining: 'down',
};

export default function CommunitySharingRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state } = useAppStore();
  const { performanceState, score } = state.engineOutput;

  const [privacy, setPrivacy] = React.useState<PrivacySettings>(() => getPrivacy());
  React.useEffect(() => subscribePrivacy(setPrivacy), []);

  const forecast = React.useMemo(
    () => derivePerformanceForecast(state.engineOutput, state.userState),
    [state.engineOutput, state.userState],
  );

  const myStatus: SharedStatus = React.useMemo(() => ({
    userId: 'me',
    score,
    state: levelToStateLabel(performanceState.level),
    streakDays: Math.max(0, state.userState.complianceStreak ?? 0),
    // No live producer exists for protocol completion — preview the honest
    // floor rather than the island screen's invented `true`.
    protocolComplete: false,
    trend: TRAJECTORY_TO_TREND[forecast.trajectory] ?? 'flat',
    updatedAt: new Date().toISOString(),
  }), [score, performanceState.level, state.userState.complianceStreak, forecast.trajectory]);

  const projected = React.useMemo(() => projectSharedStatus(myStatus), [myStatus, privacy]);

  const updateScope = (next: ShareScope) => {
    if (Platform.OS !== 'web') hapticSelection();
    setScope(next);
  };

  return (
    <AFScreen scroll testID="community-sharing-screen">
      <AFTopBar
        eyebrow={t('communitySharing.eyebrow')}
        title={t('communitySharing.title')}
        onBack={() => router.back()}
      />

      <View style={styles.section}>
        <AFSectionLabel label={t('communitySharing.preview_label')} />
        <SharedStatusCard
          status={projected}
          yourName={t('communitySharing.preview_you')}
          yourInitials="YOU"
          visibilityLabel={t(`communitySharing.visibility_${privacy.scope}`)}
        />
        <Text style={styles.previewNote}>{t('communitySharing.preview_note')}</Text>
      </View>

      <View style={styles.section}>
        <AFSectionLabel label={t('communitySharing.visibility_label')} />
        <View style={styles.scopeList} accessibilityRole="radiogroup">
          {SCOPES.map((id) => {
            const active = privacy.scope === id;
            return (
              <Pressable
                key={id}
                onPress={() => updateScope(id)}
                style={[styles.scopeRow, active && styles.scopeRowActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, checked: active }}
                accessibilityLabel={t(`communitySharing.scope_${id}`)}
                testID={`community-sharing-scope-${id}`}
              >
                <View style={[styles.radio, active && styles.radioActive]} />
                <View style={styles.scopeText}>
                  <Text style={styles.scopeLabel}>{t(`communitySharing.scope_${id}`)}</Text>
                  <Text style={styles.scopeSub}>{t(`communitySharing.scope_${id}_sub`)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.section, styles.lastSection]}>
        <AFSectionLabel label={t('communitySharing.fields_label')} />
        <View style={styles.fieldsCard}>
          <AFListRow title={t('communitySharing.field_score')} toggle={{ value: privacy.fields.score, onValueChange: (v) => setField('score', v) }} testID="community-sharing-field-score" />
          <AFListRow title={t('communitySharing.field_state')} toggle={{ value: privacy.fields.state, onValueChange: (v) => setField('state', v) }} testID="community-sharing-field-state" />
          <AFListRow title={t('communitySharing.field_streak')} toggle={{ value: privacy.fields.streak, onValueChange: (v) => setField('streak', v) }} testID="community-sharing-field-streak" />
          <AFListRow title={t('communitySharing.field_protocol')} toggle={{ value: privacy.fields.protocol, onValueChange: (v) => setField('protocol', v) }} testID="community-sharing-field-protocol" />
          <AFListRow title={t('communitySharing.field_trend')} toggle={{ value: privacy.fields.trend, onValueChange: (v) => setField('trend', v) }} testID="community-sharing-field-trend" />
        </View>
      </View>
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 24 },
  lastSection: { marginBottom: 40 },
  previewNote: { ...afType.caption, color: af.textTertiary },
  scopeList: { gap: 8 },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  scopeRowActive: { borderColor: af.green, backgroundColor: af.surfaceRaised },
  radio: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: af.textTertiary,
  },
  radioActive: { backgroundColor: af.green, borderColor: af.green },
  scopeText: { flex: 1, gap: 2 },
  scopeLabel: { ...afType.bodyStrong, color: af.textPrimary },
  scopeSub: { ...afType.caption, color: af.textSecondary },
  fieldsCard: {
    backgroundColor: af.surface,
    borderRadius: afLayout.radiusCard,
    borderWidth: afLayout.hairline, borderColor: af.border,
    paddingHorizontal: 4,
  },
});
