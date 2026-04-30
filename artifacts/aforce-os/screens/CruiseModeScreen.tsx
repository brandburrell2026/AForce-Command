/**
 * Cruise Mode Screen — premium add-on for cruise lines & guests.
 *
 * One scrollable screen that surfaces every section of the Cruise Mode spec:
 *   1. Live Hydration Score (status + AForce Rx)
 *   2. Ship Environment Factors
 *   3. Crew Performance Mode  (when userType=crew)
 *   4. Guest Wellness Mode    (when userType=guest)
 *   5. Alcohol + Sun Risk Layer
 *   6. Port Day / Excursion checklist
 *   7. Crew Aggregate Dashboard (operator view, anonymized)
 *   8. Engagement / Rewards
 *   9. Cross-feature navigation strip
 *  10. Business positioning copy blocks
 *
 * Demo data lives in `services/cruiseModeService.ts`. The user can cycle through
 * three realistic profiles (F&B crew, pool-day guest, excursion guest) so the
 * screen always shows live signal — not empty state.
 *
 * Premium-gated via the `cruise_mode_enabled` feature flag (FeatureGate wrapper).
 */

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { GradientBackground } from "@/components/GradientBackground";
import { FeatureGate } from "@/components/FeatureGate";
import { Colors } from "@/theme/colors";
import {
  evaluateCruise,
  CRUISE_DEMO_PROFILES,
  CREW_AGGREGATE_DEMO,
  PORT_DAY_CHECKLIST,
  CRUISE_BADGES,
  CREW_ROLE_LABEL,
  GUEST_TYPE_LABEL,
  RISK_LABEL,
  type CruiseDemoProfile,
  type CruiseRiskLevel,
  type CruiseStatus,
} from "@/services/cruiseModeService";

// ─── Cruise palette (deep navy + electric aqua) ─────────────────────────────
const CRUISE = {
  navyDeep: "#04101F",
  navyMid: "#0A2236",
  navyCard: "#0E2B45",
  navyCardElev: "#143352",
  aqua: "#00E5FF",
  aquaSoft: "rgba(0, 229, 255, 0.18)",
  aquaGlow: "rgba(0, 229, 255, 0.35)",
  border: "rgba(0, 229, 255, 0.18)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
} as const;

const STATUS_COLOR: Record<CruiseStatus, string> = {
  OPTIMIZED: Colors.states.PEAK.primary,
  MONITOR: Colors.states.BALANCED.primary,
  DEHYDRATION_RISK: Colors.states.RECOVERING.primary,
  RECOVERY_NEEDED: Colors.states.DEPLETED.primary,
};

const RISK_COLOR: Record<CruiseRiskLevel, string> = {
  LOW: Colors.states.PEAK.primary,
  MODERATE: Colors.states.BALANCED.primary,
  HIGH: Colors.states.RECOVERING.primary,
  RECOVERY_CRITICAL: Colors.states.DEPLETED.primary,
};

// ────────────────────────────────────────────────────────────────────────────

