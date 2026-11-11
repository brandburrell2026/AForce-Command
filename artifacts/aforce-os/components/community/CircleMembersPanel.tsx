import React from 'react';
import { useFeatureFlags } from '@/store/useAppStore';
import { isCircleSharingPilotEnabled } from '@/featureFlags/flags';
import { CircleSharingPanel } from './CircleSharingPanel';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af } from '@/theme';
import {
  getScopeState,
  subscribeScopeState,
  type ScopeState,
} from '@/services/userScope';
import {
  createCircleMembershipClient,
  CircleMembershipError,
  type CircleInvitation,
} from '@/services/circleMembershipService';
import { createCircleMomentSharingClient } from '@/services/circleMomentSharingService';
import { useMomentsStore } from '@/services/momentsStore';
import type { CircleUser } from '@/types/circle';

export function CircleMembersPanel({ showLegacySharing = true }: { showLegacySharing?: boolean }) {
  const scope = React.useSyncExternalStore(
    subscribeScopeState,
    getScopeState,
    getScopeState,
  );
  // Scope object identity changes on every identity transition, including A → B → A.
  const [session, setSession] = React.useState({ scope, key: 0 });
  if (session.scope !== scope) setSession({ scope, key: session.key + 1 });
  return <MemberSession key={session.key} scope={scope} showLegacySharing={showLegacySharing} />;
}

