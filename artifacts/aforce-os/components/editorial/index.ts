/**
 * AForce Editorial OS — foundation barrel (E1).
 *
 * ISOLATION RULE (locked by editorialFoundation.test.ts): no production
 * surface imports from components/editorial until its own E-step PR is
 * accepted. The only consumer in E1 is the dev/demo reference sheet at
 * app/(hidden)/editorial-sheet.tsx.
 */
export {
  EdSurface,
  EdRule,
  EdMasthead,
  EdFolio,
  EdEyebrow,
  EdKicker,
  EdStatement,
  EdAccent,
  EdStateWord,
  EdNumber,
  EdCommandBlock,
  EdCaption,
  EdEvidenceLine,
  EdStockContext,
  useEdStock,
  useEdInk,
} from './core';
export {
  EdPressureField,
  EdNodeSpine,
  EdSpineRow,
  EdSpineNode,
  EdStockTurn,
  useEdSettle,
  useReduceMotion,
  type EdNodeState,
} from './instruments';
export { edNumberDisplay, splitMirrorWord, edFolioIndex } from './editorialLogic';