function CruiseModeBody() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profileIdx, setProfileIdx] = useState(0);
  const profile: CruiseDemoProfile = CRUISE_DEMO_PROFILES[profileIdx]!;
  const evaluation = useMemo(() => evaluateCruise(profile.session), [profile]);

  const topPadding = Platform.OS === "web" ? 24 : insets.top;
  const isCrew = profile.session.userType === "crew";
  const statusColor = STATUS_COLOR[evaluation.status];
  const riskColor = RISK_COLOR[evaluation.riskLevel];

  return (
    <View style={styles.root}>
      <GradientBackground>
        {/* navy + aqua tint over the base gradient */}
        <View style={styles.navyTint} pointerEvents="none" />
        <View style={styles.aquaGlow} pointerEvents="none" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)" as never);
              }}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={20} color={Colors.text.secondary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.eyebrow}>ENTERPRISE · PREMIUM</Text>
              <Text style={styles.title}>Cruise Mode</Text>
              <Text style={styles.subtitle}>Hydration intelligence for life at sea.</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* ── Demo profile picker ─────────────────────────────────── */}
          <View style={styles.profileRow}>
            {CRUISE_DEMO_PROFILES.map((p, i) => {
              const active = i === profileIdx;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProfileIdx(i)}
                  style={[styles.profileChip, active && styles.profileChipActive]}
                  testID={`cruise-profile-${p.id}`}
                >
                  <Text style={[styles.profileChipLabel, active && { color: CRUISE.aqua }]}>
                    {p.label}
                  </Text>
                  <Text style={styles.profileChipHint}>{p.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── 1. Live Hydration Score ─────────────────────────────── */}
          <SectionHeader label="LIVE HYDRATION SCORE" />
          <View style={styles.card}>
            <View style={styles.orbRow}>
              <View style={[styles.orb, { borderColor: statusColor + "55", backgroundColor: statusColor + "12" }]}>
                <View style={[styles.orbInner, { backgroundColor: statusColor + "22" }]}>
                  <Text style={[styles.orbScore, { color: statusColor }]}>{evaluation.score}</Text>
                  <Text style={styles.orbScale}>/ 100</Text>
                </View>
              </View>
              <View style={styles.orbCopy}>
                <View style={[styles.statusPill, { backgroundColor: statusColor + "1F", borderColor: statusColor + "55" }]}>
                  <Text style={[styles.statusPillText, { color: statusColor }]}>{evaluation.statusLabel}</Text>
                </View>
                <Text style={styles.recommendation}>{evaluation.recommendation}</Text>
                <Text style={styles.recheck}>
                  Next check in {evaluation.nextCheckMinutes} min
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. Ship Environment Factors ─────────────────────────── */}
          <SectionHeader label="SHIP ENVIRONMENT" hint="Live conditions onboard" />
          <View style={styles.card}>
            <View style={styles.envGrid}>
              <EnvCell
                icon="thermometer"
                label="Temperature"
                value={`${profile.session.env.ambientTempF}°F`}
              />
              <EnvCell
                icon="cloud-drizzle"
                label="Humidity"
                value={`${profile.session.env.humidityPct}%`}
              />
              <EnvCell
                icon="sun"
                label="Sun exposure"
                value={`${profile.session.env.sunExposureHours} hr`}
              />
              <EnvCell
                icon="wind"
                label="Heat index"
                value={`${evaluation.envHeatIndexF}°F`}
                accent={evaluation.envHeatIndexF >= 90 ? Colors.states.RECOVERING.primary : undefined}
              />
              <EnvCell
                icon={profile.session.env.deckExposure === "outdoor" ? "sunrise" : "home"}
                label="Deck"
                value={titleCase(profile.session.env.deckExposure)}
              />
              <EnvCell
                icon="navigation"
                label="Day"
                value={profile.session.env.dayMode === "sea_day" ? "Sea day" : "Port day"}
              />
            </View>
            {profile.session.env.excursionRisk !== "none" && (
              <View style={[styles.inlineBanner, { borderColor: CRUISE.aqua + "55", backgroundColor: CRUISE.aqua + "10" }]}>
                <Feather name="alert-triangle" size={13} color={CRUISE.aqua} />
                <Text style={styles.inlineBannerText}>
                  Excursion risk: <Text style={{ color: CRUISE.aqua }}>{titleCase(profile.session.env.excursionRisk)}</Text>
                </Text>
              </View>
            )}
          </View>

          {/* ── 3 / 4. Crew Performance OR Guest Wellness Mode ──────── */}
          {isCrew && profile.session.crew && (
            <>
              <SectionHeader label="CREW PERFORMANCE MODE" hint="Onboard crew shift signals" />
              <View style={styles.card}>
                <Row label="Role" value={CREW_ROLE_LABEL[profile.session.crew.role]} />
                <Row label="Shift length" value={`${profile.session.crew.shiftLengthHours} hours`} />
                <Row label="Steps today" value={profile.session.crew.steps.toLocaleString()} />
                <Row
                  label="Sweat risk"
                  value={titleCase(profile.session.crew.sweatRiskLevel)}
                  valueColor={profile.session.crew.sweatRiskLevel === "high" ? Colors.states.RECOVERING.primary : Colors.text.primary}
                />
                <Row label="Hours since break" value={`${profile.session.crew.hoursSinceBreak} hr`} />
                <View style={styles.coachBlock}>
                  <Feather name="message-circle" size={14} color={CRUISE.aqua} />
                  <Text style={styles.coachText}>
                    “You are entering a high-risk dehydration window. Drink water now and complete one
                    AForce hydration cycle before your next shift block.”
                  </Text>
                </View>
              </View>
            </>
          )}

          {!isCrew && profile.session.guest && (
            <>
              <SectionHeader label="GUEST WELLNESS MODE" hint="Daily exposure & recovery signals" />
              <View style={styles.card}>
                <Row label="Guest type" value={GUEST_TYPE_LABEL[profile.session.guest.guestType]} />
                <Row label="Pool / deck time" value={`${profile.session.guest.poolHours} hr`} />
                <Row
                  label="Alcohol intake"
                  value={`${profile.session.guest.alcoholDrinks} drink${profile.session.guest.alcoholDrinks === 1 ? "" : "s"}`}
                  valueColor={profile.session.guest.alcoholDrinks >= 3 ? Colors.states.DEPLETED.primary : Colors.text.primary}
                />
                <Row label="Excursion activity" value={`${profile.session.guest.excursionHours} hr`} />
                <Row label="Sleep quality" value={`${profile.session.guest.sleepQualityPct}%`} />
                <View style={styles.coachBlock}>
                  <Feather name="message-circle" size={14} color={CRUISE.aqua} />
                  <Text style={styles.coachText}>
                    “You had elevated sun and alcohol exposure today. Complete a recovery
                    hydration cycle before dinner.”
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ── 5. Alcohol + Sun Risk Layer ─────────────────────────── */}
          <SectionHeader label="ALCOHOL + SUN RISK" hint="Combined load on hydration" />
          <View style={[styles.card, styles.riskCard, { borderColor: riskColor + "55" }]}>
            <View style={styles.riskHeader}>
              <View>
                <Text style={styles.riskLabel}>Composite risk</Text>
                <Text style={[styles.riskValue, { color: riskColor }]}>
                  {RISK_LABEL[evaluation.riskLevel]}
                </Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: riskColor + "1F", borderColor: riskColor + "55" }]}>
                <Feather
                  name={evaluation.riskLevel === "RECOVERY_CRITICAL" ? "alert-octagon" : "activity"}
                  size={16}
                  color={riskColor}
                />
              </View>
            </View>
            {evaluation.riskReasons.length > 0 && (
              <View style={styles.reasonList}>
                {evaluation.riskReasons.map((r, i) => (
                  <View key={i} style={styles.reasonItem}>
                    <View style={[styles.reasonDot, { backgroundColor: riskColor }]} />
                    <Text style={styles.reasonText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── 6. Port Day / Excursion checklist ───────────────────── */}
          <SectionHeader label="PORT DAY CHECKLIST" hint="Before you leave the ship" />
          <View style={styles.card}>
            {PORT_DAY_CHECKLIST.map((item, i) => (
              <View key={item.id} style={[styles.checklistRow, i === PORT_DAY_CHECKLIST.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.checklistIcon, { backgroundColor: CRUISE.aquaSoft }]}>
                  <Feather name={item.icon as keyof typeof Feather.glyphMap} size={13} color={CRUISE.aqua} />
                </View>
                <Text style={styles.checklistLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── 7. Crew Aggregate Dashboard (operator) ──────────────── */}
          <SectionHeader label="CREW DASHBOARD" hint="Operator view · anonymized · opt-in" />
          <View style={styles.card}>
            {CREW_AGGREGATE_DEMO.map((d, i) => {
              const c = RISK_COLOR[d.riskLevel];
              return (
                <View key={d.department} style={[styles.deptRow, i === CREW_AGGREGATE_DEMO.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.deptHeader}>
                    <Text style={styles.deptName}>{d.department}</Text>
                    <View style={[styles.deptRiskPill, { backgroundColor: c + "1F", borderColor: c + "55" }]}>
                      <Text style={[styles.deptRiskText, { color: c }]}>{RISK_LABEL[d.riskLevel]}</Text>
                    </View>
                  </View>
                  <View style={styles.complianceBarBg}>
                    <View style={[styles.complianceBar, { width: `${d.hydrationCompliancePct}%`, backgroundColor: c }]} />
                  </View>
                  <View style={styles.deptMeta}>
                    <Text style={styles.deptMetaText}>{d.hydrationCompliancePct}% compliance</Text>
                    <Text style={styles.deptMetaText}>·</Text>
                    <Text style={styles.deptMetaText}>Peak: {d.highRiskShiftWindow}</Text>
                    <Text style={styles.deptMetaText}>·</Text>
                    <Text style={styles.deptMetaText}>{d.aforceUsagePerCrew}× / crew</Text>
                  </View>
                </View>
              );
            })}
            <Text style={styles.privacyNote}>
              Aggregate trends only. No individual health data is shown unless the user
              has explicitly opted in.
            </Text>
          </View>

          {/* ── 8. Engagement / Rewards ─────────────────────────────── */}
          <SectionHeader label="GUEST ENGAGEMENT" hint="Cruise wellness badges" />
          <View style={styles.card}>
            <View style={styles.badgeGrid}>
              {CRUISE_BADGES.map((b) => (
                <View key={b.id} style={styles.badgeCell}>
                  <View style={[styles.badgeIcon, { backgroundColor: CRUISE.aquaSoft, borderColor: CRUISE.border }]}>
                    <Feather name="award" size={16} color={CRUISE.aqua} />
                  </View>
                  <Text style={styles.badgeTitle}>{b.title}</Text>
                  <Text style={styles.badgeHint}>{b.hint}</Text>
                </View>
              ))}
            </View>
            <View style={styles.qrRow}>
              <View style={[styles.qrBox, { borderColor: CRUISE.border }]}>
                <Feather name="grid" size={28} color={CRUISE.aqua} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.qrTitle}>QR scan to log AForce usage</Text>
                <Text style={styles.qrHint}>
                  Scan the can or stick at any onboard bar to log it instantly.
                </Text>
                <Pressable style={[styles.cta, { borderColor: CRUISE.aqua }]}>
                  <Text style={[styles.ctaText, { color: CRUISE.aqua }]}>REORDER ONBOARD</Text>
                  <Feather name="arrow-right" size={12} color={CRUISE.aqua} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── 9. Cross-feature navigation ─────────────────────────── */}
          <SectionHeader label="CONNECT TO" hint="Cross-feature shortcuts" />
          <View style={[styles.card, { paddingVertical: 8 }]}>
            <NavRow
              icon="droplet"
              label="Live Hydration Score"
              hint="Open command center"
              onPress={() => router.replace("/(tabs)" as never)}
            />
            <NavRow
              icon="activity"
              label="Sweat & Autopilot"
              hint="Sweat-rate calculator · recheck cadence"
              onPress={() => router.push("/sweat" as never)}
            />
            <NavRow
              icon="thermometer"
              label="Heat Mode"
              hint="Heat-index protocol · recovery"
              onPress={() => router.push("/heat" as never)}
            />
            <NavRow
              icon="award"
              label="Wellness Badges"
              hint="Streaks · achievements · progress"
              onPress={() => router.push("/achievements" as never)}
              isLast
            />
          </View>

          {/* ── 10. Business positioning ────────────────────────────── */}
          <SectionHeader label="WHY CRUISE MODE" />
          <View style={[styles.card, { gap: 14 }]}>
            <PitchBlock
              eyebrow="FOR OPERATORS"
              body="Reduce dehydration risk, improve crew performance, and elevate guest wellness across every sailing."
            />
            <PitchBlock
              eyebrow="FOR GUESTS"
              body="Enjoy more, recover faster, and stay ahead of dehydration at sea."
            />
            <PitchBlock
              eyebrow="FOR CREW"
              body="Smarter hydration support during long shifts, heat exposure, and high-movement days."
            />
            <Text style={styles.brandLine}>
              Built for Royal Caribbean, Carnival, Norwegian, Disney, Virgin Voyages, and luxury cruise lines.
            </Text>
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function EnvCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.envCell}>
      <View style={[styles.envIcon, { backgroundColor: CRUISE.aquaSoft }]}>
        <Feather name={icon as keyof typeof Feather.glyphMap} size={13} color={accent ?? CRUISE.aqua} />
      </View>
      <Text style={styles.envLabel}>{label}</Text>
      <Text style={[styles.envValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function NavRow({
  icon,
  label,
  hint,
  onPress,
  isLast,
}: {
  icon: string;
  label: string;
  hint: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navRow,
        isLast && { borderBottomWidth: 0 },
        pressed && { backgroundColor: CRUISE.aquaSoft },
      ]}
    >
      <View style={[styles.navIcon, { backgroundColor: CRUISE.aquaSoft }]}>
        <Feather name={icon as keyof typeof Feather.glyphMap} size={14} color={CRUISE.aqua} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navLabel}>{label}</Text>
        <Text style={styles.navHint}>{hint}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={Colors.text.muted} />
    </Pressable>
  );
}

function PitchBlock({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <View>
      <Text style={[styles.pitchEyebrow, { color: CRUISE.aqua }]}>{eyebrow}</Text>
      <Text style={styles.pitchBody}>{body}</Text>
    </View>
  );
}

function titleCase(s: string) {
  return s
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// ─── Public default export with FeatureGate wrapper ─────────────────────────

export default function CruiseModeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: CRUISE.navyDeep }}>
      <FeatureGate
        flag="cruise_mode_enabled"
        title="Cruise Mode · Premium"
        description="Hydration intelligence for life at sea — for cruise crew, guests, and operators. Activate the demo to preview the full Cruise Mode product."
        accentColor={CRUISE.aqua}
        ctaLabel="Activate Cruise Demo"
      >
        <CruiseModeBody />
      </FeatureGate>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CRUISE.navyDeep },
  navyTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 16, 31, 0.55)",
  },
  aquaGlow: {
    position: "absolute",
    top: 80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: CRUISE.aquaGlow,
    opacity: 0.35,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 4 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    marginBottom: 18,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 2 },
  eyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.4,
    color: CRUISE.aqua,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Profile picker
  profileRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  profileChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CRUISE.borderSoft,
    backgroundColor: CRUISE.navyCard,
    gap: 2,
  },
  profileChipActive: {
    borderColor: CRUISE.aqua + "88",
    backgroundColor: CRUISE.navyCardElev,
  },
  profileChipLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  profileChipHint: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.4,
    color: Colors.text.secondary,
  },
  sectionHint: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    letterSpacing: 0.4,
  },

  // Card
  card: {
    backgroundColor: CRUISE.navyCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CRUISE.borderSoft,
    padding: 16,
  },

  // Hydration orb
  orbRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  orbInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  orbScore: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  orbScale: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    marginTop: -2,
  },
  orbCopy: { flex: 1, gap: 6 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  recommendation: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text.primary,
    lineHeight: 18,
  },
  recheck: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    marginTop: 2,
  },

  // Environment grid
  envGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  envCell: {
    width: "31%",
    flexGrow: 1,
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: CRUISE.navyMid,
    gap: 4,
  },
  envIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  envLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  envValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  inlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  inlineBannerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.text.secondary,
  },

  // Row
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CRUISE.borderSoft,
  },
  rowLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text.secondary,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },

  // Coach block
  coachBlock: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CRUISE.border,
    backgroundColor: CRUISE.aquaSoft,
    marginTop: 12,
  },
  coachText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text.primary,
    lineHeight: 17,
    fontStyle: "italic",
  },

  // Risk card
  riskCard: { borderWidth: 1.5 },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  riskLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  riskValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  riskBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonList: { marginTop: 12, gap: 6 },
  reasonItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonDot: { width: 5, height: 5, borderRadius: 3 },
  reasonText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.text.secondary,
  },

  // Checklist
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CRUISE.borderSoft,
  },
  checklistIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text.primary,
    flex: 1,
  },

  // Crew dashboard
  deptRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CRUISE.borderSoft,
    gap: 6,
  },
  deptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deptName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  deptRiskPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
  },
  deptRiskText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  complianceBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: CRUISE.borderSoft,
    overflow: "hidden",
  },
  complianceBar: { height: "100%", borderRadius: 2 },
  deptMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  deptMetaText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
  },
  privacyNote: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    fontStyle: "italic",
    marginTop: 12,
    lineHeight: 14,
  },

  // Badge grid
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeCell: {
    width: "47%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: CRUISE.navyMid,
    gap: 6,
  },
  badgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  badgeHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    lineHeight: 14,
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CRUISE.borderSoft,
  },
  qrBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CRUISE.navyMid,
  },
  qrTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  qrHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    lineHeight: 14,
  },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 6,
  },
  ctaText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },

  // Cross-nav row
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: CRUISE.borderSoft,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  navHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    marginTop: 1,
  },

  // Pitch
  pitchEyebrow: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 4,
  },
  pitchBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text.primary,
    lineHeight: 17,
  },
  brandLine: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 14,
  },
});
