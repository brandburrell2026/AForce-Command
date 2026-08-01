/**
 * Night Out Protocol — authorized entry inside the Protocol tab (NO-b).
 *
 * Renders NOTHING unless Night Out is authorized for this context
 * (`isNightOutEnabled` = restricted flag ON **and** approved internal-preview
 * context). So in production/default builds it is invisible and un-enterable,
 * the five bottom tabs are unchanged, and there is no discoverable surface.
 *
 * When authorized (internal/demo), it shows one calm entry that routes to the
 * canonical `/night-out` route. This is placement + navigation ONLY — it does
 * NOT build the active Night Out command experience (that is NO-c). No scoring,
 * alcohol, intake, or session state is touched.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';
import { useFeatureFlags } from '@/store/useAppStore';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import {
  NIGHT_OUT_PUBLIC_NAME,
  NIGHT_OUT_DESCRIPTOR,
  NIGHT_OUT_EYEBROW,
} from '@/services/nightOut/naming';

export function NightOutProtocolEntry() {
  const flags = useFeatureFlags();
  const router = useRouter();

  // Restricted flag + approved internal-preview context are BOTH required.
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) return null;

  return (
    <Pressable
      onPress={() => router.push('/night-out' as unknown as Href)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${NIGHT_OUT_PUBLIC_NAME}. ${NIGHT_OUT_DESCRIPTOR}`}
      testID="protocol-night-out-entry"
    >
      <View style={styles.textCol}>
        <Text style={styles.eyebrow}>{NIGHT_OUT_EYEBROW}</Text>
        <Text style={styles.title}>{NIGHT_OUT_PUBLIC_NAME}</Text>
        <Text style={styles.descriptor}>{NIGHT_OUT_DESCRIPTOR}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={af.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
    marginBottom: 16,
  },
  textCol: { flex: 1, gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.title3, color: af.textPrimary },
  descriptor: { ...afType.caption, color: af.textTertiary },
});
