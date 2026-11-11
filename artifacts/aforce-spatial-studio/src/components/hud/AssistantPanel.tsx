import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { applyOps } from "@/ai/apply";
import { EditRequestError, requestEdit } from "@/ai/client";
import type { AssistantTurn } from "@/ai/types";
import { editor, useEditor } from "@/editor/store";

import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

const SUGGESTIONS = [
  "Move the hydration bar to the left wall and face it into the floor",
  "Make the Lock-In tunnel Berry Blue and brighter",
  "Add a second apparel gallery across from the first",
  "Give the whole scene a warmer key light and a satin floor",
  "Rotate the OS demo station to face the entrance",
  "Shrink the content studio to 4 by 4 and tuck it in the corner",
];

let turnCounter = 0;
const nextTurnId = () => `turn-${Date.now().toString(36)}-${(turnCounter += 1)}`;

/** Run one instruction: ask the server, apply the validated ops as one undo step, record the turn. */
export async function runInstruction(instruction: string): Promise<void> {
  const text = instruction.trim();
  if (!text) return;
  const { assistantBusy, doc, selectedId, assistantTurns } = editor.snapshot();
  if (assistantBusy) return;

  editor.assistantPush({ id: nextTurnId(), role: "user", text });
  editor.assistantSetBusy(true);
  try {
    const response = await requestEdit(doc, text, selectedId, assistantTurns);
    if (response.refused) {
      editor.assistantPush({ id: nextTurnId(), role: "assistant", text: response.summary, error: true });
      return;
    }
    // Apply against the live document, which may have moved while we waited.
    const result = applyOps(editor.snapshot().doc, response.ops);
    if (result.applied.length > 0) {
      editor.commitDocument(result.doc, result.selectId ?? undefined);
    }
    if (result.cameraPreset) editor.goToPreset(result.cameraPreset);
    editor.assistantPush({
      id: nextTurnId(),
      role: "assistant",
      text: response.summary,
      applied: result.applied,
      warnings: response.warnings,
      questions: response.questions,
    });
  } catch (err) {
    const message = err instanceof EditRequestError ? err.message : "Something went wrong. Try again.";
    editor.assistantPush({ id: nextTurnId(), role: "assistant", text: message, error: true });
  } finally {
    editor.assistantSetBusy(false);
  }
}

function Turn({ turn }: { turn: AssistantTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-signal pl-3">
        <Mono className="text-dim">You</Mono>
        <p className="m-0 text-[12px] leading-relaxed text-bone">{turn.text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-hairline pl-3">
      <Mono className="text-dim">Assistant</Mono>
      <p className={`m-0 text-[12px] leading-relaxed ${turn.error ? "text-signal" : "text-bone"}`}>{turn.text}</p>
      {turn.applied && turn.applied.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {turn.applied.map((line, i) => (
            <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-muted">
              <span className="text-signal">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {turn.questions && turn.questions.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {turn.questions.map((q, i) => (
            <li key={i} className="text-[12px] leading-relaxed text-bone">
              {q}
            </li>
          ))}
        </ul>
      ) : null}
      {turn.warnings && turn.warnings.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {turn.warnings.map((w, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-dim">
              Skipped: {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Natural-language edits. Each reply applies as one undo step. */
export function AssistantPanel() {
  const turns = useEditor((s) => s.assistantTurns);
  const busy = useEditor((s) => s.assistantBusy);
  const canUndo = useEditor((s) => s.past.length > 0);
  const selected = useEditor((s) => s.doc.fixtures.find((f) => f.id === s.selectedId) ?? null);
  const focusRequest = useEditor((s) => s.inspectorTabRequest);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest?.tab === "ai") inputRef.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, busy]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void runInstruction(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader
        right={
          turns.length > 0 ? (
            <button
              type="button"
              onClick={() => editor.assistantClear()}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal"
            >
              Clear
            </button>
          ) : undefined
        }
      >
        AI edits · ⌘K
      </PanelHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {turns.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[12px] leading-relaxed text-muted">
              Describe a change in plain language. The assistant edits the layout, sizes, colors,
              lighting and images, and every reply lands as one undo step.
            </p>
            <div className="flex flex-col gap-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void runInstruction(s)}
                  disabled={busy}
                  className="border border-hairline px-2 py-1.5 text-left text-[11px] leading-snug text-muted transition-colors hover:border-muted hover:text-bone disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => <Turn key={turn.id} turn={turn} />)
        )}
        {busy ? <Mono className="text-signal">Thinking…</Mono> : null}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline p-3">
        {selected ? <Mono className="text-dim">Selected: {selected.label}</Mono> : null}
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={selected ? `Tell me what to do with ${selected.label}…` : "Tell me what to change…"}
          className="w-full resize-none border border-hairline bg-ink/70 px-2 py-1.5 font-sans text-[12px] leading-snug text-bone outline-none placeholder:text-dim focus:border-signal"
        />
        <div className="flex items-center justify-between">
          <ToolButton onClick={() => editor.undo()} disabled={!canUndo} hint="⌘Z">
            Undo last
          </ToolButton>
          <ToolButton onClick={send} disabled={busy || !draft.trim()} hint="↵">
            {busy ? "Working…" : "Apply"}
          </ToolButton>
        </div>
      </div>
    </Panel>
  );
}
