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

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
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
  PORT_DAY_CHECKLIST,
  CRUISE_BADGES,
  CREW_ROLE_LABEL,
  GUEST_TYPE_LABEL,
  RISK_LABEL,
  FLEET_DEMO,
  summarizeFleet,
  type CruiseDemoProfile,
  type CruiseRiskLevel,
  type CruiseStatus,
  type CruiseSession,
  type EnvironmentFactors,
} from "@/services/cruiseModeService";
import {
  fetchCruiseEnvironment,
  type CruiseLiveEnvironment,
} from "@/services/cruiseEnvService";

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

// Ports the user can switch the live environment to. Mirrors the
// allow-list on the api-server route — adding one here without adding
// it on the server will return a 400.
const PORT_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "miami", label: "Miami" },
  { id: "cozumel", label: "Cozumel" },
  { id: "nassau", label: "Nassau" },
  { id: "st_thomas", label: "St. Thomas" },
  { id: "cayman", label: "Grand Cayman" },
  { id: "juneau", label: "Juneau" },
  { id: "barcelona", label: "Barcelona" },
];

function CruiseModeBody() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profileIdx, setProfileIdx] = useState(0);
  const [portId, setPortId] = useState<string>("cozumel");
  const [liveEnv, setLiveEnv] = useState<CruiseLiveEnvironment | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState<string | null>(null);
  const [shipIdx, setShipIdx] = useState(0);

  const profile: CruiseDemoProfile = CRUISE_DEMO_PROFILES[profileIdx]!;
  const ship = FLEET_DEMO[shipIdx]!;
  const fleetSummary = useMemo(() => summarizeFleet(FLEET_DEMO), []);

  // Pull live conditions for the selected port. The api-server returns a
  // realistic Caribbean fallback when OpenWeather is unavailable, so this
  // never blocks the orb from rendering.
  useEffect(() => {
    let cancelled = false;
    setEnvLoading(true);
    setEnvError(null);
    fetchCruiseEnvironment(portId)
      .then((env) => {
        if (cancelled) return;
        setLiveEnv(env);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEnvError(err instanceof Error ? err.message : "Failed to load");
        setLiveEnv(null);
      })
      .finally(() => {
        if (!cancelled) setEnvLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portId]);

  // Only blend live conditions when the response matches the currently
  // selected port — otherwise a slow previous fetch could briefly show
  // Cozumel temps on a Juneau chip.
  const matchedLiveEnv = liveEnv && liveEnv.port === portId ? liveEnv : null;

  // Merge live env into the active profile so the orb / risk / heat-index
  // all reflect the real port conditions, not the demo seed.
  const effectiveSession: CruiseSession = useMemo(() => {
    const base = profile.session;
    const env: EnvironmentFactors = matchedLiveEnv
      ? {
          ...base.env,
          ambientTempF: matchedLiveEnv.ambientTempF,
          humidityPct: matchedLiveEnv.humidityPct,
          sunExposureHours: matchedLiveEnv.sunExposureHours,
        }
      : base.env;
    return { ...base, env };
  }, [profile, matchedLiveEnv]);

  const evaluation = useMemo(
    () => evaluateCruise(effectiveSession),
    [effectiveSession],
  );

  const topPadding = Platform.OS === "web" ? 24 : insets.top;
  const isCrew = effectiveSession.userType === "crew";
  const statusColor = STATUS_COLOR[evaluation.status];
  const riskColor = RISK_COLOR[evaluation.riskLevel];
  const isLiveSource = matchedLiveEnv?.source === "openweather";
  const sourceLabel = envLoading
    ? "Fetching…"
    : isLiveSource
      ? "Live"
      : envError
        ? "Offline"
        : "Pilot Data";
  const sourceColor = envLoading
    ? Colors.text.muted
    : isLiveSource
      ? Colors.states.PEAK.primary
      : envError
        ? Colors.states.RECOVERING.primary
        : CRUISE.aqua;

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

          {/* ── 2. Ship Environment Factors (LIVE) ──────────────────── */}
          <SectionHeader
            label="SHIP ENVIRONMENT"
            hint={
              matchedLiveEnv
                ? `${matchedLiveEnv.portName} · ${matchedLiveEnv.conditions}`
                : "Live port conditions"
            }
          />
          <View style={styles.card}>
            <View style={styles.liveStrip}>
              <View style={[styles.sourcePill, { borderColor: sourceColor + "66", backgroundColor: sourceColor + "1A" }]}>
                {envLoading ? (
                  <ActivityIndicator size="small" color={sourceColor} />
                ) : (
                  <View style={[styles.sourceDot, { backgroundColor: sourceColor }]} />
                )}
                <Text style={[styles.sourcePillText, { color: sourceColor }]}>
                  {sourceLabel.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.liveStripCaption} numberOfLines={1}>
                {isLiveSource
                  ? `OpenWeather · ${matchedLiveEnv ? new Date(matchedLiveEnv.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}`
                  : envError
                    ? "Upstream unavailable"
                    : "Pilot baseline data"}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.portRow}
            >
              {PORT_OPTIONS.map((p) => {
                const active = p.id === portId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPortId(p.id)}
                    style={[styles.portChip, active && styles.portChipActive]}
                    testID={`cruise-port-${p.id}`}
                  >
                    <Feather
                      name="map-pin"
                      size={11}
                      color={active ? CRUISE.aqua : Colors.text.muted}
                    />
                    <Text style={[styles.portChipText, active && { color: CRUISE.aqua }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.envGrid}>
              <EnvCell
                icon="thermometer"
                label="Temperature"
                value={`${effectiveSession.env.ambientTempF}°F`}
              />
              <EnvCell
                icon="cloud-drizzle"
                label="Humidity"
                value={`${effectiveSession.env.humidityPct}%`}
              />
              <EnvCell
                icon="sun"
                label="Sun exposure"
                value={`${effectiveSession.env.sunExposureHours.toFixed(1)} hr`}
              />
              <EnvCell
                icon="wind"
                label="Heat index"
                value={`${evaluation.envHeatIndexF}°F`}
                accent={evaluation.envHeatIndexF >= 90 ? Colors.states.RECOVERING.primary : undefined}
              />
              <EnvCell
                icon={effectiveSession.env.deckExposure === "outdoor" ? "sunrise" : "home"}
                label="Deck"
                value={titleCase(effectiveSession.env.deckExposure)}
              />
              <EnvCell
                icon="navigation"
                label="Wind"
                value={matchedLiveEnv ? `${matchedLiveEnv.windKts} kts` : "—"}
              />
            </View>
            {effectiveSession.env.excursionRisk !== "none" && (
              <View style={[styles.inlineBanner, { borderColor: CRUISE.aqua + "55", backgroundColor: CRUISE.aqua + "10" }]}>
                <Feather name="alert-triangle" size={13} color={CRUISE.aqua} />
                <Text style={styles.inlineBannerText}>
                  Excursion risk: <Text style={{ color: CRUISE.aqua }}>{titleCase(effectiveSession.env.excursionRisk)}</Text>
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

          {/* ── 7. Operator Fleet Dashboard ─────────────────────────── */}
          <SectionHeader
            label="OPERATOR FLEET DASHBOARD"
            hint={`${fleetSummary.shipCount} ships · ${fleetSummary.totalCrew.toLocaleString()} crew`}
          />

          {/* Fleet KPI strip */}
          <View style={[styles.card, { paddingVertical: 14 }]}>
            <View style={styles.kpiRow}>
              <KpiCell
                label="Fleet compliance"
                value={`${fleetSummary.weightedCompliancePct}%`}
                accent={CRUISE.aqua}
              />
              <View style={styles.kpiDivider} />
              <KpiCell
                label="High-risk crew"
                value={fleetSummary.highRiskCrewCount.toLocaleString()}
                accent={Colors.states.RECOVERING.primary}
              />
              <View style={styles.kpiDivider} />
              <KpiCell
                label="Top-risk ship"
                value={fleetSummary.topRiskShip.name}
                accent={Colors.text.primary}
                small
              />
            </View>
          </View>

          {/* Ship switcher */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shipRow}
          >
            {FLEET_DEMO.map((s, i) => {
              const active = i === shipIdx;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setShipIdx(i)}
                  style={[styles.shipChip, active && styles.shipChipActive]}
                  testID={`cruise-ship-${s.id}`}
                >
                  <Text style={[styles.shipChipName, active && { color: CRUISE.aqua }]}>
                    {s.name}
                  </Text>
                  <Text style={styles.shipChipMeta}>
                    {s.line} · {s.totalCrew.toLocaleString()} crew
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Selected ship detail */}
          <View style={styles.card}>
            <View style={styles.shipHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shipHeaderName}>{ship.name}</Text>
                <Text style={styles.shipHeaderMeta}>
                  {ship.line} · Today: {ship.portToday}
                </Text>
              </View>
              <View style={styles.shipHeaderKpi}>
                <Text style={styles.shipHeaderKpiValue}>{ship.fleetCompliancePct}%</Text>
                <Text style={styles.shipHeaderKpiLabel}>compliance</Text>
              </View>
            </View>
            {ship.departments.map((d, i) => {
              const c = RISK_COLOR[d.riskLevel];
              return (
                <View key={d.department} style={[styles.deptRow, i === ship.departments.length - 1 && { borderBottomWidth: 0 }]}>
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

function KpiCell({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent: string;
  small?: boolean;
}) {
  return (
    <View style={styles.kpiCell}>
      <Text
        style={[small ? styles.kpiValueSmall : styles.kpiValue, { color: accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
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

  // Live env strip
  liveStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourcePillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  liveStripCaption: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },

  // Port chips
  portRow: {
    gap: 8,
    paddingBottom: 12,
    paddingRight: 8,
  },
  portChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CRUISE.borderSoft,
    backgroundColor: CRUISE.navyMid,
  },
  portChipActive: {
    borderColor: CRUISE.aqua + "88",
    backgroundColor: CRUISE.aquaSoft,
  },
  portChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text.secondary,
  },

  // Fleet KPI strip
  kpiRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  kpiCell: {
    flex: 1,
    gap: 4,
  },
  kpiValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text.primary,
  },
  kpiValueSmall: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.text.primary,
  },
  kpiLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  kpiDivider: {
    width: 1,
    backgroundColor: CRUISE.borderSoft,
  },

  // Fleet ship switcher
  shipRow: {
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  shipChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CRUISE.borderSoft,
    backgroundColor: CRUISE.navyMid,
    minWidth: 170,
  },
  shipChipActive: {
    borderColor: CRUISE.aqua + "88",
    backgroundColor: CRUISE.aquaSoft,
  },
  shipChipName: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  shipChipMeta: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    marginTop: 2,
  },

  // Selected-ship header inside detail card
  shipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CRUISE.borderSoft,
  },
  shipHeaderName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text.primary,
  },
  shipHeaderMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.text.muted,
    marginTop: 2,
  },
  shipHeaderKpi: {
    alignItems: "flex-end",
  },
  shipHeaderKpiValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: CRUISE.aqua,
  },
  shipHeaderKpiLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.text.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
