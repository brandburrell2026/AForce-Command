/**
 * HydroScan label reader: the sheets that rise over the camera. Presentation
 * only. Every line a member reads is in LABEL_COPY so wording can be reviewed
 * in one place.
 *
 * Nothing here writes, shows a score of the member, or shows a HydroState
 * ring (rulings D1 and D4). A drink is logged only from "Log it".
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { af } from '@/theme/afTokens';
import { DRINK_CATEGORIES, type DrinkCategoryId } from '@/data/drinkCatalog';
import { CUSTOM_OZ_HINT, type AmountChoice, type AmountPlan } from '@/utils/hydroscan/amountOptions';
import { displayNameFor, formatOz, type Confidence, type EvidenceSource, type Reading } from '@/utils/hydroscan/labelEvidence';

const MONO = 'IBMPlexMono_500Medium';

/** Every new member-facing line of the flagged reader. */
export const LABEL_COPY = {
  frameHint: 'POINT AT THE LABEL',
  frameHintBarcodeOnly: 'POINT AT BARCODE',
  frameNote: 'LABEL AND BARCODE · ON DEVICE · NOT SAVED',
  frameNoteBarcodeOnly: 'BARCODE DETECTION · ON DEVICE',
  startingCamera: 'STARTING CAMERA',
  reading: 'READING',
  modeLabel: 'Label',
  pickType: 'Pick a type',
  cardCaption: 'LOOKS LIKE',
  rowType: 'Type',
  rowSize: 'Size',
  sizeNotRead: 'Not read',
  change: 'Change',
  sizeIsRight: 'Size is right',
  thatsRight: 'That’s right',
  scanAgain: 'Scan again',
  typeIt: 'Type it',
  nothingLogged: 'Nothing is logged yet.',
  questionCaption: 'ONE QUESTION',
  amountTitle: 'How much did you drink?',
  amountNothingLogged: 'Nothing is logged.',
  logIt: 'Log it',
  back: 'Back',
  customLabel: 'Amount in fl oz',
  typeGridTitle: 'What kind of drink is it?',
  typeGridBody: 'Pick the kind, then check the size.',
  sizeTitle: 'What size is the container?',
  sizeNotSure: 'Not sure',
  alcoholCaption: 'NOT AVAILABLE HERE',
  alcoholTitle: 'This looks like an alcoholic drink.',
  alcoholBody: 'HydroScan can’t log alcohol in this build.',
  failedCaption: 'NOT LOGGED',
  failedTitle: 'Not logged.',
  failedBody: 'Your drink was not saved. Check your connection and try again.',
  tryAgain: 'Try again',
  cameraOffCaption: 'CAMERA IS OFF FOR AFORCE',
  cameraOffBody: 'HydroScan needs the camera to read the label and the barcode. Nothing is saved or sent. You can type your drink instead.',
  allowCamera: 'ALLOW CAMERA',
  cameraSettings: 'Turn it on in Settings › AFORCE › Camera.',
} as const;

const SOURCE_WORD: Record<EvidenceSource, string> = { barcode: 'Barcode', label: 'Label', user: 'You' };

