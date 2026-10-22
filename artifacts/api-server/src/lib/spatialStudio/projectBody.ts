/**
 * Validation for saved Spatial Studio projects. The studio re-normalizes
 * every document it opens, so the server checks shape and size, not
 * geometry: real fixture kinds, bounded arrays, image data URLs only.
 */
import { z } from "zod";

import { ASSET_KINDS, FIXTURE_KINDS } from "./editOps";

export const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{3,79}$/;
/** Route-scoped express.json limit; the document itself must fit with headroom. */
export const MAX_BODY = "12mb";
export const MAX_DOCUMENT_BYTES = 11 * 1024 * 1024;
export const MAX_THUMBNAIL_CHARS = 300_000;
export const MAX_ASSET_DATA_URL_CHARS = 8_000_000;

const finite = z.number().finite();

const FixtureSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum(FIXTURE_KINDS),
    label: z.string().max(120),
    description: z.string().max(2000).optional(),
    position: z.tuple([finite, finite, finite]),
    rotationY: finite,
    footprint: z.object({ width: finite, depth: finite, height: finite }),
    style: z.record(z.string(), z.unknown()).optional(),
    slots: z.record(z.string(), z.string().nullable()).optional(),
  })
  .passthrough();

const AssetSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum(ASSET_KINDS),
    name: z.string().max(120),
    dataUrl: z.string().startsWith("data:image/").max(MAX_ASSET_DATA_URL_CHARS),
    width: finite,
    height: finite,
    bytes: finite,
  })
  .passthrough();

export const DocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().max(120),
    unit: z.literal("ft"),
    floor: z.object({ width: finite, depth: finite, wallHeight: finite }),
    fixtures: z.array(FixtureSchema).max(60),
    style: z.record(z.string(), z.unknown()),
    assets: z.array(AssetSchema).max(100),
  })
  .passthrough();
export type StoredDocument = z.infer<typeof DocumentSchema>;

export const ProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  document: DocumentSchema,
  thumbnail: z.string().startsWith("data:image/").max(MAX_THUMBNAIL_CHARS).nullable(),
  /** The updatedAt the client last saw; null skips the concurrency check. */
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
});
export type ProjectBody = z.infer<typeof ProjectBodySchema>;

export interface DocumentMeasure {
  bytes: number;
  fixtureCount: number;
  assetCount: number;
}

export function measureDocument(doc: StoredDocument): DocumentMeasure {
  return {
    bytes: JSON.stringify(doc).length,
    fixtureCount: doc.fixtures.length,
    assetCount: doc.assets.length,
  };
}

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_PATTERN.test(id);
}
