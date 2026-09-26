# SkinIA QA sample zones v0.1 — engineering precursor

**Status:** unvalidated, internal method development only. This is not a
label-specific scoring method, approved reference rubric, confidence threshold,
participant protocol, or member finding.

The iOS native feature module still processes an ephemeral `UIImage` in memory
and downsizes it to at most 640 pixels on its long edge. Vision locates one
frontal face; its normalized, lower-left-origin bounding box is converted to
top-left pixel coordinates. The five fixed rectangles below are fractions of
that face box. They are sampling zones, **not** landmark-verified skin regions.

| Zone | x fraction | y fraction |
| --- | --- | --- |
| Forehead | 0.30–0.70 | 0.12–0.28 |
| Left cheek | 0.13–0.38 | 0.48–0.68 |
| Right cheek | 0.62–0.87 | 0.48–0.68 |
| Nose | 0.43–0.57 | 0.42–0.66 |
| Chin | 0.35–0.65 | 0.75–0.88 |

`FACE_BOX_SAMPLE_ZONES_V0_1` exports each zone's sample count, mean brightness,
red-color index, bright-pixel fraction, mean edge magnitude, bright-edge
fraction, and clipping fraction. The native code samples every second pixel in
each direction. If any zone extends outside the image's one-pixel sampling
margin or contributes fewer than 32 sampled pixels, the capture returns
`REGIONS_UNUSABLE` rather than clamping the zone to background pixels. Existing
aggregate metrics remain for compatibility with older QA probes.

The TypeScript bridge accepts only that revision and finite, bounded numeric
fields. It strips unknown fields; malformed zone payloads fail closed. Older
native builds that do not return `qaSampleZones` remain compatible. No pixels,
image URI, thumbnail, face box, landmark coordinates, appearance label,
confidence band, or numeric member score crosses the bridge or is retained by
the capture screen.

## Limits before a scoring-method review

- A face-box zone can include hair, beard, makeup, glasses, or background even
  when it fits within the image. This revision does not detect those occlusions
  or establish whether the named skin area is observable.
- Bright-pixel and bright-edge fractions still use fixed image-intensity
  thresholds. They are not specific to surface shine or flaking, and their
  sensitivity to lighting, exposure, and skin tone is unmeasured.
- The 32-sample floor is an engineering guard against degenerate regions, not
  an approved image-quality or evidence threshold.
- iOS syntax parsing and TypeScript tests do not replace an Xcode/iPhone build
  or a diverse, consented evaluation. Android remains unsupported here.

Next: propose and version a **separate** cue-specific continuous score with
quality/abstention rules, then freeze the exact build, support cell, targets,
sample plan, and live-reference method for independent, privacy, and
product/claims review. Do not enroll participants or enable member findings
from this precursor.
