import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { Mono } from "./ui";

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
