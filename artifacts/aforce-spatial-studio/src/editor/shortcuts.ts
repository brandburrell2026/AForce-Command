import { useEffect } from "react";

import { editor, getEditorState } from "./store";

const ROTATE_STEP = Math.PI / 12; // 15°

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Keyboard: W/E/R gizmo modes, S snap, Esc deselect, Delete remove, ⌘D
 * duplicate, ⌘Z / ⇧⌘Z undo and redo, arrows nudge 6 in (⇧ 1 ft), [ ] rotate 15°.
 */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const id = getEditorState().selectedId;

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (meta && key === "d") {
        if (id) {
          e.preventDefault();
          editor.duplicate(id);
        }
        return;
      }
      if (meta) return;

      const step = e.shiftKey ? 1 : 0.5;
      switch (e.key) {
        case "w":
        case "W":
          editor.setMode("translate");
          return;
        case "e":
        case "E":
          editor.setMode("rotate");
          return;
        case "r":
        case "R":
          editor.setMode("scale");
          return;
        case "s":
        case "S":
          editor.toggleSnap();
          return;
        case "Escape":
          editor.select(null);
          return;
        case "Backspace":
        case "Delete":
          if (id) {
            e.preventDefault();
            editor.remove(id);
          }
          return;
        case "ArrowLeft":
          if (id) {
            e.preventDefault();
            editor.nudge(id, -step, 0);
          }
          return;
        case "ArrowRight":
          if (id) {
            e.preventDefault();
            editor.nudge(id, step, 0);
          }
          return;
        case "ArrowUp":
          if (id) {
            e.preventDefault();
            editor.nudge(id, 0, -step);
          }
          return;
        case "ArrowDown":
          if (id) {
            e.preventDefault();
            editor.nudge(id, 0, step);
          }
          return;
        case "[":
          if (id) editor.rotateBy(id, ROTATE_STEP);
          return;
        case "]":
          if (id) editor.rotateBy(id, -ROTATE_STEP);
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
