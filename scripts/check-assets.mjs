import sharp from 'sharp';
import { read } from './io.mjs';
const sprites = await read('src/data/generated/spriteManifest.json'),
  species = await read('src/data/generated/pokemon.json');
let animated = 0;
for (const id of Object.keys(species)) {
  const s = sprites[id];
  if (!s || !Number.isFinite(s.visualScale) || !s.sourceCommit || !s.rightsStatus)
    throw Error(`Missing asset record ${id}`);
  for (const side of ['front', 'back']) {
    const a = s[side];
    for (const key of ['staticUrl', 'atlasUrl'])
      if (!a[key] || a[key].includes('://') || a[key].includes('..')) throw Error('Nonlocal asset');
    const m = await sharp(`public/${a.atlasUrl}`).metadata();
    await sharp(`public/${a.staticUrl}`).metadata();
    for (const f of a.frames) {
      const [x, y, w, h] = f.rectPx;
      if (
        x < 0 ||
        y < 0 ||
        w <= 0 ||
        h <= 0 ||
        x + w > m.width ||
        y + h > m.height ||
        f.durationMs < 20
      )
        throw Error(`Bad atlas ${id}/${side}`);
    }
    if (a.frames.length > 1) animated++;
  }
}
console.log(
  `Verified ${Object.keys(sprites).length} front/back pairs, ${animated} animated atlases; rights recorded.`,
);
