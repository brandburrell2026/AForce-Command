/**
 * scanKit — S2-8b: the Scan screen's presentational layer, extracted from
 * `HydrationScanScreenV2.tsx` (stage-2 analog of `profileKit.tsx`).
 *
 * ONE-WAY RULE: the screen imports from this kit; this kit must never import
 * from the screen (pinned by `scanKitS28b.test.ts`).
 *
 * The helpers and the stylesheet are byte-moved from the screen. The single
 * deliberate transform in the move: the 25 hand-written `'Inter_*'` family
 * string literals become `Typography.fonts.*` tokens — the token VALUES are
 * these exact strings (theme/typography.ts), so the rendered output is
 * unchanged and the family source of truth is single again (S2-4 precedent).
 *
 * NOTE (S2-8b scale finding, deliberately NOT resolved here): this sheet
 * speaks a 9-14px tracked-micro dialect with zero exact (family, size) pairs
 * on the afType scale — consolidating onto afType would visibly resize an
 * approved surface, so sizes stay as designed pending a founder/design call.
 */
import { StyleSheet } from 'react-native';
import { af, afAlpha, withAlpha, Typography } from '@/theme';

export function verdictColor(v: string): string {
  switch (v) {
    case 'optimal': return af.green;
    case 'strong': return af.green;
    case 'acceptable': return af.amber;
    case 'suboptimal': return af.red;
    case 'avoid': return af.red;
    default: return af.textTertiary;
  }
}

export function impactColor(level: string): string {
  switch (level) {
    case 'HIGH_SUPPORT': return af.green;
    case 'NEUTRAL': return af.cyan;
    case 'MODERATE_IMPACT': return af.amber;
    case 'HIGH_IMPACT': return af.red;
    default: return af.textTertiary;
  }
}

// af.red (#C1281B) is a fill/border color — it measures ~3.3:1 as TEXT on
// these dark surfaces, under the 4.5:1 AA floor. verdictColor/impactColor
// above are shared with dot backgroundColor (fills are fine at af.red);
// this wrapper is for the two Text usages only, swapping to af.redText
// (~5:1, AA-verified) without touching the dot fill color.
export function toTextSafeColor(color: string): string {
  return color === af.red ? af.redText : color;
}

