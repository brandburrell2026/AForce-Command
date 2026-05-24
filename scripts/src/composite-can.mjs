import sharp from 'sharp';

const canPath = '/home/runner/workspace/attached_assets/CAN_3D_MELON_11oz_1779636492668.png';
const canTrimmed = await sharp(canPath).trim().toBuffer();
const trimMeta = await sharp(canTrimmed).metadata();
console.log('trimmed can dims:', trimMeta.width, trimMeta.height);

const variants = [
  { id: 'A', bg: '/home/runner/workspace/attached_assets/generated_images/scene_bg_A.png', heightFrac: 0.55, cxFrac: 0.28, bottomFrac: 0.86, darken: 0.78 },
  { id: 'B', bg: '/home/runner/workspace/attached_assets/generated_images/scene_bg_B.png', heightFrac: 0.52, cxFrac: 0.20, bottomFrac: 0.85, darken: 0.75 },
  { id: 'C', bg: '/home/runner/workspace/attached_assets/generated_images/scene_bg_C.png', heightFrac: 0.58, cxFrac: 0.30, bottomFrac: 0.88, darken: 0.80 },
];

for (const v of variants) {
  const bgMeta = await sharp(v.bg).metadata();
  const targetH = Math.round(bgMeta.height * v.heightFrac);
  const scale = targetH / trimMeta.height;
  const targetW = Math.round(trimMeta.width * scale);
  const canResized = await sharp(canTrimmed).resize(targetW, targetH).linear(v.darken, 0).toBuffer();

  const shadowW = Math.round(targetW * 1.5);
  const shadowH = Math.round(targetH * 0.20);
  const shadowSvg = `<svg width="${shadowW}" height="${shadowH}"><ellipse cx="${shadowW/2}" cy="${shadowH/2}" rx="${shadowW/2 - 4}" ry="${shadowH/2 - 2}" fill="black" opacity="0.7"/></svg>`;
  const shadow = await sharp(Buffer.from(shadowSvg)).blur(22).toBuffer();

  const bottomY = Math.round(bgMeta.height * v.bottomFrac);
  const canTopY = bottomY - targetH;
  const canLeftX = Math.round(bgMeta.width * v.cxFrac - targetW / 2);
  const shadowTopY = bottomY - Math.round(shadowH * 0.55);
  const shadowLeftX = Math.round(bgMeta.width * v.cxFrac - shadowW / 2);

  const out = `/home/runner/workspace/attached_assets/generated_images/system_every_moment_real_${v.id}.png`;
  await sharp(v.bg)
    .composite([
      { input: shadow, top: shadowTopY, left: shadowLeftX, blend: 'multiply' },
      { input: canResized, top: canTopY, left: canLeftX },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
}
