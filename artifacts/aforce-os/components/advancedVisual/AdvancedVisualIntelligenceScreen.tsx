import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { edAccent, edInk, edRule, edStock, edType } from '@/theme/editorialTokens';
import { SKINIA_MEMBER_LABEL } from '@/services/advancedVisualIntelligence';

/**
 * PR 2 consent and privacy shell. It does not request permission, open a
 * camera, accept an image, or persist a consent record.
 */
export function AdvancedVisualIntelligenceScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'overview' | 'consent' | 'privacy' | 'acknowledged'>('overview');
  const title = view === 'consent' ? 'Before you continue.' : view === 'privacy' ? 'Your image does not stay.' : view === 'acknowledged' ? 'You are in control.' : 'See today.\nCompare over time.';

  return (
    <View style={styles.screen} accessibilityLabel={SKINIA_MEMBER_LABEL}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.furniture}><Text style={styles.wordmark}>AFORCE</Text><Text style={styles.date}>CONTROLLED TESTFLIGHT</Text></View>
        <Text style={styles.kicker}>SKINIA VISUAL CHECK / {view.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
        {view === 'overview' ? <Overview onConsent={() => setView('consent')} onPrivacy={() => setView('privacy')} /> : null}
        {view === 'consent' ? <Consent onAcknowledge={() => setView('acknowledged')} onBack={() => setView('overview')} /> : null}
        {view === 'privacy' ? <Privacy onBack={() => setView('overview')} /> : null}
        {view === 'acknowledged' ? <Acknowledged onPrivacy={() => setView('privacy')} onBack={() => setView('overview')} /> : null}
        <View style={styles.footer}><View style={styles.rule} /><View style={styles.footerRow}><Text style={styles.footerText}>AFORCE OS</Text><Text style={styles.footerText}>SKINIA / 01</Text></View></View>
      </ScrollView>
    </View>
  );
}

const disclosure = 'Visual observations only. SkinIA does not diagnose conditions or measure hydration.';
function Overview({ onConsent, onPrivacy }: { onConsent: () => void; onPrivacy: () => void }) { return <><Text style={styles.body}>A guided visual check-in for consistent, non-diagnostic observation.</Text><Panel kicker="BEFORE A VISUAL CHECK" lines={['Review what SkinIA can and cannot do.', 'No camera is opened from this screen.', 'No image has been captured or stored.']} /><Action label="Review consent" onPress={onConsent} /><Secondary label="Privacy & deletion" onPress={onPrivacy} /><Text style={styles.disclosure}>{disclosure}</Text></>; }
function Consent({ onAcknowledge, onBack }: { onAcknowledge: () => void; onBack: () => void }) { return <><Text style={styles.body}>SkinIA is a controlled TestFlight feature. It can only offer visible, non-medical observations compared with your own baseline when a future check is available.</Text><Panel kicker="WHAT YOU ARE REVIEWING" lines={['Camera permission is not requested on this screen.', 'SkinIA does not diagnose conditions or measure hydration.', 'This acknowledgement does not begin a scan.']} /><Action label="I understand" onPress={onAcknowledge} /><Secondary label="Not now" onPress={onBack} /><Text style={styles.disclosure}>Acknowledgement is session-only in this build. No consent record is stored here.</Text></>; }
function Privacy({ onBack }: { onBack: () => void }) { return <><Text style={styles.body}>Raw SkinIA images are never retained after a capture or processing session. This screen does not access your camera or photos.</Text><Panel kicker="ZERO PERSISTENT RETENTION" lines={['Raw images do not enter storage, databases, logs, analytics, caches, backups, or crash reports.', 'If a later flow is cancelled, fails, times out, or consent is withdrawn, the raw image must be deleted immediately.', 'SkinIA does not create facial-recognition, identity, or biometric templates.']} /><Action label="Back to SkinIA" onPress={onBack} /><Text style={styles.disclosure}>{disclosure}</Text></>; }
function Acknowledged({ onPrivacy, onBack }: { onPrivacy: () => void; onBack: () => void }) { return <><Text style={styles.body}>You reviewed the controlled-test explanation. A visual check cannot start from this build until the next approved capability is released to your cohort.</Text><Panel kicker="NO CAPTURE YET" lines={['No camera permission has been requested.', 'No image, observation, or health measurement exists.']} /><Action label="Privacy & deletion" onPress={onPrivacy} /><Secondary label="Back to SkinIA" onPress={onBack} /><Text style={styles.disclosure}>{disclosure}</Text></>; }
function Panel({ kicker, lines }: { kicker: string; lines: string[] }) { return <View style={styles.guidance} accessibilityRole="summary"><Text style={styles.guidanceKicker}>{kicker}</Text>{lines.map((line) => <Text key={line} style={styles.guidanceLine}>{line}</Text>)}</View>; }
function Action({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.actionLabel}>{label}</Text><Text style={styles.actionPlus}>+</Text></Pressable>; }
function Secondary({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryLabel}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black }, content: { flexGrow: 1, paddingHorizontal: 32 },
  furniture: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' }, date: { ...edType.micro, color: edInk.quietOnBlack, textAlign: 'right' },
  kicker: { ...edType.micro, color: edAccent.red, marginTop: 42 }, title: { ...edType.statement, color: edInk.ivory, marginTop: 14 }, body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 10 },
  guidance: { backgroundColor: edStock.blackRaised, borderRadius: 18, marginTop: 28, padding: 22, gap: 14 }, guidanceKicker: { ...edType.micro, color: edAccent.red }, guidanceLine: { ...edType.bodySmall, color: edInk.ivory },
  action: { minHeight: 48, backgroundColor: edStock.paper, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingHorizontal: 16 }, actionLabel: { ...edType.bodySmall, color: edInk.black, fontWeight: '700' }, actionPlus: { color: edAccent.red, fontSize: 20, lineHeight: 22 },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start', marginTop: 8, paddingHorizontal: 2 }, secondaryLabel: { ...edType.bodySmall, color: edInk.quietOnBlack, textDecorationLine: 'underline' }, pressed: { opacity: 0.72 }, disclosure: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 13 },
  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: 56 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: edRule.onBlack }, footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 }, footerText: { ...edType.micro, color: edInk.quietOnBlack },
});
