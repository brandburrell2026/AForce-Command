/**
 * SOAP note entry — file a note from a phone.
 *
 * Phase 4. Built around the 60-second target: one screen, no navigation
 * between fields, a template row that fills the scaffolding in one tap, and a
 * single file action. The trainer edits prompts rather than composing from
 * nothing.
 *
 * Amendment mode is the same screen with a required reason. There is no edit
 * mode, because there is no edit: filing an amendment writes a new version
 * and leaves the prior one intact, which is enforced server-side.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { af, afLayout, afType } from "@/theme/afTokens";
import {
  NOTE_TEMPLATES,
  draftFromTemplate,
  hasContent,
  toSubmission,
  type NoteTemplate,
  type SoapDraft,
} from "@/utils/trainerNoteTemplates";

export interface TrainerNoteEntryScreenProps {
  athleteDisplayName: string;
  /** Present when amending: the reason field becomes required. */
  amendingNoteId?: number | null;
  onCancel?: () => void;
  onSubmit?: (payload: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    templateId: string;
    amendmentReason?: string;
  }) => void;
}

const FIELDS: { key: keyof SoapDraft; label: string; hint: string }[] = [
  { key: "subjective", label: "S — SUBJECTIVE", hint: "What the athlete reports" },
  { key: "objective", label: "O — OBJECTIVE", hint: "What you observed" },
  { key: "assessment", label: "A — ASSESSMENT", hint: "Your assessment" },
  { key: "plan", label: "P — PLAN", hint: "What happens next" },
];

export default function TrainerNoteEntryScreen({
  athleteDisplayName,
  amendingNoteId = null,
  onCancel,
  onSubmit,
}: TrainerNoteEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const [template, setTemplate] = useState<NoteTemplate>(NOTE_TEMPLATES[0]!);
  const [draft, setDraft] = useState<SoapDraft>(() => draftFromTemplate(NOTE_TEMPLATES[0]!));
  const [reason, setReason] = useState("");

  const amending = amendingNoteId !== null;
  const ready = useMemo(
    () => hasContent(draft, template) && (!amending || reason.trim().length > 0),
    [draft, template, amending, reason],
  );

  const applyTemplate = useCallback((next: NoteTemplate) => {
    setTemplate(next);
    setDraft(draftFromTemplate(next));
  }, []);

  const submit = useCallback(() => {
    if (!ready || !onSubmit) return;
    const payload = toSubmission(draft, template);
    onSubmit({
      ...payload,
      templateId: template.id,
      ...(amending ? { amendmentReason: reason.trim() } : {}),
    });
  }, [ready, onSubmit, draft, template, amending, reason]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + afLayout.cardPadding,
        paddingBottom: insets.bottom + afLayout.sectionGap,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>CANCEL</Text>
        </Pressable>
        <Text style={styles.title}>{amending ? "Amend note" : "New note"}</Text>
        <Text style={styles.meta}>{athleteDisplayName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TEMPLATE</Text>
        <View style={styles.templateRow}>
          {NOTE_TEMPLATES.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: t.id === template.id }}
              accessibilityLabel={`${t.label} template`}
              onPress={() => applyTemplate(t)}
              hitSlop={8}
              style={[styles.chip, t.id === template.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, t.id === template.id && styles.chipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{field.label}</Text>
          <TextInput
            accessibilityLabel={field.label}
            value={draft[field.key]}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, [field.key]: text }))}
            placeholder={field.hint}
            placeholderTextColor={af.textDisabled}
            multiline
            style={styles.input}
          />
        </View>
      ))}

      {amending ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AMENDMENT REASON — REQUIRED</Text>
          <TextInput
            accessibilityLabel="Amendment reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Why this note is being revised"
            placeholderTextColor={af.textDisabled}
            style={styles.input}
          />
          <Text style={styles.note}>
            The earlier version is kept. This files a new version beside it.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          accessibilityLabel={amending ? "File amendment" : "File note"}
          disabled={!ready}
          onPress={submit}
          style={[styles.submit, !ready && styles.submitDisabled]}
        >
          <Text style={[styles.submitText, !ready && styles.submitTextDisabled]}>
            {amending ? "FILE AMENDMENT" : "FILE NOTE"}
          </Text>
        </Pressable>
        <Text style={styles.note}>
          Recommendation — clinical decision remains with licensed staff.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  header: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingBottom: afLayout.cardPadding,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  cancel: { ...afType.tab, color: af.redText, minHeight: afLayout.controlMinHeight },
  title: { ...afType.title1, color: af.textPrimary },
  meta: { ...afType.caption, color: af.textSecondary, marginTop: 4 },

  section: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingTop: afLayout.cardPadding,
  },
  sectionTitle: { ...afType.eyebrow, color: af.redText, marginBottom: 8 },
  templateRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    minHeight: afLayout.controlMinHeight,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  chipActive: { borderColor: af.red, backgroundColor: af.redDim },
  chipText: { ...afType.tab, color: af.textSecondary },
  chipTextActive: { color: af.textPrimary },

  input: {
    ...afType.body,
    color: af.textPrimary,
    backgroundColor: af.surface,
    borderRadius: afLayout.radiusButton,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    padding: afLayout.cardPadding,
    minHeight: 88,
    textAlignVertical: "top",
  },
  note: { ...afType.caption, color: af.textTertiary, marginTop: 8 },

  submit: {
    minHeight: afLayout.buttonHeight,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: afLayout.radiusButton,
    backgroundColor: af.red,
  },
  submitDisabled: { backgroundColor: af.surfaceRaised },
  submitText: { ...afType.bodyStrong, color: af.onRed },
  submitTextDisabled: { color: af.textDisabled },
});
