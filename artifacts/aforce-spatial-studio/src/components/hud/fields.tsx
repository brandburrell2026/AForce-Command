import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { Mono } from "./ui";
import { useLiveEdit } from "./useLiveEdit";

const inputClass =
  "h-8 w-full border border-hairline bg-ink/70 px-2 font-mono text-[12px] text-bone outline-none focus:border-signal";

/**
 * Numeric input that commits on Enter or blur and steps with the arrow
 * keys. Re-syncs from the store whenever it is not focused, so gizmo drags
 * show live without fighting the user's typing.
 */
export function NumberField({
  label,
  value,
  onCommit,
  step = 0.5,
  min,
  max,
  unit,
  decimals = 2,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
}) {
  const format = (v: number) => String(Number(v.toFixed(decimals)));
  const [text, setText] = useState(format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/[^0-9.+-]/g, ""));
    if (Number.isFinite(parsed)) {
      const next = clamp(parsed);
      if (next !== value) onCommit(next);
      setText(format(next));
    } else {
      setText(format(value));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit(text);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setText(format(value));
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const next = clamp(value + dir * step * (e.shiftKey ? 2 : 1));
      onCommit(next);
      setText(format(next));
    }
  };

  return (
    <label className="flex flex-col gap-1">
      <Mono className="text-dim">
        {label}
        {unit ? ` · ${unit}` : ""}
      </Mono>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onKeyDown={onKeyDown}
        className={inputClass}
      />
    </label>
  );
}

/** Text input that commits on Enter or blur, so each edit is one undo step. */
export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  const commit = () => {
    const next = text.trim();
    if (next && next !== value) onCommit(next);
    else setText(value);
  };

  const shared = {
    value: text,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      commit();
    },
  };

  return (
    <label className="flex flex-col gap-1">
      <Mono className="text-dim">{label}</Mono>
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          className={`${inputClass} h-auto resize-none py-1.5 font-sans text-[12px] leading-snug`}
        />
      ) : (
        <input
          {...shared}
          type="text"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(value);
              e.currentTarget.blur();
            }
          }}
          className={inputClass}
        />
      )}
    </label>
  );
}

// ---- Style controls --------------------------------------------------------

function normalizeHex(raw: string): string | null {
  const t = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(t)) {
    const [r, g, b] = t.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

/**
 * Color swatch plus hex. Dragging the picker streams live values into one
 * undo step; typing a hex commits on Enter or blur.
 */
export function ColorField({
  label,
  value,
  onLive,
  onCommit,
  inherited = false,
  onReset,
}: {
  label: string;
  value: string;
  onLive: (hex: string) => void;
  onCommit: (hex: string) => void;
  inherited?: boolean;
  onReset?: () => void;
}) {
  const live = useLiveEdit(onLive);
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  const commitText = () => {
    const hex = normalizeHex(text);
    if (hex && hex !== value.toUpperCase()) onCommit(hex);
    else setText(value);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Mono className="text-dim">{label}</Mono>
        {inherited ? (
          <Mono className="text-dim">scene</Mono>
        ) : onReset ? (
          <button type="button" onClick={onReset} className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal">
            Reset
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => live(e.target.value.toUpperCase())}
          className="h-8 w-10 shrink-0 cursor-pointer border border-hairline bg-ink/70 p-0.5"
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitText();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(value);
              e.currentTarget.blur();
            }
          }}
          className={inputClass}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/** Slider that streams live values into one undo step. */
export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onLive,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onLive: (value: number) => void;
  format?: (value: number) => string;
}) {
  const live = useLiveEdit(onLive);
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Mono className="text-dim">{label}</Mono>
        <Mono className="text-muted">{format ? format(value) : value.toFixed(2)}</Mono>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => live(Number(e.target.value))}
        className="w-full accent-signal"
      />
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Mono className="text-dim">{label}</Mono>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer border border-hairline bg-ink/70 px-2 font-mono text-[12px] text-bone outline-none focus:border-signal"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
