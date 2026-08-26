/**
 * MySharedStatusScreen — preview what others see + control privacy scope
 * and per-field share toggles. Single source of truth for projection is
 * `privacyService.projectSharedStatus`.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '@/services/haptics';

import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { getPrivacy, setScope, setField, projectSharedStatus, subscribePrivacy } from '@/services/privacyService';
import type { PrivacySettings, ShareScope, SharedStatus, SharedStateLabel } from '@/types/circle';
import SharedStatusCard from '@/components/SharedStatusCard';

const SCOPES: { id: ShareScope; label: string; sub: string }[] = [
  { id: 'private',     label: 'PRIVATE',          sub: 'Visible only to you.' },
  { id: 'circle',      label: 'CIRCLE ONLY',      sub: 'Friends, team, coach, family.' },
  { id: 'team_coach',  label: 'TEAM AND COACH',   sub: 'Performance group only.' },
  { id: 'public_card', label: 'PUBLIC SHARE CARD', sub: 'A single card you choose to send out.' },
];

function levelToStateLabel(level: string): SharedStateLabel {
  switch (level) {
    case 'PEAK':       return 'Peak';
    case 'RECOVERING': return 'Recovering';
    case 'DEPLETED':   return 'Depleted';
    default:           return 'Balanced';
  }
}

export const MySharedStatusScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { performanceState, score } = state.engineOutput;

  const [privacy, setPrivacy] = React.useState<PrivacySettings>(() => getPrivacy());
  React.useEffect(() => subscribePrivacy(setPrivacy), []);

  const myStatus: SharedStatus = React.useMemo(() => ({
    userId: 'me',
    score,
    state: levelToStateLabel(performanceState.level),
    streakDays: 9,
    protocolComplete: true,
    trend: 'up',
    updatedAt: new Date().toISOString(),
  }), [score, performanceState.level]);

  const projected = React.useMemo(() => projectSharedStatus(myStatus), [myStatus, privacy]);

  const updateScope = (next: ShareScope) => {
    if (Platform.OS !== 'web') hapticSelection();
    setScope(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>WHAT OTHERS SEE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREVIEW</Text>
          <SharedStatusCard status={projected} yourName="You" yourInitials="YOU" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VISIBILITY</Text>
          <View style={styles.scopeList}>
            {SCOPES.map(s => {
              const active = privacy.scope === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => updateScope(s.id)}
                  style={[styles.scopeRow, active && styles.scopeRowActive]}
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={s.label}
                >
                  <View style={[styles.radio, active && styles.radioActive]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.scopeLabel}>{s.label}</Text>
                    <Text style={styles.scopeSub}>{s.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FIELDS SHARED</Text>
          <View style={styles.fieldsCard}>
            <FieldToggle label="Score"            on={privacy.fields.score}    onChange={(v) => setField('score', v)} />
            <FieldToggle label="State"            on={privacy.fields.state}    onChange={(v) => setField('state', v)} />
            <FieldToggle label="Streak"           on={privacy.fields.streak}   onChange={(v) => setField('streak', v)} />
            <FieldToggle label="Protocol status"  on={privacy.fields.protocol} onChange={(v) => setField('protocol', v)} />
            <FieldToggle label="Trend direction"  on={privacy.fields.trend}    onChange={(v) => setField('trend', v)} last />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const FieldToggle: React.FC<{ label: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }> = ({ label, on, onChange, last }) => (
  <View style={[styles.fieldRow, !last && styles.fieldRowDivider]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Switch
      value={on}
      onValueChange={onChange}
      trackColor={{ true: Colors.states.PEAK.primary, false: Colors.fill.strong }}
      thumbColor={Colors.background.primary}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: Colors.text.primary, fontSize: 12, letterSpacing: 4, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 24 },
  section: { gap: 12 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  scopeList: { gap: 8 },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  scopeRowActive: { borderColor: Colors.border.strong, backgroundColor: Colors.fill.strong },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Colors.border.strong },
  radioActive: { backgroundColor: Colors.text.primary, borderColor: Colors.text.primary },
  scopeLabel: { color: Colors.text.primary, fontSize: 13, letterSpacing: 1.5, fontWeight: '700' },
  scopeSub:   { color: Colors.text.muted, fontSize: 12 },
  fieldsCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  fieldRowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  fieldLabel: { color: Colors.text.primary, fontSize: 14 },
});

export default MySharedStatusScreen;
