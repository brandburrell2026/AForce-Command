import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mockRosterClutch, mockRosterGuardian } from '@/data/mockData';
import { useFlagsSlice, useUserSlice } from '@/store/slices';
import { af } from '@/theme';
import { edAccent, edInk, edPositive, edRule, edStock, edType } from '@/theme/editorialTokens';

type RouteHref =
  | '/skinia'
  | '/sweat'
  | '/cruise'
  | '/guardian'
  | '/clutch'
  | '/sweat-calculator'
  | '/cruise-console'
  | '/guardian-console'
  | '/clutch-console'
  | '/weekly-report';

const dateFurniture = () =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(new Date())
    .replace(',', '')
    .toUpperCase();

function ScreenShell({
  kicker,
  title,
  body,
  folio,
  children,
  showBack = true,
  testID,
}: {
  kicker: string;
  title: string;
  body: string;
  folio: string;
  children: React.ReactNode;
  showBack?: boolean;
  testID: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen} testID={testID}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 108 },
        ]}
      >
        <View style={styles.masthead}>
          <Pressable
            accessibilityRole={showBack ? 'button' : undefined}
            accessibilityLabel={showBack ? 'Back' : undefined}
            disabled={!showBack}
            onPress={() => router.back()}
          >
            <Text style={styles.wordmark}>{showBack ? '‹  AFORCE' : 'AFORCE'}</Text>
          </Pressable>
          <Text style={styles.date}>{dateFurniture()}</Text>
        </View>

        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {children}

        <View style={styles.footer}>
          <View style={styles.rule} />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>AFORCE OS</Text>
            <Text style={styles.footerText}>{folio}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PrimaryAction({ label, href }: { label: string; href: RouteHref }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
    >
      <Text style={styles.primaryActionLabel}>{label}</Text>
      <Text style={styles.primaryActionMark}>+</Text>
    </Pressable>
  );
}

function OutlineAction({ label, href }: { label: string; href: RouteHref }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]}
    >
      <Text style={styles.outlineActionLabel}>{label}</Text>
      <Text style={styles.outlineActionMark}>›</Text>
    </Pressable>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function DataRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, accent && styles.dataValueAccent]}>{value}</Text>
    </View>
  );
}

function SignalCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.signalCard}>{children}</View>;
}

function SuiteLink({ index, title, detail, href }: { index: string; title: string; detail: string; href: RouteHref }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => [styles.suiteLink, pressed && styles.pressed]}
    >
      <Text style={styles.suiteIndex}>{index}</Text>
      <View style={styles.suiteCopy}>
        <Text style={styles.suiteTitle}>{title}</Text>
        <Text style={styles.suiteDetail}>{detail}</Text>
      </View>
      <Text style={styles.suiteArrow}>›</Text>
    </Pressable>
  );
}

export function SkinIntelligenceHomeScreen() {
  const user = useUserSlice();
  const hydrationPct = user.dailyTarget > 0
    ? Math.min(100, Math.round((user.unitsConsumedToday / user.dailyTarget) * 100))
    : null;
  const heat = user.weatherTempC == null
    ? '—'
    : `${Math.round((user.weatherTempC * 9) / 5 + 32)}°`;

  return (
    <ScreenShell
      kicker="SKIN INTELLIGENCE / TODAY"
      title={'Know your skin.\nProtect your performance.'}
      body="A daily skin + exposure command center built around one clear next action."
      folio="01 / SKIN HOME"
      showBack={false}
      testID="skin-intelligence-home"
    >
      <View style={styles.homeHero}>
        <Label>TODAY&apos;S OBSERVATION</Label>
        <Text style={styles.homeState}>READY</Text>
        <Text style={styles.homeStateMeta}>NO SCAN YET</Text>
        <Text style={styles.homeStatement}>
          No visual observation has been recorded today.
        </Text>
        <View style={styles.redRule} />
      </View>

      <View style={styles.threeUp}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>UV</Text>
          <Text style={styles.metricValue}>—</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>HEAT</Text>
          <Text style={styles.metricValue}>{heat}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>HYDRATION</Text>
          <Text style={styles.metricValue}>{hydrationPct == null ? '—' : `${hydrationPct}%`}</Text>
        </View>
      </View>

      <View style={styles.block}>
        <Label>NEXT ACTION</Label>
        <SignalCard>
          <Text style={styles.signalTitle}>Complete an approved visual check.</Text>
          <Text style={styles.signalDetail}>EPHEMERAL CAPTURE / INTERNAL TESTFLIGHT</Text>
        </SignalCard>
        <PrimaryAction label="Start skin scan" href="/skinia" />
      </View>

      <View style={styles.systemSection}>
        <Label>THE SYSTEM</Label>
        <Text style={styles.systemStatement}>One visual language. Seven focused experiences.</Text>
        <SuiteLink index="02" title="Scan" detail="Visible observations, compared with your baseline" href="/skinia" />
        <SuiteLink index="03" title="Sweat" detail="Turn a session into a hydration plan" href="/sweat" />
        <SuiteLink index="04" title="Cruise" detail="Quiet exposure monitoring" href="/cruise" />
        <SuiteLink index="05" title="Guardian" detail="Protection without the noise" href="/guardian" />
        <SuiteLink index="06" title="Clutch" detail="Hydration status across the roster" href="/clutch" />
        <SuiteLink index="07" title="Weekly" detail="Seven days. One clearer pattern" href="/weekly-report" />
      </View>

      <Text style={styles.disclosure}>
        INTERNAL TESTFLIGHT · VISUAL OBSERVATIONS ONLY · NOT A DIAGNOSIS
      </Text>
    </ScreenShell>
  );
}

