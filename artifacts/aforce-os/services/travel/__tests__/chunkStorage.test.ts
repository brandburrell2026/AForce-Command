import { describe, it, expect } from "vitest";
import { createChunkStorage, splitTravelPayload } from "../chunkStorage";
describe("atomic secure travel chunks", () => {
  it("respects the byte ceiling with Unicode and restores the complete payload", async () => {
    const values = new Map<string, string>();
    const storage = createChunkStorage({
      getItem: async (k) => values.get(k) ?? null,
      setItem: async (k, v) => {
        if (new TextEncoder().encode(v).byteLength > 1800)
          throw new Error("Native capacity");
        values.set(k, v);
      },
      removeItem: async (k) => {
        values.delete(k);
      },
    });
    const text = "✈️".repeat(3000);
    expect(splitTravelPayload(text).length).toBeGreaterThan(1);
    await storage.setItem("A", text);
    expect(await storage.getItem("A")).toBe(text);
    expect(await storage.getItem("B")).toBeNull();
    await storage.setItem("A", "small");
    expect(await storage.getItem("A")).toBe("small");
    expect(values.size).toBe(2);
    await storage.removeItem("A");
    expect(values.size).toBe(0);
  });
  it("retains the previous readable generation after an interrupted part write", async () => {
    const values = new Map<string, string>();
    let fail = false;
    const storage = createChunkStorage({
      getItem: async (k) => values.get(k) ?? null,
      setItem: async (k, v) => {
        if (fail && k.endsWith(".1")) throw new Error("Device locked");
        values.set(k, v);
      },
      removeItem: async (k) => {
        values.delete(k);
      },
    });
    await storage.setItem("A", "original");
    fail = true;
    await expect(storage.setItem("A", "new".repeat(2000))).rejects.toThrow(
      "locked",
    );
    expect(await storage.getItem("A")).toBe("original");
    fail = false;
    await storage.setItem("A", "recovered");
    expect(await storage.getItem("A")).toBe("recovered");
    expect(values.size).toBe(2);
  });
  it("reads legacy inline documents and fails closed when a committed part is missing", async () => {
    const values = new Map<string, string>([["A", '{"trips":[]}']]);
    const storage = createChunkStorage({
      getItem: async (k) => values.get(k) ?? null,
      setItem: async (k, v) => {
        values.set(k, v);
      },
      removeItem: async (k) => {
        values.delete(k);
      },
    });
    expect(await storage.getItem("A")).toBe('{"trips":[]}');
    await storage.setItem("A", "next");
    const m = JSON.parse(values.get("A")!);
    values.delete(`A.${m.generation}.0`);
    await expect(storage.getItem("A")).rejects.toThrow("incomplete");
  });
});