export function formatRelativeTime(iso: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  const diff = Date.now() - parsed;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('hydroScan2.v2.time_just_now');
  if (m < 60) return t('hydroScan2.v2.time_m_ago', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hydroScan2.v2.time_h_ago', { h });
  const d = Math.floor(h / 24);
  return t('hydroScan2.v2.time_d_ago', { d });
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: af.green,
  },
  content: { paddingHorizontal: 20, gap: 14 },

  historyCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
    gap: 10,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyHeaderText: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 1.2,
    color: af.textTertiary,
    fontFamily: Typography.fonts.bold,
  },
  historySync: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: af.green,
    fontFamily: Typography.fonts.bold,
  },
  historyAdvisory: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: af.textTertiary,
    fontFamily: Typography.fonts.bold,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDot: { width: 6, height: 6, borderRadius: 3 },
  historyTitle: { fontSize: 13, color: af.textPrimary, fontFamily: Typography.fonts.semibold },
  historyMeta: { fontSize: 11, color: af.textTertiary, marginTop: 2 },
  historyVerdict: { fontSize: 10, letterSpacing: 1, fontFamily: Typography.fonts.bold },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontFamily: Typography.fonts.bold, color: af.textTertiary, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: Typography.fonts.bold, color: af.textPrimary, letterSpacing: -0.6, marginTop: 2 },

  viewfinder: {
    height: 200, borderRadius: 22,
    backgroundColor: af.canvasFocused, borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  ring: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    borderWidth: 1, borderColor: withAlpha(af.green, afAlpha.a34),
    // 0.7 was the resting opacity of the removed pulse loop (and the value its
    // reduced-motion branch already held) — kept so the static ring is exactly
    // the frame reduced-motion members were already seeing.
    opacity: 0.7,
  },
  reticule: {
    width: 140, height: 140, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 22, height: 22,
    borderColor: withAlpha(af.green, afAlpha.a67), borderWidth: 2,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  viewfinderLabel: {
    position: 'absolute', bottom: 14,
    fontSize: 10, fontFamily: Typography.fonts.bold,
    color: af.textTertiary, letterSpacing: 2,
  },

  trayCard: {
    backgroundColor: af.surface,
    borderRadius: 16, borderWidth: 1, borderColor: af.divider,
    padding: 14, gap: 10,
  },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trayHeaderText: { fontSize: 10, fontFamily: Typography.fonts.bold, color: af.textTertiary, letterSpacing: 1.8 },
  trayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  chipText: { fontSize: 11, fontFamily: Typography.fonts.semibold, color: af.textPrimary },
  qrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: withAlpha(af.green, afAlpha.a34),
    backgroundColor: withAlpha(af.green, afAlpha.a06),
    alignSelf: 'flex-start',
  },
  tabRow: {
    flexDirection: 'row', gap: 6,
    padding: 3,
    borderRadius: 100,
    backgroundColor: af.surface,
    alignSelf: 'flex-start',
  },
  tabPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
  },
  tabPillActive: {
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.border,
  },
  tabPillText: {
    fontSize: 11, fontFamily: Typography.fonts.semibold,
    color: af.textTertiary, letterSpacing: 0.4,
  },
  tabPillTextActive: {
    color: af.textPrimary,
  },
  pickerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1,
    borderColor: withAlpha(af.green, afAlpha.a34),
    backgroundColor: withAlpha(af.green, afAlpha.a06),
    alignSelf: 'flex-start',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: withAlpha('#000000', afAlpha.a67),
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: af.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: af.divider,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: af.divider,
    marginBottom: 4,
  },
  pickerTitle: {
    fontFamily: Typography.fonts.bold,
    fontSize: 14, letterSpacing: 1.2,
    color: af.textPrimary,
    textTransform: 'uppercase',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: af.divider,
  },
  pickerRowText: {
    flex: 1,
    fontFamily: Typography.fonts.semibold,
    fontSize: 13,
    color: af.textPrimary,
  },

  compareCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginVertical: 12,
    borderRadius: 14, borderWidth: 1,
    borderColor: withAlpha(af.green, afAlpha.a34),
    backgroundColor: withAlpha(af.green, afAlpha.a06),
  },
  compareWithAforceCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    borderColor: withAlpha(af.green, 0.4),
    backgroundColor: withAlpha(af.green, afAlpha.a08),
  },
  compareWithAforceText: {
    flex: 1,
    fontSize: 11, fontFamily: Typography.fonts.bold,
    color: af.green, letterSpacing: 1.4,
  },
  compareCtaTitle: {
    fontSize: 12, fontFamily: Typography.fonts.bold,
    color: af.textPrimary, letterSpacing: 1.4,
  },
  compareCtaSub: {
    fontSize: 10, fontFamily: Typography.fonts.medium,
    color: af.textTertiary, marginTop: 2, letterSpacing: 0.2,
  },

  manualCard: {
    backgroundColor: af.surface,
    borderRadius: 16, borderWidth: 1, borderColor: af.divider,
    padding: 14, gap: 8,
  },
  manualLabel: { fontSize: 10, fontFamily: Typography.fonts.bold, color: af.textTertiary, letterSpacing: 1.8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    minHeight: 44,
    flex: 1, borderRadius: 10,
    paddingHorizontal: 12, color: af.textPrimary,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    fontFamily: Typography.fonts.medium, fontSize: 13,
  },
  manualBtn: {
    minWidth: 44, minHeight: 44,
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
  },


  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: withAlpha(af.amber, afAlpha.a08),
    borderColor: withAlpha(af.amber, afAlpha.a34),
    borderWidth: 1, borderRadius: 14, padding: 12,
  },
  errorText: { fontSize: 12, fontFamily: Typography.fonts.medium, color: af.textPrimary, flex: 1 },

  recoveryStrip: {
    alignSelf: 'stretch', maxWidth: '100%',
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    borderColor: af.divider,
    backgroundColor: withAlpha('#FFFFFF', 0.02),
  },
  recoveryStripText: {
    fontSize: 9, fontFamily: Typography.fonts.bold, letterSpacing: 1.6,
    color: af.textSecondary, flexShrink: 1,
  },

  primaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    backgroundColor: af.surfaceRaised,
  },
  primaryCtaText: { fontSize: 12, fontFamily: Typography.fonts.bold, letterSpacing: 1.4 },

  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface,
  },
  secondaryCtaText: { fontSize: 11, fontFamily: Typography.fonts.bold, color: af.textPrimary, letterSpacing: 1.2 },

  emptyCard: {
    backgroundColor: af.surface,
    borderRadius: 16, borderWidth: 1, borderColor: af.divider,
    padding: 22, alignItems: 'center', gap: 6,
  },
  emptyTitle: { fontSize: 14, fontFamily: Typography.fonts.bold, color: af.textPrimary, marginTop: 4 },
  emptyHint: {
    fontSize: 12, fontFamily: Typography.fonts.regular,
    color: af.textSecondary, textAlign: 'center', lineHeight: 17,
  },
  scanDisclaimer: {
    fontSize: 10, fontFamily: Typography.fonts.regular,
    color: af.textTertiary, textAlign: 'center',
    lineHeight: 14, letterSpacing: 0.2,
    marginTop: 18, marginBottom: 6,
    paddingHorizontal: 8,
  },
});
