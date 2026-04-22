/**
 * AForce OS Shopping Cart store.
 *
 * Lightweight Context + reducer holding cart line items keyed by SKU id.
 * Persists to AsyncStorage so the cart survives reloads. Pricing math is
 * centralized so the Cart screen and the floating cart pill always agree.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  findSku,
  findBundle,
  STORE_SKUS,
  type StoreSKU,
  type StoreBundle,
} from "../data/pricing";

/**
 * Synthesize a StoreSKU-shaped record for a bundle line so the cart UI
 * (which renders `line.sku.title`, image, etc.) keeps working without a
 * second code path. The display flavor inherits from the user's
 * recommended flavor would be ideal, but the cart store has no app-state
 * dependency by design — so we deterministically pick the first SKU of
 * the bundle's format. Bundle pricing is authoritative on the server;
 * the synthesized priceCents is just for client-side subtotal display.
 */
function bundleAsSku(bundle: StoreBundle): StoreSKU | null {
  const repr = STORE_SKUS.find((s) => s.formatId === bundle.formatId);
  if (!repr) return null;
  return {
    ...repr,
    id: bundle.id,
    title: `${repr.title} · ${bundle.label}`,
    formatLabel: `${repr.formatLabel} · ${bundle.label}`,
    priceCents: bundle.priceCents,
    subscriptionPriceCents: bundle.priceCents,
    compareAtCents: repr.priceCents * bundle.multiplier,
    blurb: `Bundle of ${bundle.multiplier} packs.`,
    badge: bundle.badge,
  };
}

const STORAGE_KEY = "aforce.cart.v1";
const MAX_QTY_PER_LINE = 99;

export interface CartLine {
  skuId: string;
  qty: number;
  addedAt: string;
}

interface State {
  lines: CartLine[];
  hydrated: boolean;
}

type Action =
  | { type: "HYDRATE"; payload: CartLine[] }
  | { type: "ADD"; payload: { skuId: string; qty: number } }
  | { type: "SET_QTY"; payload: { skuId: string; qty: number } }
  | { type: "REMOVE"; payload: { skuId: string } }
  | { type: "CLEAR" };

const initial: State = { lines: [], hydrated: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE": {
      // Merge stored lines with anything the user added between mount and
      // hydration completion. Pre-hydration lines win on duplicate SKUs by
      // having their qty added to the stored qty (capped). This prevents a
      // taps-during-hydration race from losing items.
      const merged = new Map<string, CartLine>();
      for (const stored of action.payload) {
        merged.set(stored.skuId, { ...stored });
      }
      for (const pending of state.lines) {
        const existing = merged.get(pending.skuId);
        if (existing) {
          merged.set(pending.skuId, {
            ...existing,
            qty: Math.min(MAX_QTY_PER_LINE, existing.qty + pending.qty),
          });
        } else {
          merged.set(pending.skuId, { ...pending });
        }
      }
      return { lines: Array.from(merged.values()), hydrated: true };
    }
    case "ADD": {
      const { skuId, qty } = action.payload;
      const existing = state.lines.find((l) => l.skuId === skuId);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.skuId === skuId
              ? { ...l, qty: Math.min(MAX_QTY_PER_LINE, l.qty + qty) }
              : l,
          ),
        };
      }
      return {
        ...state,
        lines: [
          { skuId, qty: Math.min(MAX_QTY_PER_LINE, qty), addedAt: new Date().toISOString() },
          ...state.lines,
        ],
      };
    }
    case "SET_QTY": {
      const { skuId, qty } = action.payload;
      if (qty <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.skuId !== skuId) };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.skuId === skuId ? { ...l, qty: Math.min(MAX_QTY_PER_LINE, qty) } : l,
        ),
      };
    }
    case "REMOVE":
      return { ...state, lines: state.lines.filter((l) => l.skuId !== action.payload.skuId) };
    case "CLEAR":
      return { ...state, lines: [] };
    default:
      return state;
  }
}

export interface CartLineWithSku extends CartLine {
  sku: StoreSKU;
  lineSubtotalCents: number;
}

interface CartContextValue {
  lines: CartLine[];
  hydrated: boolean;
  itemCount: number;
  subtotalCents: number;
  resolvedLines: CartLineWithSku[];
  add: (skuId: string, qty?: number) => void;
  setQty: (skuId: string, qty: number) => void;
  remove: (skuId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // Hydrate on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) {
          dispatch({ type: "HYDRATE", payload: [] });
          return;
        }
        try {
          const parsed = JSON.parse(raw) as CartLine[];
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(
              (l) =>
                l && typeof l.skuId === "string" && typeof l.qty === "number" && l.qty > 0,
            );
            dispatch({ type: "HYDRATE", payload: cleaned });
            return;
          }
        } catch {
          // Bad payload — treat as empty.
        }
        dispatch({ type: "HYDRATE", payload: [] });
      })
      .catch(() => dispatch({ type: "HYDRATE", payload: [] }));
  }, []);

  // Persist after every change (post-hydration).
  useEffect(() => {
    if (!state.hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines)).catch(() => {});
  }, [state.lines, state.hydrated]);

  const resolvedLines = useMemo<CartLineWithSku[]>(() => {
    return state.lines
      .map((line) => {
        // Try atomic SKU first, then fall back to a bundle resolution
        // that synthesizes a SKU-shaped record so the cart UI doesn't
        // need a second render path.
        const directSku = findSku(line.skuId);
        const sku =
          directSku ??
          (() => {
            const b = findBundle(line.skuId);
            return b ? bundleAsSku(b) : null;
          })();
        if (!sku) return null;
        return {
          ...line,
          sku,
          lineSubtotalCents: sku.priceCents * line.qty,
        };
      })
      .filter((l): l is CartLineWithSku => l !== null);
  }, [state.lines]);

  const itemCount = useMemo(
    () => resolvedLines.reduce((acc, l) => acc + l.qty, 0),
    [resolvedLines],
  );

  const subtotalCents = useMemo(
    () => resolvedLines.reduce((acc, l) => acc + l.lineSubtotalCents, 0),
    [resolvedLines],
  );

  const add = useCallback(
    (skuId: string, qty = 1) => dispatch({ type: "ADD", payload: { skuId, qty } }),
    [],
  );
  const setQty = useCallback(
    (skuId: string, qty: number) => dispatch({ type: "SET_QTY", payload: { skuId, qty } }),
    [],
  );
  const remove = useCallback(
    (skuId: string) => dispatch({ type: "REMOVE", payload: { skuId } }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      hydrated: state.hydrated,
      itemCount,
      subtotalCents,
      resolvedLines,
      add,
      setQty,
      remove,
      clear,
    }),
    [state.lines, state.hydrated, itemCount, subtotalCents, resolvedLines, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
