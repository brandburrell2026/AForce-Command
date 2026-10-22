import { formatBytes } from "./assets";
import { downloadBlob, slugify } from "./download";
import { exportGLB } from "./gltf";
import { renderContactSheet, renderStill } from "./render";
import { editor } from "./store";

/** Render and export actions shared by the Export tab and the keyboard shortcuts. */

export async function runRender(kind: "still" | "sheet"): Promise<void> {
  const { renderSettings: settings, doc, exportBusy } = editor.snapshot();
  if (exportBusy) return;
  const label = kind === "still" ? `${settings.width} × ${settings.height}` : "contact sheet";
  editor.setExportStatus(`Rendering ${label}…`, true);
  // Let the status paint before the renderer blocks the main thread.
  await new Promise((r) => window.setTimeout(r, 30));
  try {
    const blob = kind === "still" ? await renderStill(settings) : await renderContactSheet(settings);
    if (!blob) {
      editor.setExportStatus("Render failed: the scene is not ready.");
      return;
    }
    const ext = kind === "still" ? settings.format : "png";
    const name = kind === "still" ? `${slugify(doc.name)}-${settings.width}x${settings.height}.${ext}` : `${slugify(doc.name)}-views.png`;
    downloadBlob(blob, name);
    editor.setExportStatus(`Saved ${name} · ${formatBytes(blob.size)}`);
  } catch (err) {
    editor.setExportStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function runGlbExport(includeLights: boolean): Promise<void> {
  const { doc, exportBusy } = editor.snapshot();
  if (exportBusy) return;
  editor.setExportStatus("Building GLB…", true);
  await new Promise((r) => window.setTimeout(r, 30));
  try {
    const blob = await exportGLB({ includeLights });
    if (!blob) {
      editor.setExportStatus("Export failed: the scene is not ready.");
      return;
    }
    const name = `${slugify(doc.name)}.glb`;
    downloadBlob(blob, name);
    editor.setExportStatus(`Saved ${name} · ${formatBytes(blob.size)} · meters`);
  } catch (err) {
    editor.setExportStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
