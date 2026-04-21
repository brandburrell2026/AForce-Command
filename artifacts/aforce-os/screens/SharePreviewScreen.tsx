/**
 * Share Preview screen — pick a format, pick a message variation, share.
 *
 * Reachable as the route `/share`. Reads share context from query params:
 *   /share?type=score&score=88&state=Balanced
 *   /share?type=streak&streakDays=7
 *   /share?type=heat_save
 *
 * If params are missing it derives a sensible "current state" share from
 * the live engine output in the app store.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';

import type { ShareContext, ShareFormat, ShareType, StateLabel } from '@/types/share';
import { generateShareVariations } from '@/services/shareTemplateEngine';
import { openShareSheet, shareToSocial, buildShareItem, type SocialPlatform } from '@/services/shareService';
import ShareCard from '@/components/ShareCard';
import ShareStory from '@/components/ShareStory';
import ShareText from '@/components/ShareText';

const FORMATS: { id: ShareFormat; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'card',  label: 'CARD',  icon: 'square'    },
  { id: 'story', label: 'STORY', icon: 'smartphone' },
  { id: 'text',  label: 'TEXT',  icon: 'type'      },
];

function levelToStateLabel(level: string): StateLabel {
  switch (level) {
    case 'PEAK':       return 'Peak';
    case 'RECOVERING': return 'Recovering';
    case 'DEPLETED':   return 'Depleted';
    default:           return 'Balanced';
  }
}

function readParam(params: Record<string, string | string[] | undefined>, k: string): string | undefined {
  const v = params[k];
  return Array.isArray(v) ? v[0] : v;
}

function parseContext(
  params: Record<string, string | string[] | undefined>,
  fallback: ShareContext,
): ShareContext {
  const type = (readParam(params, 'type') as ShareType | undefined) ?? fallback.type;
  const scoreRaw = readParam(params, 'score');
  const stateParam = readParam(params, 'state') as StateLabel | undefined;
  const deltaRaw = readParam(params, 'delta');
  const streakRaw = readParam(params, 'streakDays');
  const score = scoreRaw != null ? Number(scoreRaw) : fallback.score;
  const delta = deltaRaw != null ? Number(deltaRaw) : undefined;
  const streakDays = streakRaw != null ? Number(streakRaw) : undefined;
  return {
    type,
    score: Number.isFinite(score) ? score : fallback.score,
    state: stateParam ?? fallback.state,
    delta: Number.isFinite(delta) ? delta : undefined,
    streakDays: Number.isFinite(streakDays) ? streakDays : undefined,
    rankLabel: readParam(params, 'rankLabel'),
    protocolLabel: readParam(params, 'protocolLabel'),
  };
}

export const SharePreviewScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { performanceState, score: liveScore } = state.engineOutput;

  // Default: share the current performance score / state.
  const fallbackContext: ShareContext = React.useMemo(() => ({
    type: 'score',
    score: liveScore,
    state: levelToStateLabel(performanceState.level),
  }), [liveScore, performanceState.level]);

  const ctx = React.useMemo(() => parseContext(params, fallbackContext), [params, fallbackContext]);

  const variations = React.useMemo(() => generateShareVariations(ctx), [ctx]);
  const [variantIdx, setVariantIdx] = React.useState(0);
  const [format, setFormat] = React.useState<ShareFormat>('card');
  const [sharing, setSharing] = React.useState(false);

  // Reset variant index if context changes and the index is out of range.
  React.useEffect(() => {
    if (variantIdx >= variations.length) setVariantIdx(0);
  }, [variations, variantIdx]);

  const message = variations[variantIdx]?.text ?? '';

  /**
   * Single dispatch path for every share button on this screen.
   *
   * Passing `platform` routes through `shareToSocial` (deep-link / web
   * intent) for X / Facebook / LinkedIn / WhatsApp / Telegram / SMS.
   * Instagram + the default "More" button fall through to the OS share
   * sheet — Instagram because IG only accepts image/video payloads via
   * deep link, "More" because that's the user's intent.
   */
  const dispatchShare = async (platform: SocialPlatform = 'system') => {
    if (!message || sharing) return;
    setSharing(true);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const ok = platform === 'system'
      ? await openShareSheet({ format, message })
      : await shareToSocial(platform, { format, message });
    if (ok) {
      buildShareItem(format, message, ctx); // local record; server event TBD
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    setSharing(false);
  };

  const onShare = () => dispatchShare('system');

  /**
   * Quick-share targets surfaced as a horizontal row of icons.
   * Order is the most-requested-first list (X / IG / FB are the top three
   * for share-to-social on consumer apps, then messengers).
   */
  const SOCIAL_TARGETS: ReadonlyArray<{
    id: SocialPlatform;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    tint: string;
  }> = [
    { id: 'x',         label: 'X',         icon: 'twitter',          tint: '#FFFFFF' },
    { id: 'instagram', label: 'Instagram', icon: 'instagram',        tint: '#E1306C' },
    { id: 'facebook',  label: 'Facebook',  icon: 'facebook',         tint: '#1877F2' },
    { id: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin',         tint: '#0A66C2' },
    { id: 'whatsapp',  label: 'WhatsApp',  icon: 'message-circle',   tint: '#25D366' },
    { id: 'telegram',  label: 'Telegram',  icon: 'send',             tint: '#26A5E4' },
    { id: 'sms',       label: 'Messages',  icon: 'message-square',   tint: Colors.text.primary },
    { id: 'system',    label: 'More',      icon: 'more-horizontal',  tint: Colors.text.primary },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityLabel="Close share preview"
        >
          <Feather name="x" size={20} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>SHARE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewWrap}>
          {format === 'card'  && <ShareCard  message={message} context={ctx} />}
          {format === 'story' && <ShareStory message={message} context={ctx} />}
          {format === 'text'  && <ShareText  message={message} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SHARE TO</Text>
          {/*
            One-tap social targets. Each opens that network's share intent
            (or the OS share sheet for Instagram + "More"). The row is
            horizontally scrollable so we never have to drop a platform on
            narrow phones — the visible quartet is always the highest-
            priority targets (X · Instagram · Facebook · LinkedIn).
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.socialRow}
          >
            {SOCIAL_TARGETS.map((target) => (
              <Pressable
                key={target.id}
                onPress={() => dispatchShare(target.id)}
                disabled={sharing}
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && !sharing && { opacity: 0.85 },
                  sharing && { opacity: 0.5 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Share to ${target.label}`}
                testID={`share-to-${target.id}`}
              >
                <View style={[styles.socialIconCircle, { borderColor: `${target.tint}55` }]}>
                  <Feather name={target.icon} size={18} color={target.tint} />
                </View>
                <Text style={styles.socialLabel} numberOfLines={1}>{target.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FORMAT</Text>
          <View style={styles.formatRow}>
            {FORMATS.map((f) => {
              const active = f.id === format;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    setFormat(f.id);
                  }}
                  style={[styles.formatBtn, active && styles.formatBtnActive]}
                  accessibilityLabel={`${f.label} format`}
                  accessibilityState={{ selected: active }}
                >
                  <Feather name={f.icon} size={14} color={active ? Colors.text.inverse : Colors.text.primary} />
                  <Text style={[styles.formatBtnText, active && styles.formatBtnTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MESSAGE</Text>
          <View style={styles.variantsCol}>
            {variations.map((v, i) => {
              const active = i === variantIdx;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    setVariantIdx(i);
                  }}
                  style={[styles.variantBtn, active && styles.variantBtnActive]}
                  accessibilityLabel={`Message option ${i + 1}: ${v.text}`}
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.radio, active && styles.radioActive]} />
                  <Text style={styles.variantText}>{v.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={({ pressed }) => [
            styles.cta,
            (pressed || sharing) && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open share sheet"
        >
          <Feather name="share" size={16} color={Colors.text.inverse} />
          <Text style={styles.ctaText}>{sharing ? 'OPENING…' : 'SHARE'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text.primary,
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },
  previewWrap: { marginTop: 4 },
  section: { gap: 10 },
  sectionLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  socialRow: { flexDirection: 'row', gap: 14, paddingVertical: 4, paddingRight: 8 },
  socialBtn: { alignItems: 'center', gap: 6, width: 64 },
  socialIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  socialLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '600',
    textAlign: 'center',
  },
  formatRow: { flexDirection: 'row', gap: 8 },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  formatBtnActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  formatBtnText: {
    color: Colors.text.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
  formatBtnTextActive: { color: Colors.text.inverse },
  variantsCol: { gap: 8 },
  variantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  variantBtnActive: {
    borderColor: Colors.border.strong,
    backgroundColor: Colors.fill.strong,
  },
  radio: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border.strong,
  },
  radioActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  variantText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.primary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.text.primary,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: Colors.text.inverse,
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: '700',
  },
});

export default SharePreviewScreen;