function Tile({ label, onPress, testID, disabled, selected }: { label: string; onPress: () => void; testID?: string; disabled?: boolean; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      style={[s.tile, selected && s.tileOn]}
      testID={testID}
    >
      <Text style={[s.tileText, selected && s.tileTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Wide({ label, onPress, primary, testID, disabled }: { label: string; onPress: () => void; primary?: boolean; testID?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.wide, primary && s.widePrimary, disabled && s.off]}
      testID={testID}
    >
      <Text style={[s.wideText, primary && s.wideTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const confidenceWord = (c: Confidence) => (c === 'likely' ? ' · likely' : '');

function Row({ label, value, source, confidence, onChange, testID }: { label: string; value: string; source: EvidenceSource | null; confidence: Confidence; onChange: () => void; testID: string }) {
  const note = source ? `${SOURCE_WORD[source]}${confidenceWord(confidence)}` : '';
  return (
    <View style={s.row} testID={testID}>
      <View style={s.rowText} accessible accessibilityLabel={`${label}, ${value}${note ? `, ${note}` : ''}`}>
        <Text style={s.caption}>{label.toUpperCase()}</Text>
        <Text style={s.rowValue}>{value}</Text>
        {note ? <Text style={s.rowNote}>{note}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${LABEL_COPY.change} ${label.toLowerCase()}`} hitSlop={8} onPress={onChange} style={s.change} testID={`${testID}-change`}>
        <Text style={s.changeText}>{LABEL_COPY.change}</Text>
      </Pressable>
    </View>
  );
}

const typeName = (reading: Reading): string => {
  const c = reading.drinkType.value;
  if (!c) return '';
  if (c === 'bottled_water' || c === 'water') return reading.sparkling ? 'Sparkling water' : DRINK_CATEGORIES[c].label;
  return DRINK_CATEGORIES[c].label;
};

/** The recognised drink, with what each detail rests on. Nothing is saved from here. */
export function HydroScanLabelCard({
  reading,
  onConfirm,
  onChangeType,
  onChangeSize,
  onConfirmSize,
  onScanAgain,
  onType,
}: {
  reading: Reading;
  onConfirm: () => void;
  onChangeType: () => void;
  onChangeSize: () => void;
  onConfirmSize: () => void;
  onScanAgain: () => void;
  onType: () => void;
}) {
  const name = displayNameFor(reading);
  return (
    <View testID="hydroscan-label-card">
      <View accessible accessibilityLiveRegion="polite">
        <Text style={s.caption}>{LABEL_COPY.cardCaption}</Text>
        <Text accessibilityRole="header" style={s.title}>{name}</Text>
      </View>
      <Row label={LABEL_COPY.rowType} value={typeName(reading)} source={reading.drinkType.source} confidence={reading.drinkType.confidence} onChange={onChangeType} testID="hydroscan-label-row-type" />
      <Row
        label={LABEL_COPY.rowSize}
        value={reading.volume.value != null ? formatOz(reading.volume.value) : LABEL_COPY.sizeNotRead}
        source={reading.volume.source}
        confidence={reading.volume.confidence}
        onChange={onChangeSize}
        testID="hydroscan-label-row-size"
      />
      {reading.volume.value != null && reading.volume.confidence === 'likely' ? (
        <View style={s.inline}>
          <Wide label={LABEL_COPY.sizeIsRight} onPress={onConfirmSize} testID="hydroscan-label-size-ok" />
        </View>
      ) : null}
      <Text style={s.quiet}>{LABEL_COPY.nothingLogged}</Text>
      <View style={s.pair}>
        <View style={s.grow}>
          <Wide label={LABEL_COPY.thatsRight} primary onPress={onConfirm} testID="hydroscan-label-confirm" />
        </View>
        <Wide label={LABEL_COPY.scanAgain} onPress={onScanAgain} testID="hydroscan-label-again" />
      </View>
      <Wide label={LABEL_COPY.typeIt} onPress={onType} testID="hydroscan-label-type" />
    </View>
  );
}

/** The one short question. Nothing is chosen until the member taps. */
export function HydroScanLabelQuestion({
  text,
  choices,
  onChoose,
  onType,
  onScanAgain,
}: {
  text: string;
  choices: readonly { id: string; label: string }[];
  onChoose: (id: string) => void;
  onType: () => void;
  onScanAgain: () => void;
}) {
  return (
    <View testID="hydroscan-label-question">
      <View accessible accessibilityLiveRegion="assertive">
        <Text style={s.caption}>{LABEL_COPY.questionCaption}</Text>
        <Text accessibilityRole="header" style={s.title}>{text}</Text>
      </View>
      <View style={s.grid}>
        {choices.map((c) => (
          <Tile key={c.id} label={c.label} onPress={() => onChoose(c.id)} testID={`hydroscan-label-choice-${c.id}`} />
        ))}
      </View>
      <View style={s.pair}>
        <Wide label={LABEL_COPY.scanAgain} onPress={onScanAgain} testID="hydroscan-label-again" />
        <Wide label={LABEL_COPY.typeIt} onPress={onType} testID="hydroscan-label-type" />
      </View>
    </View>
  );
}

/** The grid of drink types, reachable at any time from the camera. */
export function HydroScanLabelTypeGrid({
  categories,
  onPick,
  onBack,
  onType,
}: {
  categories: readonly DrinkCategoryId[];
  onPick: (id: DrinkCategoryId) => void;
  onBack: () => void;
  onType: () => void;
}) {
  return (
    <View testID="hydroscan-label-typegrid">
      <Text accessibilityRole="header" style={s.title}>{LABEL_COPY.typeGridTitle}</Text>
      <Text style={s.body}>{LABEL_COPY.typeGridBody}</Text>
      <View style={s.grid}>
        {categories.map((id) => (
          <Tile key={id} label={DRINK_CATEGORIES[id].label} onPress={() => onPick(id)} testID={`hydroscan-label-type-${id}`} />
        ))}
      </View>
      <View style={s.pair}>
        <Wide label={LABEL_COPY.back} onPress={onBack} testID="hydroscan-label-type-back" />
        <Wide label={LABEL_COPY.typeIt} onPress={onType} testID="hydroscan-label-type" />
      </View>
    </View>
  );
}

/** A typed amount in fl oz. */
function CustomField({ value, onChange, valid, testID }: { value: string; onChange: (v: string) => void; valid: boolean; testID: string }) {
  return (
    <View style={s.custom}>
      <Text style={s.caption}>{LABEL_COPY.customLabel.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={LABEL_COPY.customLabel}
        keyboardType="decimal-pad"
        maxLength={6}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={af.textTertiary}
        style={s.input}
        testID={testID}
        value={value}
      />
      {value.length > 0 && !valid ? <Text style={s.body}>{CUSTOM_OZ_HINT}</Text> : null}
    </View>
  );
}

/** How much did you drink? Nothing is preselected; "Log it" is the only write. */
export function HydroScanLabelAmount({
  name,
  plan,
  selectedId,
  customText,
  customValid,
  busy,
  containerNote,
  onSelect,
  onCustomText,
  onLog,
  onBack,
}: {
  name: string;
  plan: AmountPlan;
  selectedId: string | null;
  customText: string;
  customValid: boolean;
  busy: boolean;
  containerNote: string | null;
  onSelect: (choice: AmountChoice) => void;
  onCustomText: (v: string) => void;
  onLog: () => void;
  onBack: () => void;
}) {
  const canLog = !busy && selectedId != null && (selectedId !== 'custom' || customValid);
  return (
    <View testID="hydroscan-label-amount">
      <Text style={s.caption}>{name.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={s.title}>{LABEL_COPY.amountTitle}</Text>
      {containerNote ? <Text style={s.body}>{containerNote}</Text> : null}
      <View style={s.grid}>
        {plan.choices.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={c.accessibilityLabel}
            accessibilityState={{ selected: selectedId === c.id, disabled: busy }}
            disabled={busy}
            onPress={() => onSelect(c)}
            style={[s.tile, plan.mode === 'fallback' && c.kind === 'preset' && s.tileSmall, selectedId === c.id && s.tileOn]}
            testID={`hydroscan-label-amount-${c.id}`}
          >
            <Text style={[s.tileText, selectedId === c.id && s.tileTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {selectedId === 'custom' ? <CustomField value={customText} onChange={onCustomText} valid={customValid} testID="hydroscan-label-amount-input" /> : null}
      <Text style={s.quiet}>{LABEL_COPY.amountNothingLogged}</Text>
      <View style={s.pair}>
        <View style={s.grow}>
          <Wide label={LABEL_COPY.logIt} primary onPress={onLog} disabled={!canLog} testID="hydroscan-label-log" />
        </View>
        <Wide label={LABEL_COPY.back} onPress={onBack} disabled={busy} testID="hydroscan-label-amount-back" />
      </View>
    </View>
  );
}

/** Change the container size: common sizes, a typed one, or "not sure". */
export function HydroScanLabelSizeEdit({
  sizes,
  customText,
  customValid,
  onPick,
  onCustomText,
  onCustomDone,
  onNotSure,
  onBack,
}: {
  sizes: readonly number[];
  customText: string;
  customValid: boolean;
  onPick: (oz: number) => void;
  onCustomText: (v: string) => void;
  onCustomDone: () => void;
  onNotSure: () => void;
  onBack: () => void;
}) {
  return (
    <View testID="hydroscan-label-sizeedit">
      <Text accessibilityRole="header" style={s.title}>{LABEL_COPY.sizeTitle}</Text>
      <View style={s.grid}>
        {sizes.map((oz) => (
          <Tile key={oz} label={formatOz(oz)} onPress={() => onPick(oz)} testID={`hydroscan-label-size-${oz}`} />
        ))}
        <Tile label={LABEL_COPY.sizeNotSure} onPress={onNotSure} testID="hydroscan-label-size-notsure" />
      </View>
      <CustomField value={customText} onChange={onCustomText} valid={customValid} testID="hydroscan-label-size-input" />
      <View style={s.pair}>
        <View style={s.grow}>
          <Wide label="Use this size" primary onPress={onCustomDone} disabled={!customValid} testID="hydroscan-label-size-use" />
        </View>
        <Wide label={LABEL_COPY.back} onPress={onBack} testID="hydroscan-label-size-back" />
      </View>
    </View>
  );
}

export function HydroScanLabelAlcoholUnavailable({ onScanAgain, onType }: { onScanAgain: () => void; onType: () => void }) {
  return (
    <View testID="hydroscan-label-alcohol">
      <View accessible accessibilityLiveRegion="assertive">
        <Text style={s.caption}>{LABEL_COPY.alcoholCaption}</Text>
        <Text accessibilityRole="header" style={s.title}>{LABEL_COPY.alcoholTitle}</Text>
        <Text style={s.body}>{LABEL_COPY.alcoholBody}</Text>
      </View>
      <View style={s.pair}>
        <View style={s.grow}>
          <Wide label={LABEL_COPY.scanAgain} primary onPress={onScanAgain} testID="hydroscan-label-again" />
        </View>
        <Wide label={LABEL_COPY.typeIt} onPress={onType} testID="hydroscan-label-type" />
      </View>
    </View>
  );
}

/** A save that did not land. Never worded as a save. */
export function HydroScanLabelSaveFailed({ busy, onRetry, onBack }: { busy: boolean; onRetry: () => void; onBack: () => void }) {
  return (
    <View testID="hydroscan-label-failed">
      <View accessible accessibilityLiveRegion="assertive">
        <Text style={s.caption}>{LABEL_COPY.failedCaption}</Text>
        <Text accessibilityRole="header" style={s.title}>{LABEL_COPY.failedTitle}</Text>
        <Text style={s.body}>{LABEL_COPY.failedBody}</Text>
      </View>
      <View style={s.pair}>
        <View style={s.grow}>
          <Wide label={LABEL_COPY.tryAgain} primary onPress={onRetry} disabled={busy} testID="hydroscan-label-retry" />
        </View>
        <Wide label={LABEL_COPY.back} onPress={onBack} disabled={busy} testID="hydroscan-label-failed-back" />
      </View>
    </View>
  );
}

/** Where the camera cannot run: permission off, or web. Typing stays available. */
export function HydroScanLabelCameraOff({ canAskAgain, onRequest, onType }: { canAskAgain: boolean; onRequest: () => void; onType: () => void }) {
  return (
    <View style={s.cameraOff} testID="hydroscan-label-camera-off">
      <Text style={s.caption}>{LABEL_COPY.cameraOffCaption}</Text>
      <Text style={s.body}>{LABEL_COPY.cameraOffBody}</Text>
      {canAskAgain ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Allow the camera" hitSlop={8} onPress={onRequest} style={s.cameraTarget} testID="hydroscan-label-allow-camera">
          <Text style={s.changeText}>{LABEL_COPY.allowCamera}</Text>
        </Pressable>
      ) : (
        <Text style={s.body}>{LABEL_COPY.cameraSettings}</Text>
      )}
      <View style={s.inline}>
        <Wide label={LABEL_COPY.typeIt} primary onPress={onType} testID="hydroscan-label-type" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caption: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: af.textTertiary },
  title: { marginTop: 10, fontFamily: 'Inter_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.3, color: af.textPrimary },
  body: { marginTop: 10, fontFamily: 'Inter_400Regular', fontSize: 14.5, lineHeight: 21, color: af.textSecondary },
  quiet: { marginTop: 14, marginBottom: 12, fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textSecondary },
  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.divider, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  tileSmall: { flexBasis: '30%' },
  tileOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  tileText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: af.textPrimary, textAlign: 'center' },
  tileTextOn: { color: af.onPrimaryFill },
  pair: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  grow: { flex: 1 },
  inline: { marginTop: 12 },
  wide: { minHeight: 54, borderRadius: 999, borderWidth: 1, borderColor: af.divider, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  widePrimary: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  wideText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  wideTextPrimary: { color: af.onPrimaryFill },
  off: { opacity: 0.45 },
  row: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1 },
  rowValue: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 16, color: af.textPrimary },
  rowNote: { marginTop: 2, fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: af.textTertiary },
  change: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  changeText: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.6, color: af.textPrimary },
  custom: { marginTop: 16 },
  input: { marginTop: 8, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.divider, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 16, color: af.textPrimary },
  cameraOff: { position: 'absolute', left: 24, right: 24, top: '24%' },
  cameraTarget: { marginTop: 18, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
