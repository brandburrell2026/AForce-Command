import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { formatBytes, importImageFile } from "@/editor/assets";
import { editor, useEditor } from "@/editor/store";
import { FIXTURE_SLOTS, type Asset, type AssetKind } from "@/scene/model";

import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

const KIND_LABEL: Record<AssetKind, string> = {
  logo: "Logo",
  texture: "Texture",
  product: "Product",
};

function inferKind(file: File): AssetKind {
  return file.type === "image/png" || file.type === "image/svg+xml" ? "logo" : "texture";
}

/** Upload logos, textures and product images; apply them in one click. */
export function AssetsPanel() {
  const assets = useEditor((s) => s.doc.assets);
  const style = useEditor((s) => s.doc.style);
  const selected = useEditor((s) => s.doc.fixtures.find((f) => f.id === s.selectedId) ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<AssetKind>("logo");

  const importFiles = async (files: FileList | File[], kind: AssetKind | null) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setStatus(`Importing ${list.length} image${list.length === 1 ? "" : "s"}…`);
    const imported: Asset[] = [];
    const errors: string[] = [];
    for (const file of list) {
      try {
        imported.push(await importImageFile(file, kind ?? inferKind(file)));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    editor.addAssets(imported);
    setBusy(false);
    setStatus(
      errors.length > 0
        ? errors.join(" ")
        : `Added ${imported.length} ${imported.length === 1 ? "image" : "images"}.`,
    );
  };

  const pick = (kind: AssetKind) => {
    pendingKind.current = kind;
    inputRef.current?.click();
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void importFiles(e.target.files, pendingKind.current);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    void importFiles(e.dataTransfer.files, null);
  };

  /** The one-click "use" action that makes sense for this asset right now. */
  const actionFor = (asset: Asset): { label: string; run: () => void } | null => {
    if (asset.kind === "logo") {
      if (style.brandLogoId === asset.id) return null;
      return { label: "Set as brand logo", run: () => editor.setStyle({ brandLogoId: asset.id }) };
    }
    if (asset.kind === "texture") {
      if (selected) {
        return {
          label: `Texture ${selected.label}`,
          run: () => editor.update(selected.id, { slots: { ...selected.slots, texture: asset.id } }),
        };
      }
      if (style.floorTextureId === asset.id) return null;
      return { label: "Use on floor", run: () => editor.setStyle({ floorTextureId: asset.id }) };
    }
    if (selected) {
      const slot = FIXTURE_SLOTS[selected.kind].find((s) => s.accepts === "product");
      if (slot) {
        return {
          label: `${slot.label}`,
          run: () => editor.update(selected.id, { slots: { ...selected.slots, [slot.key]: asset.id } }),
        };
      }
    }
    return null;
  };

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader right={<Mono className="text-dim">{assets.length}</Mono>}>Assets</PanelHeader>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-0 flex-col ${dragOver ? "bg-signal/10" : ""}`}
      >
        <div className="flex flex-col gap-2 border-b border-hairline p-3">
          <Mono className="text-dim">Upload · PNG, JPG, WebP, SVG · up to 8 MB</Mono>
          <div className="flex gap-1">
            <ToolButton onClick={() => pick("logo")} disabled={busy}>Logo</ToolButton>
            <ToolButton onClick={() => pick("texture")} disabled={busy}>Texture</ToolButton>
            <ToolButton onClick={() => pick("product")} disabled={busy}>Product</ToolButton>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInput} className="hidden" />
          <Mono className="text-dim">Or drop files here. PNG and SVG land as logos, the rest as textures.</Mono>
          {status ? <Mono className={busy ? "text-muted" : "text-bone"}>{status}</Mono> : null}
        </div>

        <ul className="m-0 min-h-0 list-none overflow-y-auto p-0">
          {assets.map((asset) => {
            const action = actionFor(asset);
            const inUse =
              style.brandLogoId === asset.id ||
              style.floorTextureId === asset.id ||
              style.wallTextureId === asset.id;
            return (
              <li key={asset.id} className="flex items-center gap-3 border-b border-hairline px-3 py-2 last:border-b-0">
                <img
                  src={asset.dataUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 border border-hairline object-contain"
                  style={{ background: asset.kind === "logo" ? "#2D2A25" : "#0D0D0D" }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Mono className="truncate">{asset.name}</Mono>
                  <Mono className="text-dim">
                    {KIND_LABEL[asset.kind]} · {asset.width}×{asset.height} · {formatBytes(asset.bytes)}
                    {inUse ? " · in use" : ""}
                  </Mono>
                  {action ? (
                    <button type="button" onClick={action.run} className="mt-1 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-signal hover:text-bone">
                      {action.label}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => editor.removeAsset(asset.id)}
                  title="Remove asset"
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal"
                >
                  Remove
                </button>
              </li>
            );
          })}
          {assets.length === 0 ? (
            <li className="px-3 py-4">
              <p className="m-0 text-[12px] leading-relaxed text-muted">
                No images yet. Upload a logo to brand every fixture at once, a texture for floors, walls
                or a fixture surface, or product shots for the bar niches and the OS totem.
              </p>
            </li>
          ) : null}
        </ul>
      </div>
    </Panel>
  );
}
