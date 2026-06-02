/**
 * Sweat-sensor CSV / JSON import parser.
 *
 * Common columns we accept across hDrop, Nix, and Gatorade Gx exports.
 * The headers are best-effort — anything we don't recognize is dropped
 * silently and the row is still parsed if at least timestamp+sweat_loss
 * are present.
 *
 *   timestamp        ISO 8601 or unix-ms
 *   sweat_loss_ml    fluid lost in this interval
 *   sodium_mg        sodium lost in this interval
 *   potassium_mg     potassium lost in this interval (optional)
 *   notes            free text (optional, ignored)
 */

export type SensorSource = 'hdrop' | 'nix' | 'gatorade_gx';

export interface SensorRow {
  /** ISO 8601 timestamp. We re-emit normalized so the server doesn't have to guess. */
  timestamp: string;
  sweatLossMl: number;
  sodiumMg: number;
  potassiumMg?: number;
}

export interface SensorParseResult {
  rows: SensorRow[];
  /** Headers we recognised on this CSV — surfaced in the preview UI. */
  recognized: string[];
  /** Lines that failed to parse (1-indexed, header excluded). */
  skipped: number[];
}

const HEADER_ALIASES: Record<keyof SensorRow, string[]> = {
  timestamp:    ['timestamp', 'time', 'datetime', 'date', 'recorded_at'],
  sweatLossMl:  ['sweat_loss_ml', 'sweatlossml', 'sweat_ml', 'fluid_loss_ml', 'volume_ml'],
  sodiumMg:     ['sodium_mg', 'sodiummg', 'na_mg', 'sodium'],
  potassiumMg:  ['potassium_mg', 'potassiummg', 'k_mg', 'potassium'],
};

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function findColumn(headers: string[], aliases: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const a of aliases) {
    const idx = norm.indexOf(a);
    if (idx >= 0) return idx;
  }
  return -1;
}

// Plausible-data window for sensor imports: rejects 1970 epoch errors,
// far-past misreads, and clock-skewed future timestamps that would
// otherwise poison server-side `lastIntakeTime`.
const TS_MIN_MS = Date.UTC(2015, 0, 1);
const TS_MAX_MS = () => Date.now() + 24 * 60 * 60 * 1000; // +1 day grace

function inWindow(ms: number): boolean {
  return Number.isFinite(ms) && ms >= TS_MIN_MS && ms <= TS_MAX_MS();
}

function parseTimestamp(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Numeric: distinguish unix-seconds (10 digits) vs unix-ms (13 digits).
  // Anything else numeric is rejected — we will not silently coerce
  // a 12-digit sensor-quirk value into an arbitrary epoch.
  if (/^\d+$/.test(trimmed)) {
    let ms: number;
    if (trimmed.length === 10) ms = Number(trimmed) * 1000;
    else if (trimmed.length === 13) ms = Number(trimmed);
    else return null;
    return inWindow(ms) ? new Date(ms).toISOString() : null;
  }
  const d = new Date(trimmed);
  const ms = d.getTime();
  return inWindow(ms) ? d.toISOString() : null;
}

/**
 * Split a CSV line, supporting quoted fields with embedded commas.
 * Good enough for sensor exports (no embedded newlines).
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === ',') { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parse a CSV string into normalized SensorRows. */
export function parseSensorCsv(text: string): SensorParseResult {
  const result: SensorParseResult = { rows: [], recognized: [], skipped: [] };
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return result;

  const headers = splitCsvLine(lines[0]!);
  const idx = {
    timestamp:   findColumn(headers, HEADER_ALIASES.timestamp),
    sweatLossMl: findColumn(headers, HEADER_ALIASES.sweatLossMl),
    sodiumMg:    findColumn(headers, HEADER_ALIASES.sodiumMg),
    potassiumMg: findColumn(headers, HEADER_ALIASES.potassiumMg),
  };

  // Surface which headers we matched so the import UI can show "we
  // recognised: timestamp, sweat_loss_ml, sodium_mg" before commit.
  Object.entries(idx).forEach(([k, i]) => {
    if (i >= 0 && headers[i]) result.recognized.push(headers[i]!);
  });

  // Need timestamp + sweat_loss at minimum to import a row.
  if (idx.timestamp < 0 || idx.sweatLossMl < 0) return result;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const ts = parseTimestamp(cells[idx.timestamp] ?? '');
    const sweat = Number(cells[idx.sweatLossMl] ?? '');
    if (!ts || !Number.isFinite(sweat) || sweat < 0) {
      result.skipped.push(i);
      continue;
    }
    const sodium = idx.sodiumMg >= 0 ? Number(cells[idx.sodiumMg] ?? '0') : 0;
    const potassium = idx.potassiumMg >= 0 ? Number(cells[idx.potassiumMg] ?? '0') : 0;
    const row: SensorRow = {
      timestamp: ts,
      sweatLossMl: sweat,
      sodiumMg: Number.isFinite(sodium) ? sodium : 0,
    };
    if (Number.isFinite(potassium) && potassium > 0) row.potassiumMg = potassium;
    result.rows.push(row);
  }
  return result;
}

/**
 * Parse a JSON paste — accepts either an array of SensorRow or
 * `{ rows: SensorRow[] }`. Loosely typed because users paste from
 * many vendor tools.
 */
export function parseSensorJson(text: string): SensorParseResult {
  const result: SensorParseResult = { rows: [], recognized: [], skipped: [] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return result; }
  const arr = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown[] }).rows))
      ? (raw as { rows: unknown[] }).rows
      : [];
  arr.forEach((rawRow, i) => {
    if (!rawRow || typeof rawRow !== 'object') { result.skipped.push(i + 1); return; }
    const r = rawRow as Record<string, unknown>;
    const ts = parseTimestamp(String(r['timestamp'] ?? r['time'] ?? ''));
    const sweat = Number(r['sweatLossMl'] ?? r['sweat_loss_ml'] ?? 0);
    if (!ts || !Number.isFinite(sweat) || sweat < 0) { result.skipped.push(i + 1); return; }
    const sodium = Number(r['sodiumMg'] ?? r['sodium_mg'] ?? 0);
    const potassium = Number(r['potassiumMg'] ?? r['potassium_mg'] ?? 0);
    const row: SensorRow = {
      timestamp: ts,
      sweatLossMl: sweat,
      sodiumMg: Number.isFinite(sodium) ? sodium : 0,
    };
    if (Number.isFinite(potassium) && potassium > 0) row.potassiumMg = potassium;
    result.rows.push(row);
  });
  if (result.rows.length > 0) result.recognized.push('json');
  return result;
}

export const SENSOR_SOURCE_LABELS: Record<SensorSource, string> = {
  hdrop:        'hDrop sweat sensor',
  nix:          'Nix Hydration Biosensor',
  gatorade_gx:  'Gatorade Gx Sweat Patch',
};