function MemberSession({ scope, showLegacySharing }: { scope: ScopeState; showLegacySharing: boolean }) {
  const { t } = useTranslation();
  const sharingEnabled = isCircleSharingPilotEnabled(useFeatureFlags());
  const client = React.useMemo(
    () => createCircleMembershipClient(scope),
    [scope],
  );
  const momentClient = React.useMemo(
    () => createCircleMomentSharingClient(scope),
    [scope],
  );
  const { moments, hydrated: momentsHydrated } = useMomentsStore();
  const [members, setMembers] = React.useState<CircleUser[]>([]);
  const [invitations, setInvitations] = React.useState<CircleInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState(false);
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [issued, setIssued] = React.useState<{
    id: string;
    code: string;
  } | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [momentSharingReady, setMomentSharingReady] = React.useState(false);
  const [selectedMomentId, setSelectedMomentId] = React.useState<string | null>(null);
  const [sharingMoment, setSharingMoment] = React.useState(false);
  const [momentShareError, setMomentShareError] = React.useState<string | null>(null);
  const [momentShareNotice, setMomentShareNotice] = React.useState<string | null>(null);
  const loadVersion = React.useRef(0);
  const current = () => getScopeState() === scope;
  const copy = (key: string) => t(`community.members.${key}`);
  function showError(e: unknown) {
    if (!current()) return;
    const code = e instanceof CircleMembershipError ? e.code : '';
    setError(
      code === 'invitation_limit_reached'
        ? 'invitation_limit'
        : code === 'invitation_unavailable'
          ? 'invalid_invite'
          : code === 'cannot_accept_own_invitation'
            ? 'own_invite'
            : code === 'sign_in_required'
              ? 'sign_in'
              : code === 'circle_membership_unavailable'
                ? 'unavailable'
                : 'error',
    );
  }
  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoaded(false);
    setMembers([]);
    setInvitations([]);
    try {
      const [list, pending] = await Promise.all([
        client.list(),
        client.invitations(),
      ]);
      if (!current() || version !== loadVersion.current) return;
      setIssued((previous) =>
        previous &&
        pending.invitations.some(
          (invite) => invite.id === previous.id && invite.status === 'pending',
        )
          ? previous
          : null,
      );
      setMembers(list.users);
      setInvitations(pending.invitations);
      setLoaded(true);
    } catch (e) {
      if (current() && version === loadVersion.current) throw e;
    } finally {
      if (current() && version === loadVersion.current) setLoading(false);
    }
  }
  React.useEffect(() => {
    if (scope.status === 'AUTHENTICATED') void load().catch(showError);
  }, [client]);
  React.useEffect(() => {
    let active = true;
    setMomentSharingReady(false);
    if (scope.status === 'AUTHENTICATED')
      void momentClient
        .incoming()
        .then(() => active && setMomentSharingReady(true))
        .catch(() => active && setMomentSharingReady(false));
    return () => { active = false; };
  }, [momentClient, scope.status]);
  async function act(action: () => Promise<unknown>, mutation = true) {
    if (busy || loading || !current()) return;
    setBusy(true);
    setError(null);
    setNotice(false);
    let saved = false;
    try {
      await action();
      if (current()) {
        saved = mutation;
        setNotice(saved);
        await load();
      }
    } catch (e) {
      if (saved && current()) setError('refresh_error');
      else showError(e);
    } finally {
      if (current()) setBusy(false);
    }
  }
  function button(label: string, onPress: () => void, disabled = false, primary = false) {
    disabled = disabled || loading;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          primary && styles.primaryButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
      </Pressable>
    );
  }
  const shareableMoments = moments.filter(
    (moment) => moment.source === 'manual' && !moment.masked,
  );
  const selectedMoment = shareableMoments.find(
    (moment) => moment.id === selectedMomentId,
  );
  async function shareSelectedMoment(member: CircleUser) {
    if (!selectedMoment || sharingMoment || !current()) return;
    setSharingMoment(true);
    setMomentShareError(null);
    setMomentShareNotice(null);
    try {
      await momentClient.share(member.userId, selectedMoment);
      if (current()) {
        setMomentShareNotice(`${selectedMoment.title} shared with ${member.name}.`);
        setSelectedMomentId(null);
      }
    } catch {
      if (current()) setMomentShareError('Moment sharing is unavailable right now.');
    } finally {
      if (current()) setSharingMoment(false);
    }
  }
  if (scope.status !== 'AUTHENTICATED')
    return (
      <Text style={styles.copy}>
        {copy(scope.status === 'UNRESOLVED' ? 'identity_loading' : 'sign_in')}
      </Text>
    );
  const activeMemberCount = members.filter((member) => member.status !== 'muted').length;
  return (
    <View style={styles.panel} testID="circle-members-panel">
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.kicker}>YOUR CIRCLE</Text>
          <Text style={styles.heading}>{copy('title')}</Text>
          <Text style={styles.copy}>
            {loaded ? `${activeMemberCount} ${activeMemberCount === 1 ? 'person' : 'people'} in your private Circle.` : 'Your private people, loading securely.'}
          </Text>
        </View>
        {button(copy('retry'), () => void act(async () => {}, false), busy || loading)}
      </View>
      <Text style={styles.disclosure}>
        {sharingEnabled
          ? t('community.sharing.membership_disclosure')
          : copy('disclosure')}
      </Text>
      {error && (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text style={styles.error}>{copy(error)}</Text>
        </View>
      )}
      {notice && (
        <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
          {copy('saved')}
        </Text>
      )}
      {loading && <Text style={styles.copy}>{copy('loading')}</Text>}
      {loaded && !loading && !members.length && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Start with one person.</Text>
          <Text style={styles.copy}>{copy('empty')}</Text>
        </View>
      )}
      {members.map((member) => (
        <View key={member.userId} style={styles.memberCard}>
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarText}>{initials(member.name)}</Text>
          </View>
          <View style={styles.memberBody}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberMeta}>
              {member.status === 'muted' ? copy('muted') : 'IN YOUR CIRCLE'}
            </Text>
            {removing === member.userId ? (
              <View style={styles.removeConfirmation}>
                <Text style={styles.copy}>{copy('remove_confirm')}</Text>
                <View style={styles.inlineActions}>
                  {button(
                    copy('confirm_remove'),
                    () =>
                      void act(async () => {
                        await client.remove(member.userId);
                        if (current()) setRemoving(null);
                      }),
                    busy,
                    true,
                  )}
                  {button(copy('cancel'), () => setRemoving(null), busy)}
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={busy || loading}
                onPress={() => setRemoving(member.userId)}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <Text style={styles.removeButtonText}>{copy('remove')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {momentSharingReady && loaded && momentsHydrated && members.some((member) => member.status === 'active') ? (
        <View style={styles.momentCard} testID="circle-moment-sharing">
          <Text style={styles.kicker}>SHARE A MOMENT</Text>
          <Text style={styles.momentTitle}>Choose what they see.</Text>
          <Text style={styles.copy}>
            Only a Moment title and scheduled time are shared. Nothing else changes.
          </Text>
          {momentShareNotice ? <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{momentShareNotice}</Text> : null}
          {momentShareError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{momentShareError}</Text> : null}
          {shareableMoments.length ? shareableMoments.map((moment) => (
            <Pressable
              key={moment.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedMomentId === moment.id }}
              onPress={() => setSelectedMomentId(moment.id)}
              style={({ pressed }) => [styles.momentOption, selectedMomentId === moment.id && styles.momentOptionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.momentOptionText, selectedMomentId === moment.id && styles.momentOptionTextSelected]}>{moment.title}</Text>
              <Text style={[styles.momentOptionMark, selectedMomentId === moment.id && styles.momentOptionTextSelected]}>{selectedMomentId === moment.id ? '✓' : '→'}</Text>
            </Pressable>
          )) : <Text style={styles.copy}>Add a manual Moment to share it with your Circle.</Text>}
          {selectedMoment ? members.filter((member) => member.status === 'active').map((member) =>
            button(`Share with ${member.name}`, () => void shareSelectedMoment(member), sharingMoment, true),
          ) : null}
        </View>
      ) : null}
      {showLegacySharing && loaded && !loading ? (
        <CircleSharingPanel
          scope={scope}
          members={members}
          enabled={sharingEnabled}
        />
      ) : null}

      <View style={styles.connectSection}>
        <Text style={styles.kicker}>ADD TO YOUR CIRCLE</Text>
        <Text style={styles.connectTitle}>{copy('connect')}</Text>
        <Text style={styles.copy}>{copy('name_disclosure')}</Text>
        <TextInput
          accessibilityLabel={copy('name')}
          placeholder={copy('name')}
          placeholderTextColor={af.textSecondary}
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={80}
          editable={!busy}
        />
        {button(
          copy('create'),
          () =>
            void act(async () => {
              const result = await client.invite(name);
              if (current()) setIssued({ id: result.invitation.id, code: result.code });
            }),
          busy || !name.trim(),
          true,
        )}
        {issued && (
          <View style={styles.inviteCode}>
            <Text style={styles.copy}>{copy('code_disclosure')}</Text>
            <Text selectable style={styles.code}>{issued.code}</Text>
          </View>
        )}
        <View style={styles.orDivider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} /></View>
        <TextInput
          accessibilityLabel={copy('paste')}
          placeholder={copy('paste')}
          placeholderTextColor={af.textSecondary}
          style={styles.input}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={256}
          editable={!busy}
        />
        {button(
          copy('accept'),
          () =>
            void act(async () => {
              await client.accept(code, name);
              if (current()) setCode('');
            }),
          busy || !name.trim() || !code.trim(),
        )}
      </View>
      {invitations
        .filter((invite) => invite.status === 'pending')
        .map((invite) => (
          <View key={invite.id} style={styles.pendingInvite}>
            <View style={styles.pendingDot} />
            <View style={styles.pendingCopy}>
              <Text style={styles.pendingTitle}>Invitation pending</Text>
              <Text style={styles.copy}>
                {t('community.members.expires', { date: new Date(invite.expiresAt).toLocaleDateString() })}
              </Text>
            </View>
            {button(
              copy('revoke'),
              () =>
                void act(async () => {
                  await client.revoke(invite.id);
                  if (current() && issued?.id === invite.id) setIssued(null);
                }),
              busy,
            )}
          </View>
        ))}
    </View>
  );
}

function initials(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  return pieces.slice(0, 2).map((piece) => piece[0]?.toUpperCase()).join('') || '•';
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  sectionHeader: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionCopy: { flex: 1, gap: 5 },
  kicker: { color: af.redText, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heading: { color: af.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  disclosure: { color: af.textSecondary, fontSize: 15, lineHeight: 21, marginTop: -5 },
  copy: { color: af.textSecondary, fontSize: 15, lineHeight: 21 },
  error: { color: af.redText, fontSize: 15, lineHeight: 21 },
  feedback: { borderLeftWidth: 2, borderLeftColor: af.red, paddingLeft: 12 },
  feedbackText: { color: af.textPrimary, fontSize: 15, lineHeight: 21 },
  emptyState: { gap: 6, paddingVertical: 18, paddingHorizontal: 18, borderWidth: 1, borderColor: af.border, borderRadius: 16, backgroundColor: af.surface },
  emptyTitle: { color: af.textPrimary, fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  memberCard: { flexDirection: 'row', gap: 14, padding: 16, borderWidth: 1, borderColor: af.border, borderRadius: 18, backgroundColor: af.surface },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: af.surface, borderWidth: 1, borderColor: af.red, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: af.textPrimary, fontSize: 17, fontWeight: '700' },
  memberBody: { flex: 1, gap: 4 },
  memberName: { color: af.textPrimary, fontSize: 18, fontWeight: '700' },
  memberMeta: { color: af.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 },
  removeButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', marginTop: 4 },
  removeButtonText: { color: af.textSecondary, fontSize: 15, textDecorationLine: 'underline' },
  removeConfirmation: { gap: 10, marginTop: 7 },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  momentCard: { gap: 10, padding: 18, borderRadius: 18, backgroundColor: af.surface, borderWidth: 1, borderColor: af.border },
  momentTitle: { color: af.textPrimary, fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  momentOption: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: af.border, borderRadius: 12, backgroundColor: af.surface },
  momentOptionSelected: { borderColor: af.red, backgroundColor: af.surface },
  momentOptionText: { color: af.textPrimary, fontSize: 17, fontWeight: '700', flex: 1 },
  momentOptionTextSelected: { color: af.textPrimary },
  momentOptionMark: { color: af.textSecondary, fontSize: 17, fontWeight: '700' },
  connectSection: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderColor: af.border },
  connectTitle: { color: af.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  input: { color: af.textPrimary, fontSize: 17, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, paddingHorizontal: 14, borderRadius: 12, minHeight: 54 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: af.border, borderRadius: 12, backgroundColor: af.surface },
  primaryButton: { backgroundColor: af.red, borderColor: af.red },
  buttonText: { color: af.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  primaryButtonText: { color: af.textPrimary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  inviteCode: { gap: 8, padding: 14, borderRadius: 12, backgroundColor: af.surface, borderWidth: 1, borderColor: af.border },
  code: { color: af.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: 0.4 },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: af.border },
  dividerText: { color: af.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  pendingInvite: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  pendingDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: af.red },
  pendingCopy: { flex: 1, gap: 2 },
  pendingTitle: { color: af.textPrimary, fontSize: 17, fontWeight: '700' },
});
