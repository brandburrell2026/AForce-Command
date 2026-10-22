import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { formatBytes } from "@/editor/assets";
import { listProjects, storageEstimate, type ProjectMeta } from "@/editor/db";
import {
  deleteProject,
  exportProjectFile,
  importProjectFile,
  newProject,
  openProject,
  saveProject,
} from "@/editor/projects";
import { editor, useEditor } from "@/editor/store";

import { TextField } from "./fields";
import { formatAgo } from "./time";
import { Mono, ToolButton } from "./ui";

/**
 * Save, open, fork, delete, import and export projects. Opens from the
 * project bar or ⌘O; Esc or the backdrop closes it.
 */
export function ProjectsDialog() {
  const name = useEditor((s) => s.doc.name);
  const projectId = useEditor((s) => s.projectId);
  const savedAt = useEditor((s) => s.savedAt);
  const saving = useEditor((s) => s.saving);
  const dirty = useEditor((s) => s.doc !== s.lastSavedDoc);
  const autosave = useEditor((s) => s.autosave);

  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [copyName, setCopyName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      setProjects(await listProjects());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
    setStorage(await storageEstimate());
  };

  useEffect(() => {
    void refresh();
  }, [savedAt, projectId]);

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

  const onDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    await deleteProject(id);
    await refresh();
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
            {storage ? (
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
                : "Not saved yet. Saving stores it in this browser."}
            </Mono>
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
                No saved projects in this browser yet. Save the current activation, or import a
                `.aforce.json` file.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {projects.map((p) => {
                const current = p.id === projectId;
                return (
                  <li key={p.id} className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
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
                      {!current ? (
                        <ToolButton
                          onClick={() => {
                            void openProject(p.id).then(() => close());
                          }}
                        >
                          Open
                        </ToolButton>
                      ) : null}
                      <ToolButton onClick={() => void onDelete(p.id)} tone="danger" active={confirmDelete === p.id}>
                        {confirmDelete === p.id ? "Confirm delete" : "Delete"}
                      </ToolButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
          {notice ? <Mono className="text-muted">{notice}</Mono> : <Mono className="text-dim">Projects live in this browser's storage until section 5b moves them to your account.</Mono>}
        </div>
      </div>
    </div>
  );
}
