import sharp from 'sharp';

const ROOT = '/home/runner/workspace';
const canPath = `${ROOT}/attached_assets/CAN_3D_MELON_11oz_1779636492668.png`;
const canTrimmed = await sharp(canPath).trim().toBuffer();
const trimMeta = await sharp(canTrimmed).metadata();
console.log('trimmed can dims:', trimMeta.width, trimMeta.height);

// For each variant:
// - bg: scene background
// - heightFrac: can height as fraction of bg height
// - cxFrac: horizontal center of can in bg (fraction of bg width)
// - bottomFrac: y of can base in bg (fraction of bg height)
// - darken: linear multiplier on can RGB to integrate with scene lighting
// - coverEllipse: { cxFrac, cyFrac, rxFrac, ryFrac } — black blurred ellipse to mask out AI-generated can underneath (omit if none)
const variants = [
  {
    id: 'A',
    bg: `${ROOT}/attached_assets/generated_images/scene_bg_A.png`,
    heightFrac: 0.22,
    cxFrac: 0.045,
    bottomFrac: 0.88,
    darken: 0.55,
    coverEllipse: { cxFrac: 0.045, cyFrac: 0.80, rxFrac: 0.045, ryFrac: 0.115 },
  },
  {
    id: 'B',
    bg: `${ROOT}/attached_assets/generated_images/scene_bg_B.png`,
    heightFrac: 0.26,
    cxFrac: 0.22,
    bottomFrac: 0.86,
    darken: 0.50,
    // no AI-gen can in this scene
  },
  {
    id: 'C',
    bg: `${ROOT}/attached_assets/generated_images/scene_bg_C.png`,
    heightFrac: 0.20,
    cxFrac: 0.055,
    bottomFrac: 0.89,
    darken: 0.62, // brighter because of the warm desk lamp pool of light
    coverEllipse: { cxFrac: 0.055, cyFrac: 0.81, rxFrac: 0.05, ryFrac: 0.10 },
  },
];

for (const v of variants) {
  const bgMeta = await sharp(v.bg).metadata();
  const W = bgMeta.width;
  const H = bgMeta.height;
  const targetH = Math.round(H * v.heightFrac);
  const scale = targetH / trimMeta.height;
  const targetW = Math.round(trimMeta.width * scale);

  const canResized = await sharp(canTrimmed)
    .resize(targetW, targetH)
    .linear(v.darken, 0)
    .toBuffer();

  // Soft contact shadow under the can
  const shadowW = Math.round(targetW * 2.0);
  const shadowH = Math.round(targetH * 0.14);
  const shadowSvg = `<svg width="${shadowW}" height="${shadowH}"><ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW / 2 - 4}" ry="${shadowH / 2 - 2}" fill="black" opacity="0.85"/></svg>`;
  const shadow = await sharp(Buffer.from(shadowSvg)).blur(16).toBuffer();

  const bottomY = Math.round(H * v.bottomFrac);
  const canTopY = bottomY - targetH;
  const canLeftX = Math.round(W * v.cxFrac - targetW / 2);
  const shadowTopY = bottomY - Math.round(shadowH * 0.55);
  const shadowLeftX = Math.round(W * v.cxFrac - shadowW / 2);

  const layers = [];

  // Optional: cover/erase AI-generated can with a soft blurred dark patch
  if (v.coverEllipse) {
    const c = v.coverEllipse;
    const ew = Math.round(W * c.rxFrac * 2);
    const eh = Math.round(H * c.ryFrac * 2);
    const eSvg = `<svg width="${ew}" height="${eh}"><ellipse cx="${ew / 2}" cy="${eh / 2}" rx="${ew / 2}" ry="${eh / 2}" fill="rgb(18,16,14)" opacity="0.96"/></svg>`;
    const cover = await sharp(Buffer.from(eSvg)).blur(14).toBuffer();
    layers.push({
      input: cover,
      top: Math.round(H * c.cyFrac - eh / 2),
      left: Math.round(W * c.cxFrac - ew / 2),
    });
  }

  layers.push({ input: shadow, top: shadowTopY, left: shadowLeftX, blend: 'multiply' });
  layers.push({ input: canResized, top: canTopY, left: canLeftX });

  const out = `${ROOT}/attached_assets/generated_images/system_every_moment_real_${v.id}.png`;
  await sharp(v.bg).composite(layers).png().toFile(out);
  console.log('wrote', out);
}
