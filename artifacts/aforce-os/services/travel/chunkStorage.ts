import type { JourneyStorage } from "./journey";
interface Descriptor {
  generation: string;
  parts: number;
}
interface Manifest extends Descriptor {
  travelChunks: 1;
  previous?: Descriptor;
}
const descriptor = (value: unknown): Descriptor => {
  const v = value as Descriptor;
  if (
    !v ||
    typeof v.generation !== "string" ||
    !/^[a-z0-9_-]{1,80}$/.test(v.generation) ||
    !Number.isInteger(v.parts) ||
    v.parts < 1 ||
    v.parts > 512
  )
    throw new Error("Travel storage manifest is invalid.");
  return { generation: v.generation, parts: v.parts };
};
function manifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.travelChunks !== 1) return null;
  return {
    ...descriptor(value),
    travelChunks: 1,
    ...(value.previous ? { previous: descriptor(value.previous) } : {}),
  };
}
export function splitTravelPayload(value: string): string[] {
  const parts: string[] = [];
  let part = "",
    size = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    const bytes = code <= 127 ? 1 : code <= 2047 ? 2 : code <= 65535 ? 3 : 4;
    if (size + bytes > 1800) {
      parts.push(part);
      part = "";
      size = 0;
    }
    part += character;
    size += bytes;
  }
  if (part || !parts.length) parts.push(part);
  if (parts.length > 512)
    throw new Error("Travel data exceeds secure storage capacity.");
  return parts;
}
/** Each part stays below legacy native limits. Commit the manifest last; keep a
 * small recovery journal so interrupted writes can be cleaned without losing
 * the prior readable generation. The underlying native adapter encrypts every value. */
export function createChunkStorage(storage: JourneyStorage): JourneyStorage {
  const partKey = (key: string, d: Descriptor, index: number) =>
    `${key}.${d.generation}.${index}`;
  const erase = async (key: string, d: Descriptor) => {
    for (let i = 0; i < d.parts; i++)
      await storage.removeItem(partKey(key, d, i));
  };
  return {
    async getItem(key) {
      const raw = await storage.getItem(key),
        m = manifest(raw);
      if (!m) return raw;
      let result = "";
      for (let i = 0; i < m.parts; i++) {
        const part = await storage.getItem(partKey(key, m, i));
        if (part === null)
          throw new Error(
            "Travel storage is incomplete. Retry before editing.",
          );
        result += part;
      }
      return result;
    },
    async setItem(key, value) {
      const raw = await storage.getItem(key),
        current = manifest(raw);
      const pendingRaw = await storage.getItem(`${key}.pending`);
      if (pendingRaw) {
        const pending = descriptor(JSON.parse(pendingRaw));
        if (pending.generation !== current?.generation)
          await erase(key, pending);
        await storage.removeItem(`${key}.pending`);
      }
      if (current?.previous) await erase(key, current.previous);
      const chunks = splitTravelPayload(value);
      const next: Descriptor = {
        generation: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        parts: chunks.length,
      };
      await storage.setItem(`${key}.pending`, JSON.stringify(next));
      for (let i = 0; i < chunks.length; i++)
        await storage.setItem(partKey(key, next, i), chunks[i]);
      await storage.setItem(
        key,
        JSON.stringify({
          ...next,
          travelChunks: 1,
          ...(current ? { previous: descriptor(current) } : {}),
        }),
      );
      await storage.removeItem(`${key}.pending`);
      if (current) await erase(key, current);
      await storage.setItem(key, JSON.stringify({ ...next, travelChunks: 1 }));
    },
    async removeItem(key) {
      const current = manifest(await storage.getItem(key));
      if (current) {
        await erase(key, current);
        if (current.previous) await erase(key, current.previous);
      }
      const pending = await storage.getItem(`${key}.pending`);
      if (pending) await erase(key, descriptor(JSON.parse(pending)));
      await storage.removeItem(`${key}.pending`);
      await storage.removeItem(key);
    },
  };
}
