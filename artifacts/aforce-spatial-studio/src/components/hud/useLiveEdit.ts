import { useCallback, useEffect, useRef } from "react";

import { editor } from "@/editor/store";

/**
 * Turn a stream of live values (a slider or color drag) into one undo
 * step: beginEdit on the first value, apply each one, endEdit after the
 * stream goes quiet.
 */
export function useLiveEdit<T>(apply: (value: T) => void, quietMs = 400): (value: T) => void {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const timer = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (active.current) {
        active.current = false;
        editor.endEdit();
      }
    },
    [],
  );

  return useCallback(
    (value: T) => {
      if (!active.current) {
        active.current = true;
        editor.beginEdit();
      }
      applyRef.current(value);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        active.current = false;
        editor.endEdit();
      }, quietMs);
    },
    [quietMs],
  );
}
