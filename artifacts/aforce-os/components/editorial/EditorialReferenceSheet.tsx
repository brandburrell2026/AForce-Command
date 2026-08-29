/**
 * EditorialReferenceSheet — the deterministic E1 acceptance sheet
 * (dev/demo only; reached solely through app/(hidden)/editorial-sheet.tsx).
 *
 * Every string on this sheet is a labeled SPECIMEN — nothing reads product
 * state, so the sheet renders identically on every launch and screenshots
 * are reproducible. The command specimen mirrors the canonical
 * RecoveryCommand presentation format; its evidence line says SPECIMEN so
 * it can never be mistaken for a live instruction.
 */
import React from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { edType } from '@/theme/editorialTokens';

import {
  EdAccent,
  EdCaption,
  EdCommandBlock,
  EdEvidenceLine,
  EdEyebrow,
  EdFolio,
  EdKicker,
  EdMasthead,
  EdNodeSpine,
  EdNumber,
  EdPressureField,
  EdRule,
  EdSpineRow,
  EdStatement,
  EdStateWord,
  EdStockTurn,
  EdSurface,
  useEdInk,
  useEdSettle,
} from './index';

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 34, marginBottom: 14 }}>
      <EdCaption text={text} />
      <EdRule style={{ marginTop: 10, marginBottom: 0 }} />
    </View>
  );
}

function TypeRow({ label, children }: { label: string; children: React.ReactNode }) {
  const ink = useEdInk();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[edType.micro, { color: ink.quiet, marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}

export function EditorialReferenceSheet() {
  const insets = useSafeAreaInsets();
  const settle = useEdSettle();
  return (
    <EdSurface stock="black" style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
      >
        <Animated.View style={settle}>
          <EdMasthead left="AFORCE EDITORIAL OS · E1" right="REFERENCE" />
        </Animated.View>

        <SectionLabel text="01 · TYPE ROLES — CINEMATIC BLACK" />
        <TypeRow label="DISPLAY 44 · INTER 700 · SENTENCE CASE">
          <EdStatement role="display">
            The body keeps the <EdAccent>score</EdAccent>.
          </EdStatement>
        </TypeRow>
        <TypeRow label="STATEMENT 28">
          <EdStatement>Tonight decides tomorrow.</EdStatement>
        </TypeRow>
        <TypeRow label="COMMAND 22">
          <EdStatement role="command">Specimen command line.</EdStatement>
        </TypeRow>
        <TypeRow label="CONFIRM 18">
          <EdStatement role="confirm">I'm ready.</EdStatement>
        </TypeRow>
        <TypeRow label="BODY 16 / BODY SMALL 14">
          <BodySpecimen />
        </TypeRow>
        <TypeRow label="CAPTION 11 · MONO · TRACKED">
          <EdCaption text="HYDROSTATE · OBSERVED 07:41" />
        </TypeRow>
        <TypeRow label="MICRO 9 · MONO · FLOOR OF THE SYSTEM">
          <EdEvidenceLine parts={['SOURCE SCAN', 'CONFIDENCE HIGH', 'SPECIMEN']} />
        </TypeRow>

        <SectionLabel text="02 · EDITORIAL NUMBER" />
        <View style={{ flexDirection: 'row', columnGap: 40, flexWrap: 'wrap', rowGap: 24 }}>
          <EdNumber value={69} role="numberHero" caption="HYDROSTATE" />
          <EdNumber value={12} unit="OZ" role="numberFeature" caption="FEATURE STAT" />
          <EdNumber value={null} role="numberFeature" caption="NO READING — TRUTHFUL NEUTRAL" />
        </View>

        <SectionLabel text="03 · COMMAND PRESENTATION" />
        <EdCommandBlock
          kicker="Your command"
          command="Drink 12 oz now."
          evidence="RECOVERYCOMMAND FORMAT · SPECIMEN — NOT A LIVE INSTRUCTION"
        />

        <SectionLabel text="04 · FURNITURE — EYEBROWS · KICKER · STATE WORDS" />
        <View style={{ rowGap: 12 }}>
          <EdEyebrow label="LIVE SIGNAL" tone="red" />
          <EdEyebrow label="LOCKED IN" tone="lockIn" />
          <EdEyebrow label="NEUTRAL FURNITURE" />
          <EdKicker text="The kicker leads with the em-rule." />
          <View style={{ flexDirection: 'row', columnGap: 24, flexWrap: 'wrap' }}>
            <EdStateWord word="RECOVERING" />
            <EdStateWord word="IN COMMAND" />
            <EdStateWord word="READY" />
          </View>
        </View>

        <SectionLabel text="05 · NODE SPINE" />
        <EdNodeSpine>
          <EdSpineRow state="done">
            <EdCaption text="07:00 · MORNING SCAN" />
            <SpineBody text="Completed. Baseline observed." />
          </EdSpineRow>
          <EdSpineRow state="live">
            <EdCaption text="NOW · MIDDAY WINDOW" />
            <SpineBody text="Live. The open moment on the spine." />
          </EdSpineRow>
          <EdSpineRow state="next">
            <EdCaption text="18:30 · EVENING" />
            <SpineBody text="Ahead. Hollow node until it arrives." />
          </EdSpineRow>
        </EdNodeSpine>

        <SectionLabel text="06 · PRESSURE FIELD" />
        <View style={{ alignItems: 'center' }}>
          <EdPressureField size={260} intensity={0.7}>
            <EdNumber value={69} role="numberHero" caption="HYDROSTATE" />
          </EdPressureField>
        </View>

        <SectionLabel text="07 · STOCK TURN — PAPER WITHIN BLACK" />
        <EdStockTurn>
          <EdEyebrow label="FEATURE REGISTER" tone="red" />
          <EdStatement style={{ marginTop: 10 }}>
            Paper is the <EdAccent>Feature</EdAccent> stock.
          </EdStatement>
          <EdKicker text="Weekly report, share moments, editorial reading." />
          <EdRule />
          <EdCaption text="INKS RESOLVE FROM THE STOCK — SAME PRIMITIVES, PAPER VOICE" />
        </EdStockTurn>

        <SectionLabel text="08 · FULL PAPER SURFACE" />
        <EdSurface stock="paper" style={{ padding: 20 }}>
          <EdMasthead left="AFORCE · WEEKLY" right="NO. 34" />
          <EdStatement style={{ marginTop: 16 }}>
            A week held in <EdAccent>command</EdAccent>.
          </EdStatement>
          <View style={{ marginTop: 16 }}>
            <EdNumber value={5} role="numberFeature" caption="PEAK DAYS" />
          </View>
          <View style={{ marginTop: 16 }}>
            <EdFolio index={2} total={7} label="HYDRATION IS A SYSTEM" />
          </View>
        </EdSurface>

        <View style={{ marginTop: 34 }}>
          <EdFolio index={1} total={1} label="E1 FOUNDATION · SPECIMEN SHEET" />
        </View>
      </ScrollView>
    </EdSurface>
  );
}

function BodySpecimen() {
  const ink = useEdInk();
  return (
    <View style={{ rowGap: 6 }}>
      <Text style={[edType.body, { color: ink.primary }]}>
        Body copy reads at sixteen over twenty-five, in the ink of its stock.
      </Text>
      <Text style={[edType.bodySmall, { color: ink.quiet }]}>
        Quiet small body carries explanations without competing with the statement.
      </Text>
    </View>
  );
}

function SpineBody({ text }: { text: string }) {
  const ink = useEdInk();
  return <Text style={[edType.bodySmall, { color: ink.primary, marginTop: 4 }]}>{text}</Text>;
}
