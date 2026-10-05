import React from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af } from '@/theme';
import { getScopeState, type ScopeState } from '@/services/userScope';
import { CircleMembershipError } from '@/services/circleMembershipService';
import {
  createCircleSharingClient,
  type CircleSharedField,
  type CircleSharingGrant,
  type CircleRecordedActivity,
} from '@/services/circleSharingService';
import type { CircleUser } from '@/types/circle';

const MAX_RECORD_AGE_MS = 24 * 60 * 60 * 1000;
function freshActivity(records: CircleRecordedActivity[]) {
  const now = Date.now();
  return records.filter(item => {
    const age = now - Date.parse(item.recordedAt);
    return item.source === 'recorded_app_data' && Number.isFinite(age) && age >= 0 && age < MAX_RECORD_AGE_MS && (Number.isFinite(item.score) || Boolean(item.state));
  });
}


export function CircleSharingPanel({
  scope,
  members,
  enabled = true,
}: {
  enabled?: boolean;
  scope: ScopeState;
  members: CircleUser[];
}) {
  const { t } = useTranslation();
  const client = React.useMemo(() => createCircleSharingClient(scope), [scope]);
  const [grants, setGrants] = React.useState<CircleSharingGrant[] | null>(null);
  const [activity, setActivity] = React.useState<
    CircleRecordedActivity[] | null
  >(null);
  const [activityUnavailable, setActivityUnavailable] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedRecipient, setSavedRecipient] = React.useState<string | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const generation = React.useRef(0);
  const mutationInFlight = React.useRef(false);
  const refreshing = React.useRef(false);
  const mounted = React.useRef(true);
  const current = () => mounted.current && getScopeState() === scope;
  const copy = (key: string) => t(`community.sharing.${key}`);
  async function refresh(quiet = false) {
    const request = ++generation.current;
    refreshing.current = true;
    if (!quiet) setGrants(null);
    setActivity(null);
    setLoading(true);
    try {
      const [grantsResponse, activityResponse] = await Promise.allSettled([
        client.grants(),
        enabled
          ? client.activity()
          : Promise.resolve({ activity: [] as CircleRecordedActivity[] }),
      ]);
      if (!current() || generation.current !== request) return;
      setActivityUnavailable(activityResponse.status === 'rejected');
      if (activityResponse.status === 'fulfilled')
        setActivity(freshActivity(activityResponse.value.activity));
      if (grantsResponse.status === 'fulfilled')
        setGrants(grantsResponse.value.grants);
      else {
        setGrants(null);
        throw grantsResponse.reason;
      }
    } catch (e) {
      if (current() && generation.current === request) throw e;
    } finally {
      if (current() && generation.current === request) {
        refreshing.current = false;
        setLoading(false);
      }
    }
  }
  function failure(e: unknown) {
    if (!current()) return;
    setError(
      e instanceof CircleMembershipError &&
        e.code === 'circle_sharing_unavailable'
        ? 'unavailable'
        : 'error',
    );
  }
  React.useEffect(() => {
    mounted.current = true;
    void refresh().catch(failure);
    const subscription = AppState.addEventListener('change', (state) => {
      generation.current++;
      setActivity(null);
      setGrants(null);
      if (state === 'active') void refresh().catch(failure);
    });
    const timer = setInterval(() => {
      if (
        !mutationInFlight.current &&
        !refreshing.current &&
        (AppState.currentState === 'active' || AppState.currentState == null)
      )
        void refresh(true).catch(failure);
    }, 60_000);
    return () => {
      mounted.current = false;
      generation.current++;
      subscription.remove();
      clearInterval(timer);
    };
  }, [client, enabled]);
  React.useEffect(() => {
    if (!activity?.length) return;
    const expiry = Math.min(...activity.map(item => Date.parse(item.recordedAt) + MAX_RECORD_AGE_MS));
    const timer = setTimeout(() => setActivity(previous => previous ? freshActivity(previous) : null), Math.max(1, expiry - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [activity]);

  async function save(
    memberUserId: string,
    fields: CircleSharedField[],
    version: number,
  ) {
    if (
      (!enabled && fields.length > 0) ||
      busy ||
      loading ||
      refreshing.current ||
      !current()
    )
      return false;
    const saveGeneration = generation.current;
    mutationInFlight.current = true;
    setBusy(true);
    setError(null);
    setSavedRecipient(null);
    try {
      const response = fields.length
        ? await client.save(memberUserId, fields, version)
        : await client.revoke(memberUserId, version);
      if (!current() || generation.current !== saveGeneration) return false;
      setGrants(
        (previous) =>
          previous?.map((grant) =>
            grant.memberUserId === memberUserId ? response.grant : grant,
          ) ?? null,
      );
      setSavedRecipient(
        members.find((member) => member.userId === memberUserId)?.name ?? null,
      );
      // A version-zero recipient may not have an explicit grant row yet.
      setGrants((previous) =>
        previous &&
        !previous.some((grant) => grant.memberUserId === memberUserId)
          ? [...previous, response.grant]
          : previous,
      );
      return true;
    } catch (e) {
      if (!current() || generation.current !== saveGeneration) return false;
      if (
        e instanceof CircleMembershipError &&
        e.code === 'sharing_version_conflict'
      ) {
        setError('conflict');
        await refresh().catch(failure);
      } else failure(e);
      return false;
    } finally {
      mutationInFlight.current = false;
      if (current()) setBusy(false);
    }
  }
  if (
    !enabled &&
    !error &&
    !savedRecipient &&
    !grants?.some((grant) => grant.fields.length > 0)
  )
    return null;
  return (
    <View style={styles.panel} testID="circle-sharing-panel">
      <Text style={styles.title}>{copy('title')}</Text>
      <Text style={styles.copy}>
        {copy(enabled ? 'disclosure' : 'revoke_only')}
      </Text>
      <Action
        disabled={busy || loading}
        label={copy('refresh')}
        onPress={() => {
          setError(null);
          void refresh().catch(failure);
        }}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {copy(error)}
        </Text>
      ) : null}
      {savedRecipient ? (
        <Text style={styles.copy} accessibilityLiveRegion="polite">
          {t('community.sharing.saved', { name: savedRecipient })}
        </Text>
      ) : null}
      {loading ? <Text style={styles.copy}>{copy('loading')}</Text> : null}
      {grants !== null
        ? members.map((member) => {
            const grant = grants.find(
              (item) => item.memberUserId === member.userId,
            ) ?? {
              memberUserId: member.userId,
              fields: [],
              version: 0,
              acknowledgementVersion: null,
            };
            if (!enabled && grant.fields.length === 0) return null;
            return (
              <RecipientSharing
                key={`${member.userId}:${grant.version}:${enabled}`}
                readOnly={!enabled}
                member={member}
                grant={grant}
                busy={busy || loading}
                save={save}
              />
            );
          })
        : null}
      {enabled ? (
        <>
          <Text style={styles.title}>{copy('activity')}</Text>
          {activityUnavailable ? (
            <Text style={styles.error}>{copy('activity_unavailable')}</Text>
          ) : null}
          <Text style={styles.copy}>{copy('activity_disclosure')}</Text>
          {activity !== null && activity.length === 0 ? (
            <Text style={styles.copy}>{copy('activity_empty')}</Text>
          ) : null}
          {activity?.map((item) => (
            <View key={item.userId} style={styles.row}>
              <Text style={styles.title}>{item.name}</Text>
              {typeof item.score === 'number' && Number.isFinite(item.score) ? (
                <Text style={styles.copy}>
                  {t('community.sharing.recorded_score', { score: item.score })}
                </Text>
              ) : null}
              {typeof item.state === 'string' ? (
                <Text style={styles.copy}>
                  {t('community.sharing.recorded_state', { state: item.state })}
                </Text>
              ) : null}
              <Text style={styles.copy}>
                {t('community.sharing.recorded_at', {
                  date: new Date(item.recordedAt).toLocaleString(),
                })}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function RecipientSharing({
  member,
  grant,
  busy,
  save,
  readOnly,
}: {
  member: CircleUser;
  grant: CircleSharingGrant;
  busy: boolean;
  readOnly: boolean;
  save: (
    id: string,
    fields: CircleSharedField[],
    version: number,
  ) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [fields, setFields] = React.useState<CircleSharedField[]>(grant.fields);
  const [confirming, setConfirming] = React.useState(false);
  const copy = (key: string) =>
    t(`community.sharing.${key}`, { name: member.name });
  const fieldNames = fields
    .map((field) => t(`community.sharing.field_${field}`))
    .join(', ');
  const changed =
    fields.length !== grant.fields.length ||
    fields.some((field) => !grant.fields.includes(field));
  async function commit(nextFields: CircleSharedField[]) {
    if (await save(member.userId, nextFields, grant.version))
      setConfirming(false);
  }
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{copy('recipient')}</Text>
      <Text style={styles.copy}>
        {grant.fields.length
          ? t('community.sharing.current', {
              name: member.name,
              fields: grant.fields
                .map((field) => t(`community.sharing.field_${field}`))
                .join(', '),
            })
          : copy('off')}
      </Text>
      {!readOnly &&
        (['score', 'state'] as const).map((field) => (
          <Pressable
            key={field}
            accessibilityRole="checkbox"
            accessibilityLabel={t('community.sharing.field_for', {
              field: t(`community.sharing.field_${field}`),
              name: member.name,
            })}
            aria-checked={fields.includes(field)}
            accessibilityState={{
              checked: fields.includes(field),
              disabled: busy,
            }}
            disabled={busy}
            style={styles.button}
            onPress={() => {
              setConfirming(false);
              setFields((previous) =>
                previous.includes(field)
                  ? previous.filter((item) => item !== field)
                  : [...previous, field],
              );
            }}
          >
            <Text style={styles.copy}>
              {fields.includes(field) ? '☑' : '☐'}{' '}
              {t(`community.sharing.field_${field}`)}
            </Text>
          </Pressable>
        ))}
      {confirming ? (
        <>
          <Text style={styles.copy}>
            {fields.length
              ? t('community.sharing.confirm_disclosure', {
                  name: member.name,
                  fields: fieldNames,
                })
              : copy('confirm_revoke')}
          </Text>
          <Action
            disabled={busy}
            label={copy('confirm')}
            onPress={() => void commit(fields)}
          />
          <Action
            disabled={busy}
            label={copy('cancel')}
            onPress={() => setConfirming(false)}
          />
        </>
      ) : !readOnly ? (
        <Action
          disabled={busy || !changed}
          label={copy('review')}
          onPress={() => setConfirming(true)}
        />
      ) : null}
      {grant.fields.length ? (
        <Action
          disabled={busy}
          label={copy('revoke')}
          onPress={() => {
            setFields([]);
            setConfirming(true);
          }}
        />
      ) : null}
    </View>
  );
}
function Action({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.copy}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  panel: { gap: 12, paddingTop: 16 },
  row: { gap: 8, borderTopWidth: 1, borderColor: af.border, paddingTop: 12 },
  title: { color: af.textPrimary, fontSize: 17, fontWeight: '600' },
  copy: { color: af.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: af.redText, fontSize: 14, lineHeight: 21 },
  button: {
    minHeight: 48,
    padding: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 8,
  },
});