export function EditorialSweatLandingScreen() {
  return (
    <ScreenShell
      kicker="SWEAT / SESSION ESTIMATE"
      title={'Turn sweat into\na hydration plan.'}
      body="Estimate fluid loss and connect the result back into AForce Hydration."
      folio="03 / SWEAT"
      testID="editorial-sweat-landing"
    >
      <View style={styles.featureBlock}>
        <Label>ESTIMATED SWEAT LOSS</Label>
        <View style={styles.valueWithUnit}>
          <Text style={styles.featureValue}>—</Text>
          <Text style={styles.featureUnit}>L / HR</Text>
        </View>
        <Text style={styles.featureDetail}>Complete a session to calculate your estimate.</Text>
      </View>

      <View style={styles.threeUp}>
        <View style={styles.metricCell}><Text style={styles.metricLabel}>DURATION</Text><Text style={styles.metricValueSmall}>—</Text></View>
        <View style={styles.metricCell}><Text style={styles.metricLabel}>TEMP</Text><Text style={styles.metricValueSmall}>—</Text></View>
        <View style={styles.metricCell}><Text style={styles.metricLabel}>LOSS</Text><Text style={styles.metricValueSmall}>—</Text></View>
      </View>

      <View style={styles.block}>
        <View style={styles.rule} />
        <Label>AFORCE HYDRATION HANDOFF</Label>
        <Text style={styles.handoff}>Your completed estimate will become a gradual replacement plan.</Text>
        <PrimaryAction label="Open sweat calculator" href="/sweat-calculator" />
      </View>
    </ScreenShell>
  );
}

export function EditorialCruiseLandingScreen() {
  const flags = useFlagsSlice();
  const available = flags.cruise_mode_enabled;
  return (
    <ScreenShell
      kicker="SKIN INTELLIGENCE / CRUISE"
      title={'Enjoy the day.\nWe’ll watch the edges.'}
      body="Passive exposure monitoring for pool, beach, resort and cruise days."
      folio="04 / CRUISE"
      testID="editorial-cruise-landing"
    >
      <SignalCard>
        <Label>CRUISE MODE</Label>
        <Text style={styles.cardState}>{available ? 'READY' : 'LOCKED'}</Text>
        <Text style={styles.featureDetail}>
          {available ? 'Quiet monitoring is available.' : 'This module is not enabled for this build.'}
        </Text>
      </SignalCard>

      <View style={styles.statusList}>
        <DataRow label="UV exposure window" value={available ? 'STANDBY' : 'OFF'} accent={available} />
        <DataRow label="Heat + humidity load" value={available ? 'STANDBY' : 'OFF'} accent={available} />
        <DataRow label="Hydration drift" value="AWAITING SESSION" />
        <DataRow label="Outdoor duration" value="AWAITING SESSION" />
      </View>
      <OutlineAction label="Open Cruise Mode" href="/cruise-console" />
      <Text style={styles.disclosure}>SILENT UNLESS THE SIGNAL CHANGES</Text>
    </ScreenShell>
  );
}

function MonitoringRing({ active }: { active: boolean }) {
  return (
    <View style={[styles.monitorRing, !active && styles.monitorRingMuted]}>
      <View style={styles.monitorRingInner}>
        <Text style={styles.monitorCaption}>MONITORING</Text>
        <Text style={styles.monitorState}>{active ? 'ACTIVE' : 'STANDBY'}</Text>
      </View>
    </View>
  );
}

