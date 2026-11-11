import { useEditor } from "@/editor/store";
import { resolveSlot, type Fixture } from "@/scene/model";

/** The asset id a fixture slot shows after inheritance, or null. */
export function useSlot(fixture: Fixture, key: string): string | null {
  return useEditor((s) => resolveSlot(fixture, s.doc.style, key));
}
