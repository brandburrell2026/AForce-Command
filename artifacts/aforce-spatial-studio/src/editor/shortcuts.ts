import { useEffect } from "react";

import { CAMERA_PRESETS } from "./camera";
import { saveProject } from "./projects";
import { editor, getEditorState } from "./store";

const ROTATE_STEP = Math.PI / 12; // 15°

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Keyboard: W/E/R gizmo modes, S snap, Esc deselect, Delete remove, ⌘D
 * duplicate, ⌘Z / ⇧⌘Z undo and redo, arrows nudge 6 in (⇧ 1 ft), [ ] rotate 15°,
 * F frame selection, O 360° turntable, V walkthrough, 1–7 camera presets,
 * ⌘S save, ⇧⌘S save as copy, ⌘O projects dialog.
 * In walk mode the walk rig owns the keyboard; only Esc (exit) is handled here.
 */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const snapshot = getEditorState();
      const metaKey = e.metaKey || e.ctrlKey;
      // Project shortcuts work even while typing in a field.
      if (metaKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (e.shiftKey) void saveProject({ asNew: true, name: `${snapshot.doc.name} copy` });
        else void saveProject();
        return;
      }
      if (metaKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        editor.setProjectsOpen(!snapshot.projectsOpen);
        return;
      }
      if (snapshot.projectsOpen) {
        if (e.key === "Escape") editor.setProjectsOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (snapshot.cameraMode === "walk") {
        // Pointer lock swallows the first Esc; a second one leaves walk mode.
        if (e.key === "Escape" && !snapshot.walkLocked) editor.exitWalk();
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const id = snapshot.selectedId;

      if (!meta && e.key >= "1" && e.key <= "7") {
        const preset = CAMERA_PRESETS[Number(e.key) - 1];
        if (preset) editor.goToPreset(preset.id);
        return;
      }

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
        case "f":
        case "F":
          editor.frameSelection();
          return;
        case "o":
        case "O":
          editor.toggleAutoOrbit();
          return;
        case "v":
        case "V":
          editor.enterWalk();
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