export function EditorialGuardianLandingScreen() {
  const flags = useFlagsSlice();
  const active = flags.guardian_intelligence_enabled;
  const preview = mockRosterGuardian.slice(0, 3);

  return (
    <ScreenShell
      kicker="GUARDIAN / LIVE"
      title={'Protection without\nthe noise.'}
      body="AForce watches exposure, heat and hydration context in the background."
      folio="05 / GUARDIAN"
      testID="editorial-guardian-landing"
    >
      <MonitoringRing active={active} />
      <Text style={styles.sectionStatement}>{active ? 'Guardian is watching.' : 'Guardian is standing by.'}</Text>
      <Text style={styles.featureDetail}>{active ? 'No alert needed right now.' : 'Activate the approved module to begin monitoring.'}</Text>

      <View style={styles.statusList}>
        <DataRow label="UV" value="—" />
        <DataRow label="HEAT INDEX" value="—" />
        <DataRow label="HYDRATION" value="—" />
        <DataRow label="OUTDOOR WINDOW" value="—" />
      </View>

      <View style={styles.block}>
        <Label>INTERNAL PREVIEW / SAMPLE ROSTER</Label>
        {preview.map((person, index) => (
          <View key={person.id} style={[styles.rosterRow, { borderLeftColor: index === 0 ? edAccent.red : index === 1 ? af.amber : edPositive }]}>
            <View style={styles.rosterCopy}>
              <Text style={styles.rosterName}>{person.name} · {person.position}</Text>
              <Text style={styles.rosterMeta}>SAMPLE HYDRATION {person.hydrationScore}</Text>
            </View>
            <Text style={[styles.rosterScore, { color: index === 0 ? edAccent.red : index === 1 ? af.amber : edPositive }]}>{person.guardianRisk}</Text>
          </View>
        ))}
      </View>
      <OutlineAction label="Open Guardian detail" href="/guardian-console" />
    </ScreenShell>
  );
}

