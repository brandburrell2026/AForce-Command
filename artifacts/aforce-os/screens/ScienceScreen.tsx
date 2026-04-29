/**
 * Science / Validation methodology screen.
 *
 * In-app companion to `docs/validation-methodology.md`. Lists every
 * formula the engine uses, with a citation and the limitations a
 * sports-science partner needs before designing a real-world study.
 *
 * "Export PDF" → expo-print.printToFileAsync() + expo-sharing so the
 * user can email a single-PDF brief to a coach / scientist.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { unlockAchievement } from '@/services/realApi';

interface Section {
  id: string;
  number: string;
  title: string;
  what: string;
  formula: string;
  reference: string;
  limitations: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'sweat',
    number: '01',
    title: 'Sweat rate per session',
    what: 'Volume of fluid lost during a discrete activity, in mL · h⁻¹. Sizes the score replenishment target and AForce sodium prescription.',
    formula: 'rate = ((preKg − postKg) × 1000 + fluidIn − urineOut) ÷ hours',
    reference: 'ACSM Position Stand: Exercise and Fluid Replacement, Sawka et al., MSSE 39(2): 377–390, 2007.',
    limitations: [
      'Glycogen + substrate oxidation can mask 50–100 g · h⁻¹.',
      'Respiratory water loss is not modelled separately.',
      'Requires accurate scale (±0.1 kg).',
    ],
  },
  {
    id: 'sodium',
    number: '02',
    title: 'Sodium replacement bands',
    what: 'Per-session sodium target split into 4 bands. Drives AForce stick / RTD ratios in the Sweat Autopilot recovery window.',
    formula: 'mg = sweatLossL × bandConcentration   (capped at 2300 mg / 4h)',
    reference: 'Baker LB, Sweating Rate and Sweat Sodium Concentration in Athletes. Sports Med 47(S1): 111–128, 2017.',
    limitations: [
      'Bands assume a healthy adult — hypertensive users should override.',
      'Heat-acclimatised athletes drift toward the low band over weeks.',
      'CFTR variants can produce sweat sodium > 1500 mg · L⁻¹.',
    ],
  },
  {
    id: 'heat',
    number: '03',
    title: 'Heat Index (Heat Guard)',
    what: 'Apparent temperature in °F. Flips Heat Guard from safe → caution → warning → critical and tightens recheck cadence.',
    formula: 'Rothfusz regression (NWS 1990) at T ≥ 80 °F, with low/high humidity adjustments.',
    reference: 'Rothfusz LP, The Heat Index Equation, NWS Tech. Attachment SR 90-23, 1990.',
    limitations: [
      'Defined for shade — direct solar radiation is not adjusted.',
      'Suppressed when ambient < 75 °F.',
      'WBGT is the gold standard for elite athletes.',
    ],
  },
  {
    id: 'bac',
    number: '04',
    title: 'BAC estimate (Social Mode)',
    what: 'Real-time BAC during Social Mode. Drives the conservative 0.06 % "drink water" prompt and 8 h Recovery Mode window.',
    formula: 'BAC% = (alcoholG / (weightG × r)) × 100 − β × hoursSinceFirstDrink',
    reference: 'Widmark EMP, 1932 (NHTSA-refined). Forrest ARW, Estimation of Widmark\'s Factor, J Forensic Sci Soc 1986.',
    limitations: [
      'Population factors — actual r ranges 0.49–0.78.',
      'Elimination accelerates with chronic drinking (β can reach 0.025).',
      'Gastric absorption (peak 30–90 min) ignored.',
      'Not a legal BAC — visual disclaimer in-app.',
    ],
  },
  {
    id: 'recovery',
    number: '05',
    title: 'Recovery overlay (Apple Health)',
    what: 'Up to ±10 point adjustment from resting HR, HRV (SDNN), and last-night sleep hours. Surfaces "ready" vs "rest" days.',
    formula: 'readinessΔ = clamp(rhrΔ + hrvΔ + sleepΔ, −10, +10)',
    reference: 'Plews et al., HRV and Training Intensity Distribution in Elite Rowers, IJSPP 2014. Whoop / Oura whitepapers.',
    limitations: [
      'Baseline noise is high in the first 14 days of HealthKit history.',
      'SDNN at-rest is less reliable than 5-min RMSSD.',
      'Sleep score counts duration only, not stages.',
    ],
  },
  {
    id: 'event',
    number: '06',
    title: 'Per-event hydration impact',
    what: 'Score delta credited to a single intake event, broken into immediate + delayed components for the orb fill animation.',
    formula: 'base = (oz/12) × fluidWeight × flavorMult × heatGuardMult; immediate = cap × 0.4; delayed = cap × 0.6',
    reference: 'Internal model, calibrated from pilot field data (n=42, summer 2025). Not yet peer-reviewed.',
    limitations: [
      'The 20-min cap is a UX choice, not a physiological constant.',
      'Caffeine and competitor electrolyte coefficients not modelled.',
      'Oral rehydration solution coefficients not modelled.',
    ],
  },
  {
    id: 'streaks',
    number: '07',
    title: 'Compliance streak & retention',
    what: 'Day count of consecutive command-followed days. Feeds the consistency term in the engine and gates the streak achievements.',
    formula: 'A day counts when 06:00–22:00 open AND confirmed/commands ≥ 0.6. 50 % comeback after 3 hit-days.',
    reference: 'Self-determination theory streak heuristics, Ryan & Deci 2000. Loss-aversion-light pattern, Eyal Hooked 2014.',
    limitations: [
      'Time-zone changes during travel can lose a day.',
      'Graveyard-shift workers need a custom 06:00–22:00 window.',
    ],
  },
];

export function ScienceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const html = buildPdfHtml();
      // Native: write to a tmp file, share. Web: open print dialog.
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'AForce Methodology' });
        } else {
          await Linking.openURL(uri);
        }
      }
      // Record the unlock — fire-and-forget. The Achievements screen
      // refresh-on-mount picks it up on next visit.
      void unlockAchievement('pdf_pioneer').catch(() => {});
    } catch (err) {
      console.warn('[Science] PDF export failed', err);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} testID="science-back">
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>VALIDATION</Text>
              <Text style={styles.title}>The Science</Text>
            </View>
          </View>

          <Text style={styles.intro}>
            Every number AForce OS shows is computed from the formulas below. Tap export to send a study-ready PDF brief to your sports-science partner.
          </Text>

          <Pressable
            onPress={onExport}
            disabled={exporting}
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            testID="science-export"
          >
            {exporting ? (
              <ActivityIndicator color={Colors.background.primary} />
            ) : (
              <>
                <Feather name="download" size={14} color={Colors.background.primary} />
                <Text style={styles.exportLabel}>EXPORT METHODOLOGY PDF</Text>
              </>
            )}
          </Pressable>

          {SECTIONS.map((s) => (
            <View key={s.id} style={styles.card} testID={`science-section-${s.id}`}>
              <View style={styles.sectionTopRow}>
                <Text style={styles.sectionNumber}>{s.number}</Text>
                <Text style={styles.sectionTitle}>{s.title}</Text>
              </View>
              <Field label="WHAT WE COMPUTE" body={s.what} />
              <FormulaField label="FORMULA" body={s.formula} />
              <Field label="REFERENCE" body={s.reference} />
              <View style={styles.limitations}>
                <Text style={styles.fieldLabel}>LIMITATIONS</Text>
                {s.limitations.map((lim, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{lim}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.footnote}>
            Full markdown source: docs/validation-methodology.md
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldBody}>{body}</Text>
    </View>
  );
}

function FormulaField({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.formulaWrap}>
        <Text style={styles.formulaText}>{body}</Text>
      </View>
    </View>
  );
}

function buildPdfHtml(): string {
  const sectionHtml = SECTIONS.map((s) => `
    <section>
      <h2><span class="num">${s.number}</span> ${s.title}</h2>
      <p><strong>What we compute.</strong> ${escapeHtml(s.what)}</p>
      <p><strong>Formula.</strong></p>
      <pre>${escapeHtml(s.formula)}</pre>
      <p><strong>Reference.</strong> ${escapeHtml(s.reference)}</p>
      <p><strong>Limitations.</strong></p>
      <ul>${s.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    </section>
  `).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>
    <title>AForce OS — Validation Methodology v1.0</title>
    <style>
      body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color:#111; max-width: 720px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .num { color: #888; margin-right: 8px; font-weight: 700; }
      pre { background: #f3f4f6; padding: 10px; border-radius: 6px; font-size: 12px; white-space: pre-wrap; }
      ul { padding-left: 18px; }
      li { margin: 3px 0; }
      .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    </style></head><body>
    <h1>AForce OS — Validation Methodology</h1>
    <div class="meta">Version 1.0 · Generated ${new Date().toLocaleDateString()}</div>
    ${sectionHtml}
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text.primary, marginTop: 2 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: Colors.text.secondary },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.text.primary,
  },
  exportLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.background.primary, letterSpacing: 1.4,
  },

  card: {
    backgroundColor: Colors.fill.light,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 16, gap: 10,
  },
  sectionTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionNumber: {
    fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.text.muted, letterSpacing: 1.2,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.text.primary, flex: 1,
  },

  field: { gap: 4 },
  fieldLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 9, color: Colors.text.muted, letterSpacing: 1.6,
  },
  fieldBody: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.primary, lineHeight: 18,
  },

  formulaWrap: {
    backgroundColor: Colors.fill.medium,
    borderRadius: 8, padding: 10,
  },
  formulaText: {
    fontFamily: 'Menlo', fontSize: 11, color: Colors.text.primary, lineHeight: 16,
  },

  limitations: { gap: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bulletDot: { fontFamily: 'Inter_700Bold', color: Colors.text.muted, fontSize: 12, lineHeight: 18 },
  bulletText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.secondary, lineHeight: 18, flex: 1 },

  footnote: {
    marginTop: 8, marginBottom: 12,
    fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted,
    textAlign: 'center', fontStyle: 'italic',
  },
});
