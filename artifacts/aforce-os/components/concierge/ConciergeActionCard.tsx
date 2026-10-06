/**
 * AForce Concierge — action card.
 *
 * Proposal → the exact details → member confirms or edits → execution through
 * a working app path → success ONLY when it succeeded; edit/undo where the
 * capability supports it; a second tap can never double-run (ActionLedger).
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { AFPrimaryButton, AFSecondaryButton, AFTextButton } from '@/components/ui';
import { fireMoment } from '@/services/haptics';
import {
  executeAction,
  undoAction,
  type ActionLedger,
  type ActionOutcome,
  type ExecuteDeps,
  OZ_MAX,
  OZ_MIN,
} from '@/services/concierge/conciergeActions';
import type { ConciergeAction } from '@/services/concierge/conciergeTypes';
import { actionDetail, actionTitle } from './conciergePresentation';

export interface ConciergeActionCardProps {
  actionId: string;
  action: ConciergeAction;
  ledger: ActionLedger;
  deps: Omit<ExecuteDeps, 'ledger'>;
  testID?: string;
}

type Phase = 'proposed' | 'editing' | 'running' | 'done' | 'undone' | 'failed';

export function ConciergeActionCard({ actionId, action: initial, ledger, deps, testID = 'concierge-action-card' }: ConciergeActionCardProps) {
  const { t, i18n } = useTranslation();
  const [action, setAction] = React.useState<ConciergeAction>(initial);
  const [phase, setPhase] = React.useState<Phase>(() => {
    const s = ledger.get(actionId);
    return s === 'done' ? 'done' : s === 'undone' ? 'undone' : 'proposed';
  });
  const [note, setNote] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const run = React.useCallback(async () => {
    if (phase === 'running' || phase === 'done') return; // duplicate-tap guard (UI layer)
    setPhase('running');
    setNote(null);
    const outcome: ActionOutcome = await executeAction(actionId, action, { ...deps, ledger });
    if (!outcome.ok) {
      if (outcome.kind === 'duplicate') {
        setPhase(ledger.get(actionId) === 'done' ? 'done' : 'proposed');
        return;
      }
      setPhase('failed');
      if (outcome.kind === 'invalid') setNote(t('concierge.action.invalid'));
      else if (outcome.kind === 'reminder_failed') {
        if (outcome.reason === 'permission') setNote(t('concierge.action.permission_needed'));
        else if (outcome.reason === 'limit_reached') setNote(t('concierge.action.reminder_limit'));
        else if (outcome.reason === 'in_past' || outcome.reason === 'invalid') setNote(t('concierge.action.invalid'));
        else setNote(t('concierge.action.failed'));
      } else setNote(t('concierge.action.failed'));
      return;
    }
    setPhase('done');
    // Receipts state what happened and when — never a cheer, never a claim.
    const at = new Date().toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
    if (outcome.kind === 'logged') {
      fireMoment('hydration_logged');
      setNote(t('concierge.action.receipt_logged', { oz: outcome.oz, time: at }));
    } else if (outcome.kind === 'reminder_set') {
      setNote(
        outcome.shifted
          ? t('concierge.action.quiet_hours', { time: outcome.timeLocal })
          : t('concierge.action.receipt_reminder', { time: outcome.timeLocal }),
      );
    } else if (outcome.kind === 'navigated') {
      setNote(t('concierge.action.receipt_opened', { time: at }));
    }
  }, [action, actionId, deps, ledger, phase, t]);

  const undo = React.useCallback(async () => {
    const ok = await undoAction(actionId, action, ledger);
    if (ok) {
      setPhase('undone');
      setNote(t('concierge.action.undone'));
    }
  }, [action, actionId, ledger, t]);

  const startEdit = () => {
    if (action.type === 'log_hydration') setDraft({ oz: String(action.oz) });
    if (action.type === 'set_reminder') setDraft({ time: action.timeLocal, date: action.dateLocal, title: action.title });
    setPhase('editing');
  };

  const applyEdit = () => {
    if (action.type === 'log_hydration') {
      const oz = Number(draft['oz']);
      if (!Number.isInteger(oz) || oz < OZ_MIN || oz > OZ_MAX) {
        setNote(t('concierge.action.invalid'));
        return;
      }
      setAction({ ...action, oz });
    }
    if (action.type === 'set_reminder') {
      const time = draft['time'] ?? action.timeLocal;
      const date = draft['date'] ?? action.dateLocal;
      const title = (draft['title'] ?? action.title).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) {
        setNote(t('concierge.action.invalid'));
        return;
      }
      setAction({ ...action, timeLocal: time, dateLocal: date, title });
    }
    setNote(null);
    setPhase('proposed');
  };

  const editable = action.type === 'log_hydration' || action.type === 'set_reminder';
  const canUndo = action.type === 'set_reminder' && phase === 'done';
  const title = actionTitle(action, t);
  const detail = actionDetail(action, t);

  return (
    <View style={styles.card} testID={testID} accessible={false}>
      <View style={styles.head}>
        <Icon name={phase === 'done' ? 'check-circle' : 'arrow-right-circle'} size={16} color={phase === 'done' ? af.green : af.textPrimary} />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      </View>

      {phase === 'editing' ? (
        <View style={styles.editBlock}>
          {action.type === 'log_hydration' ? (
            <>
              <Text style={styles.fieldLabel}>{t('concierge.action.oz_label')}</Text>
              <TextInput
                value={draft['oz'] ?? ''}
                onChangeText={(v) => setDraft({ ...draft, oz: v.replace(/[^\d]/g, '') })}
                keyboardType="number-pad"
                style={styles.input}
                accessibilityLabel={t('concierge.action.oz_label')}
                maxLength={2}
                testID={`${testID}-oz`}
              />
            </>
          ) : null}
          {action.type === 'set_reminder' ? (
            <>
              <Text style={styles.fieldLabel}>{t('concierge.action.set_reminder_title')}</Text>
              <TextInput
                value={draft['title'] ?? ''}
                onChangeText={(v) => setDraft({ ...draft, title: v })}
                style={styles.input}
                accessibilityLabel={t('concierge.action.set_reminder_title')}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>{t('concierge.action.time_label')}</Text>
              <TextInput
                value={draft['time'] ?? ''}
                onChangeText={(v) => setDraft({ ...draft, time: v })}
                style={styles.input}
                accessibilityLabel={t('concierge.action.time_label')}
                maxLength={5}
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>{t('concierge.action.date_label')}</Text>
              <TextInput
                value={draft['date'] ?? ''}
                onChangeText={(v) => setDraft({ ...draft, date: v })}
                style={styles.input}
                accessibilityLabel={t('concierge.action.date_label')}
                maxLength={10}
                autoCapitalize="none"
              />
            </>
          ) : null}
          <View style={styles.row}>
            <AFSecondaryButton label={t('common.cancel')} onPress={() => setPhase('proposed')} style={styles.grow} />
            <AFPrimaryButton label={t('concierge.action.done')} onPress={applyEdit} style={styles.grow} testID={`${testID}-apply-edit`} />
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.detail} testID={`${testID}-detail`}>{detail}</Text>
          {phase === 'done' || phase === 'undone' ? (
            <View style={styles.row}>
              <Text style={[styles.status, phase === 'done' && styles.statusDone]} accessibilityRole="text">
                {phase === 'done' ? t('concierge.action.done') : t('concierge.action.undone')}
              </Text>
              {canUndo ? <AFTextButton label={t('concierge.action.undo')} onPress={() => void undo()} testID={`${testID}-undo`} /> : null}
            </View>
          ) : (
            <View style={styles.row}>
              {editable ? <AFSecondaryButton label={t('concierge.action.edit')} onPress={startEdit} style={styles.grow} testID={`${testID}-edit`} /> : null}
              <AFPrimaryButton
                label={phase === 'failed' ? t('common.retry') : t('concierge.action.confirm_cta')}
                onPress={() => void run()}
                loading={phase === 'running'}
                style={styles.grow}
                testID={`${testID}-confirm`}
              />
            </View>
          )}
        </>
      )}
      {note ? (
        <Text style={[styles.note, phase === 'failed' && styles.noteError]} accessibilityLiveRegion="polite" testID={`${testID}-note`}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    paddingVertical: 12,
    borderTopWidth: afLayout.hairline,
    borderTopColor: af.divider,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...afType.bodyStrong, color: af.textPrimary, flex: 1 },
  detail: { ...afType.secondary, color: af.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  grow: { flex: 1 },
  status: { ...afType.caption, color: af.textSecondary, flex: 1 },
  statusDone: { color: af.green },
  editBlock: { gap: 6 },
  fieldLabel: { ...afType.caption, color: af.textTertiary },
  input: {
    ...afType.body,
    color: af.textPrimary,
    minHeight: afLayout.controlMinHeight,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  note: { ...afType.caption, color: af.textSecondary },
  noteError: { color: af.redText },
});