export function EditorialClutchLandingScreen() {
  const flags = useFlagsSlice();
  const active = flags.clutch_access_enabled;
  const preview = mockRosterClutch.slice(0, 4);
  const colors = [edAccent.red, af.cyan, edPositive, edInk.ivory];

  return (
    <ScreenShell
      kicker="CLUTCH / HYDRATION MONITOR"
      title={"Know who’s\nrunning dry."}
      body="Real-time hydration status for every player on your roster."
      folio="06 / CLUTCH"
      testID="editorial-clutch-landing"
    >
      <View style={styles.block}>
        <Label>{active ? 'ROSTER STATUS' : 'INTERNAL PREVIEW / SAMPLE ROSTER'}</Label>
        {preview.map((person, index) => (
          <View key={person.id} style={[styles.clutchRow, { borderLeftColor: colors[index] }]}>
            <View style={styles.rosterCopy}>
              <Text style={styles.rosterName}>{person.name} · {person.position}</Text>
              <Text style={styles.rosterMeta}>SAMPLE HYDRATION {person.hydrationScore}</Text>
            </View>
            <Text style={[styles.clutchScore, { color: colors[index] }]}>{person.hydrationScore}</Text>
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <Label>PRIORITY ACTION</Label>
        <Text style={styles.handoff}>{active ? 'Open the roster for the current team command.' : 'Activate Clutch to create a live roster command.'}</Text>
        <PrimaryAction label="Open Clutch roster" href="/clutch-console" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black },
  content: { flexGrow: 1, paddingHorizontal: 32 },
  masthead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' },
  date: { ...edType.micro, color: edInk.quietOnBlack },
  kicker: { ...edType.micro, color: edAccent.red, marginTop: 42 },
  title: { ...edType.statement, color: edInk.ivory, marginTop: 14 },
  body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 8, maxWidth: 338 },
  homeHero: { marginTop: 32 },
  homeState: { ...edType.numberFeature, color: edInk.ivory, marginTop: 8 },
  homeStateMeta: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 2 },
  homeStatement: { ...edType.confirm, color: edInk.ivory, marginTop: 18 },
  redRule: { backgroundColor: edAccent.red, height: 3, marginTop: 16 },
  sectionLabel: { ...edType.micro, color: edAccent.red },
  threeUp: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  metricCell: { flex: 1 },
  metricLabel: { ...edType.micro, color: edInk.quietOnBlack },
  metricValue: { ...edType.statement, color: edInk.ivory, marginTop: 7 },
  metricValueSmall: { ...edType.confirm, color: edInk.ivory, marginTop: 7 },
  block: { marginTop: 34 },
  signalCard: { backgroundColor: edStock.blackRaised, borderColor: edRule.onBlack, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 10, padding: 14 },
  signalTitle: { ...edType.confirm, color: edInk.ivory },
  signalDetail: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 8 },
  primaryAction: { alignItems: 'center', backgroundColor: edInk.ivory, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, minHeight: 52, paddingHorizontal: 16 },
  primaryActionLabel: { ...edType.bodySmall, color: edInk.black, fontWeight: '700' },
  primaryActionMark: { color: edAccent.red, fontSize: 22 },
  outlineAction: { alignItems: 'center', borderColor: edRule.onBlack, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 26, minHeight: 52, paddingHorizontal: 16 },
  outlineActionLabel: { ...edType.bodySmall, color: edInk.ivory, fontWeight: '700' },
  outlineActionMark: { color: edAccent.red, fontSize: 22 },
  pressed: { opacity: 0.72 },
  systemSection: { marginTop: 42 },
  systemStatement: { ...edType.command, color: edInk.ivory, marginBottom: 14, marginTop: 9 },
  suiteLink: { alignItems: 'center', borderTopColor: edRule.onBlack, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 74, paddingVertical: 12 },
  suiteIndex: { ...edType.micro, color: edAccent.red, width: 34 },
  suiteCopy: { flex: 1 },
  suiteTitle: { ...edType.confirm, color: edInk.ivory },
  suiteDetail: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 3 },
  suiteArrow: { color: edInk.quietOnBlack, fontSize: 25, marginLeft: 10 },
  disclosure: { ...edType.micro, color: edInk.quietOnBlack, marginTop: 16 },
  footer: { flex: 1, justifyContent: 'flex-end', marginTop: 58, minHeight: 72 },
  rule: { backgroundColor: edRule.onBlack, height: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  footerText: { ...edType.micro, color: edInk.quietOnBlack },
  featureBlock: { marginTop: 36 },
  valueWithUnit: { alignItems: 'flex-end', flexDirection: 'row', marginTop: 7 },
  featureValue: { ...edType.numberHero, color: edInk.ivory },
  featureUnit: { ...edType.bodySmall, color: edInk.quietOnBlack, fontWeight: '700', marginBottom: 8, marginLeft: 10 },
  featureDetail: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 8 },
  handoff: { ...edType.confirm, color: edInk.ivory, marginTop: 12 },
  cardState: { ...edType.statement, color: edInk.ivory, marginTop: 9 },
  statusList: { borderTopColor: edRule.onBlack, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 34 },
  dataRow: { alignItems: 'center', borderBottomColor: edRule.onBlack, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  dataLabel: { ...edType.bodySmall, color: edInk.ivory, fontWeight: '600' },
  dataValue: { ...edType.micro, color: edInk.quietOnBlack, maxWidth: 150, textAlign: 'right' },
  dataValueAccent: { color: edAccent.red },
  monitorRing: { alignItems: 'center', alignSelf: 'center', borderColor: edAccent.red, borderRadius: 78, borderWidth: 2, height: 156, justifyContent: 'center', marginTop: 30, width: 156 },
  monitorRingMuted: { borderColor: edRule.onBlack },
  monitorRingInner: { alignItems: 'center', borderColor: edRule.onBlack, borderRadius: 56, borderWidth: 1, height: 112, justifyContent: 'center', width: 112 },
  monitorCaption: { ...edType.micro, color: edInk.quietOnBlack },
  monitorState: { ...edType.bodySmall, color: edInk.ivory, fontWeight: '700', marginTop: 3 },
  sectionStatement: { ...edType.command, color: edInk.ivory, marginTop: 24 },
  rosterRow: { alignItems: 'center', backgroundColor: edStock.blackRaised, borderLeftWidth: 2, borderRadius: 4, flexDirection: 'row', marginTop: 10, minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 },
  clutchRow: { alignItems: 'center', backgroundColor: edStock.blackRaised, borderLeftWidth: 3, borderRadius: 8, flexDirection: 'row', marginTop: 12, minHeight: 72, paddingHorizontal: 14, paddingVertical: 10 },
  rosterCopy: { flex: 1 },
  rosterName: { ...edType.bodySmall, color: edInk.ivory },
  rosterMeta: { ...edType.micro, color: edInk.dimOnBlack, marginTop: 2 },
  rosterScore: { ...edType.command, marginLeft: 10 },
  clutchScore: { ...edType.numberFeature, marginLeft: 10 },
});
