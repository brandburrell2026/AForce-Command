import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { formatBytes } from "@/editor/assets";
import { storageEstimate, type ProjectMeta } from "@/editor/db";
import {
  deleteProject,
  exportProjectFile,
  importProjectFile,
  listProjects,
  moveProjectToAccount,
  newProject,
  openProject,
  saveProject,
} from "@/editor/projects";
import type { ProjectSource } from "@/editor/remote";
import { editor, useEditor } from "@/editor/store";

import { TextField } from "./fields";
import { formatAgo } from "./time";
import { Mono, ToolButton } from "./ui";

/**
 * Save, open, fork, delete, import and export projects. Lists the active
 * source (account or this browser) and, in account mode, any projects still
 * in this browser with a one-click move. Opens from the project bar or ⌘O;
 * Esc or the backdrop closes it.
 */
export function ProjectsDialog() {
  const name = useEditor((s) => s.doc.name);
  const projectId = useEditor((s) => s.projectId);
  const savedAt = useEditor((s) => s.savedAt);
  const saving = useEditor((s) => s.saving);
  const saveError = useEditor((s) => s.saveError);
  const dirty = useEditor((s) => s.doc !== s.lastSavedDoc);
  const autosave = useEditor((s) => s.autosave);
  const source = useEditor((s) => s.projectSource);
  const accountNote = useEditor((s) => s.accountNote);

  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [localProjects, setLocalProjects] = useState<ProjectMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [copyName, setCopyName] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeSource: ProjectSource = source === "account" ? "account" : "local";

  const refresh = async () => {
    try {
      setProjects(await listProjects(activeSource));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
    if (activeSource === "account") {
      try {
        setLocalProjects(await listProjects("local"));
      } catch {
        setLocalProjects([]);
      }
    } else {
      setLocalProjects([]);
    }
    setStorage(await storageEstimate());
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt, projectId, activeSource]);

  const close = () => editor.setProjectsOpen(false);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importProjectFile(file);
      setNotice(`Imported ${file.name}. Save to keep it.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const onDelete = async (id: string, from: ProjectSource) => {
    const key = `${from}:${id}`;
    if (confirmDelete !== key) {
      setConfirmDelete(key);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteProject(id, from);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
    await refresh();
  };

  const onMove = async (id: string) => {
    setMoving(id);
    try {
      await moveProjectToAccount(id);
      setNotice("Moved to your account.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(null);
      await refresh();
    }
  };

  const onOpen = async (id: string, from: ProjectSource) => {
    try {
      await openProject(id, from);
      editor.clearSaveError();
      close();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const sourceLine =
    source === "account"
      ? "Projects are stored in your account and follow you across browsers."
      : source === "local"
        ? `Projects are stored in this browser only. ${accountNote ?? ""}`.trim()
        : "Checking where projects live…";

  const renderRow = (p: ProjectMeta, from: ProjectSource) => {
    const current = p.id === projectId && from === activeSource;
    const key = `${from}:${p.id}`;
    return (
      <li key={key} className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
        <div className="h-14 w-24 shrink-0 overflow-hidden border border-hairline bg-[#070707]">
          {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Mono className="truncate">{p.name}</Mono>
            {current ? <Mono className="text-signal">open</Mono> : null}
          </div>
          <Mono className="text-dim">
            {p.fixtureCount} fixture{p.fixtureCount === 1 ? "" : "s"} · {p.assetCount} image
            {p.assetCount === 1 ? "" : "s"} · {formatBytes(p.bytes)} · saved {formatAgo(p.updatedAt)}
          </Mono>
        </div>
        <div className="flex items-center gap-1">
          {from === "local" && activeSource === "account" ? (
            <ToolButton onClick={() => void onMove(p.id)} disabled={moving !== null}>
              {moving === p.id ? "Moving…" : "Move to account"}
            </ToolButton>
          ) : null}
          {!current ? <ToolButton onClick={() => void onOpen(p.id, from)}>Open</ToolButton> : null}
          <ToolButton onClick={() => void onDelete(p.id, from)} tone="danger" active={confirmDelete === key}>
            {confirmDelete === key ? "Confirm delete" : "Delete"}
          </ToolButton>
        </div>
      </li>
    );
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-6"
      onClick={close}
    >
      <div
        className="flex max-h-full w-[720px] max-w-full flex-col border border-hairline bg-ink/95 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <Mono>Projects</Mono>
          <div className="flex items-center gap-4">
            {storage && activeSource === "local" ? (
              <Mono className="text-dim">
                {formatBytes(storage.usage)} used{storage.quota ? ` of ${formatBytes(storage.quota)}` : ""}
              </Mono>
            ) : null}
            <button type="button" onClick={close} className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim hover:text-bone">
              Close · Esc
            </button>
          </div>
        </div>

        {/* Current document */}
        <div className="grid gap-4 border-b border-hairline p-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-3">
            <TextField label="Current project" value={name} onCommit={(v) => editor.setDocName(v)} />
            <Mono className="text-dim">
              {projectId
                ? `${dirty ? "Unsaved changes" : "Saved"}${savedAt ? ` · last write ${formatAgo(savedAt)}` : ""}`
                : "Not saved yet."}
            </Mono>
            {saveError ? <Mono className="text-signal">{saveError}</Mono> : null}
            <Mono className={source === "account" ? "text-muted" : "text-dim"}>{sourceLine}</Mono>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autosave} onChange={(e) => editor.setAutosave(e.target.checked)} className="accent-signal" />
              <Mono className="text-muted">Autosave 1.5 s after each change</Mono>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <ToolButton onClick={() => void saveProject()} hint="⌘S" disabled={saving}>
              {projectId ? "Save" : "Save project"}
            </ToolButton>
            <div className="flex gap-1">
              <input
                type="text"
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                placeholder={`${name} copy`}
                className="h-8 w-40 border border-hairline bg-ink/70 px-2 font-mono text-[12px] text-bone outline-none placeholder:text-dim focus:border-signal"
              />
              <ToolButton
                onClick={() => {
                  void saveProject({ asNew: true, name: copyName.trim() || `${name} copy` });
                  setCopyName("");
                }}
                disabled={saving}
              >
                Save as copy
              </ToolButton>
            </div>
            <ToolButton onClick={() => exportProjectFile()}>Export JSON</ToolButton>
          </div>
        </div>

        {/* Saved projects */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-hairline px-4 py-2">
            <Mono className="text-muted">{activeSource === "account" ? "In your account" : "In this browser"}</Mono>
          </div>
          {loadError ? (
            <div className="p-4">
              <Mono className="text-signal">{loadError}</Mono>
            </div>
          ) : projects === null ? (
            <div className="p-4">
              <Mono className="text-dim">Loading…</Mono>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-4">
              <p className="m-0 text-[12px] leading-relaxed text-muted">
                No saved projects here yet. Save the current activation, or import a `.aforce.json` file.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">{projects.map((p) => renderRow(p, activeSource))}</ul>
          )}

          {activeSource === "account" && localProjects.length > 0 ? (
            <>
              <div className="border-y border-hairline px-4 py-2">
                <Mono className="text-muted">Still in this browser · move them to keep them with your account</Mono>
              </div>
              <ul className="m-0 list-none p-0">{localProjects.map((p) => renderRow(p, "local"))}</ul>
            </>
          ) : null}
        </div>

        {/* New and import */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
          <div className="flex flex-wrap gap-1">
            <ToolButton
              onClick={() => {
                newProject("activation");
                close();
              }}
            >
              New from AForce template
            </ToolButton>
            <ToolButton
              onClick={() => {
                newProject("empty");
                close();
              }}
            >
              New empty floor
            </ToolButton>
            <ToolButton onClick={() => fileInput.current?.click()}>Import JSON</ToolButton>
            <input ref={fileInput} type="file" accept="application/json,.json" onChange={(e) => void onImport(e)} className="hidden" />
          </div>
          {notice ? <Mono className="text-muted">{notice}</Mono> : null}
        </div>
      </div>
    </div>
  );
}
