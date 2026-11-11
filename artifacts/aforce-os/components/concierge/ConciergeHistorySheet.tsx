/**
 * AForce Concierge — conversation history (open / delete one / delete all).
 *
 * Black Issue: hairline rows (title left, mono date right) in place of boxed
 * cards; the open conversation carries a red rule at its left edge and says so
 * to the reader (selected state), so it is never told apart by hue alone.
 */
import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { AFDisclosureSheet, AFEmptyState, AFInlineErrorRow, AFSecondaryButton, AFSkeleton } from '@/components/ui';
import type { ConciergeConversationSummary } from '@/services/concierge/conciergeTypes';
import type { ConciergeErrorKind } from '@/services/concierge/conciergeApi';

export interface ConciergeHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  list: ConciergeConversationSummary[];
  loading: boolean;
  error: ConciergeErrorKind | null;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onRefresh: () => void;
}

export function ConciergeHistorySheet(props: ConciergeHistorySheetProps) {
  const { visible, onClose, list, loading, error, activeId, onOpen, onDelete, onDeleteAll, onRefresh } = props;
  const { t, i18n } = useTranslation();
  const eyebrowType = useAFEyebrowType();

  const confirmDelete = (id: string) => {
    if (Platform.OS === 'web') return onDelete(id);
    Alert.alert(t('concierge.delete_confirm_title'), t('concierge.delete_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('concierge.delete_conversation'), style: 'destructive', onPress: () => onDelete(id) },
    ]);
  };
  const confirmDeleteAll = () => {
    if (Platform.OS === 'web') return onDeleteAll();
    Alert.alert(t('concierge.delete_all_confirm_title'), t('concierge.delete_all_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('concierge.delete_all'), style: 'destructive', onPress: onDeleteAll },
    ]);
  };

  return (
    <AFDisclosureSheet visible={visible} onClose={onClose} title={t('concierge.history')} testID="concierge-history-sheet">
      {error ? <AFInlineErrorRow message={t('common.error')} onRetry={onRefresh} retryLabel={t('common.retry')} /> : null}
      {loading && list.length === 0 ? (
        <View style={styles.skeletons}>
          <AFSkeleton height={48} radius={12} />
          <AFSkeleton height={48} radius={12} />
        </View>
      ) : list.length === 0 ? (
        <AFEmptyState title={t('concierge.history_empty_title')} message={t('concierge.history_empty_body')} icon="message-circle" />
      ) : (
        <View style={styles.list}>
          {list.map((c) => {
            const when = new Date(c.updatedAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
            const title = c.title ?? t('concierge.new_chat');
            return (
              <View key={c.id} style={[styles.row, c.id === activeId && styles.rowActive]}>
                <Pressable
                  onPress={() => onOpen(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}, ${when}`}
                  accessibilityState={{ selected: c.id === activeId }}
                  style={styles.rowMain}
                  testID={`concierge-history-open-${c.id}`}
                >
                  <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
                  <Text style={[styles.rowMeta, eyebrowType]}>{when}</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('concierge.delete_conversation')}
                  hitSlop={8}
                  style={styles.trash}
                  testID={`concierge-history-delete-${c.id}`}
                >
                  <Icon name="x" size={16} color={af.textSecondary} />
                </Pressable>
              </View>
            );
          })}
          <AFSecondaryButton label={t('concierge.delete_all')} onPress={confirmDeleteAll} style={styles.deleteAll} testID="concierge-history-delete-all" />
        </View>
      )}
    </AFDisclosureSheet>
  );
}

const styles = StyleSheet.create({
  skeletons: { gap: 10 },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  rowActive: { borderLeftWidth: 2, borderLeftColor: af.red, paddingLeft: 10 },
  rowMain: { flex: 1, minHeight: afLayout.controlMinHeight + 8, paddingVertical: 10, gap: 4 },
  rowTitle: { ...afType.body, color: af.textPrimary },
  rowMeta: { ...afType.eyebrow, color: af.textTertiary, textTransform: 'uppercase' },
  trash: { width: afLayout.controlMinHeight, height: afLayout.controlMinHeight, alignItems: 'center', justifyContent: 'center' },
  deleteAll: { marginTop: 16 },
});
