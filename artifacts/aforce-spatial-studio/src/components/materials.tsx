import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";

import { useEditor } from "@/editor/store";
import { createMaterialSet, type MaterialSet } from "@/scene/materials";
import type { Vec3 } from "@/scene/model";
import type { ResolvedStyle } from "@/scene/style";

const MaterialsContext = createContext<MaterialSet | null>(null);

export function MaterialsProvider({ set, children }: { set: MaterialSet; children: ReactNode }) {
  return <MaterialsContext.Provider value={set}>{children}</MaterialsContext.Provider>;
}

export function useMaterials(): MaterialSet {
  const set = useContext(MaterialsContext);
  if (!set) throw new Error("useMaterials must be used inside a MaterialsProvider");
  return set;
}

/** A material set that is rebuilt (and the old one disposed) when the style changes. */
export function useMaterialSet(style: ResolvedStyle, surfaceMap: THREE.Texture | null): MaterialSet {
  const key = [style.accent, style.surface, style.panel, style.metal, style.finish, style.ledIntensity].join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useMemo(() => createMaterialSet(style, surfaceMap), [key, surfaceMap]);
  useEffect(() => () => set.dispose(), [set]);
  return set;
}

// ---- Uploaded image textures ---------------------------------------------

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

/** The GPU texture for an uploaded asset, or null until it has loaded. */
export function useAssetTexture(assetId: string | null | undefined): THREE.Texture | null {
  const asset = useEditor((s) => (assetId ? (s.doc.assets.find((a) => a.id === assetId) ?? null) : null));
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!asset || textureCache.has(asset.id)) return;
    let cancelled = false;
    loader
      .loadAsync(asset.dataUrl)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        textureCache.set(asset.id, texture);
        if (!cancelled) bump();
      })
      .catch(() => {
        /* a broken image simply renders nothing */
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  return asset ? (textureCache.get(asset.id) ?? null) : null;
}

/**
 * An uploaded image on a flat surface. "contain" fits the image inside the
 * slot keeping its aspect; "cover" fills the slot and crops. A little
 * emission makes logos read as backlit graphics.
 */
export function ImagePanel({
  assetId,
  width,
  height,
  position,
  rotation,
  fit = "contain",
  glow = 0.45,
}: {
  assetId: string | null;
  width: number;
  height: number;
  position: Vec3;
  rotation?: Vec3;
  fit?: "contain" | "cover";
  glow?: number;
}) {
  const texture = useAssetTexture(assetId);

  const sized = useMemo(() => {
    if (!texture) return null;
    const image = texture.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    if (fit === "contain") {
      let w = width;
      let h = width / aspect;
      if (h > height) {
        h = height;
        w = height * aspect;
      }
      return { w, h, map: texture };
    }
    const map = texture.clone();
    const slotAspect = width / height;
    if (aspect > slotAspect) {
      map.repeat.set(slotAspect / aspect, 1);
      map.offset.set((1 - slotAspect / aspect) / 2, 0);
    } else {
      map.repeat.set(1, aspect / slotAspect);
      map.offset.set(0, (1 - aspect / slotAspect) / 2);
    }
    map.needsUpdate = true;
    return { w: width, h: height, map };
  }, [texture, width, height, fit]);

  if (!sized) return null;

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[sized.w, sized.h]} />
      <meshStandardMaterial
        map={sized.map}
        emissiveMap={sized.map}
        emissive="#ffffff"
        emissiveIntensity={glow}
        transparent
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}
