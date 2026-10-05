import React from 'react';
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
import type { CircleUser } from '@/types/circle';

export function CircleMembersPanel() {
  const scope = React.useSyncExternalStore(
    subscribeScopeState,
    getScopeState,
    getScopeState,
  );
  // Scope object identity changes on every identity transition, including A → B → A.
  const [session, setSession] = React.useState({ scope, key: 0 });
  if (session.scope !== scope) setSession({ scope, key: session.key + 1 });
  return <MemberSession key={session.key} scope={scope} />;
}

function MemberSession({ scope }: { scope: ScopeState }) {
  const { t } = useTranslation();
  const client = React.useMemo(
    () => createCircleMembershipClient(scope),
    [scope],
  );
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
  function button(label: string, onPress: () => void, disabled = false) {
    disabled = disabled || loading;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    );
  }
  if (scope.status !== 'AUTHENTICATED')
    return (
      <Text style={styles.copy}>
        {copy(scope.status === 'UNRESOLVED' ? 'identity_loading' : 'sign_in')}
      </Text>
    );
  return (
    <View style={styles.panel} testID="circle-members-panel">
      <Text style={styles.title}>{copy('title')}</Text>
      <Text style={styles.copy}>{copy('disclosure')}</Text>
      {button(
        copy('retry'),
        () => void act(async () => {}, false),
        busy || loading,
      )}
      {error && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{copy(error)}</Text>
        </View>
      )}
      {notice && (
        <Text accessibilityLiveRegion="polite" style={styles.copy}>
          {copy('saved')}
        </Text>
      )}
      {loading && <Text style={styles.copy}>{copy('loading')}</Text>}
      {loaded && !loading && !members.length && (
        <Text style={styles.copy}>{copy('empty')}</Text>
      )}
      {members.map((member) => (
        <View key={member.userId} style={styles.row}>
          <Text style={styles.title}>{member.name}</Text>
          {member.status === 'muted' ? (
            <Text style={styles.copy}>{copy('muted')}</Text>
          ) : null}
          {removing === member.userId ? (
            <>
              <Text style={styles.copy}>{copy('remove_confirm')}</Text>
              {button(
                copy('confirm_remove'),
                () =>
                  void act(async () => {
                    await client.remove(member.userId);
                    if (current()) setRemoving(null);
                  }),
                busy,
              )}
              {button(copy('cancel'), () => setRemoving(null), busy)}
            </>
          ) : (
            button(copy('remove'), () => setRemoving(member.userId), busy)
          )}
        </View>
      ))}
      <Text style={styles.title}>{copy('connect')}</Text>
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
            if (current())
              setIssued({ id: result.invitation.id, code: result.code });
          }),
        busy || !name.trim(),
      )}
      {issued && (
        <View style={styles.row}>
          <Text style={styles.copy}>{copy('code_disclosure')}</Text>
          <Text selectable style={styles.code}>
            {issued.code}
          </Text>
        </View>
      )}
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
      {invitations
        .filter((invite) => invite.status === 'pending')
        .map((invite) => (
          <View key={invite.id} style={styles.row}>
            <Text style={styles.copy}>
              {t('community.members.expires', {
                date: new Date(invite.expiresAt).toLocaleDateString(),
              })}
            </Text>
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
const styles = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 16,
    backgroundColor: af.surface,
    borderRadius: 16,
  },
  row: { gap: 8, borderTopWidth: 1, borderColor: af.border, paddingTop: 12 },
  title: { color: af.textPrimary, fontSize: 17, fontWeight: '600' },
  copy: { color: af.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: af.redText, fontSize: 14, lineHeight: 21 },
  input: {
    color: af.textPrimary,
    borderWidth: 1,
    borderColor: af.border,
    padding: 12,
    borderRadius: 8,
    minHeight: 48,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 8,
  },
  buttonText: { color: af.textPrimary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  code: { color: af.textPrimary, fontSize: 16 },
});
