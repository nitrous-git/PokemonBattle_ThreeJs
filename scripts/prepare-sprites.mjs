import fs from 'node:fs/promises';
import sharp from 'sharp';
import { read, write, download, parallel, hash } from './io.mjs';
const species = await read('src/data/game/speciesOverrides.json'),
  lock = await read('src/data/game/source-lock.json');
const standins = process.argv.includes('--standins');
const root = 'public/assets/pokemon';
await fs.mkdir(root, { recursive: true });
const colors = [
  '#f6ce57',
  '#7cce99',
  '#ee976b',
  '#75c7e1',
  '#dcc393',
  '#dfb88b',
  '#f5a46d',
  '#accad1',
  '#b491d4',
  '#e6be79',
  '#c3ad8d',
  '#e4cf77',
  '#98b5c1',
  '#acb9ef',
  '#eda36f',
  '#7dcae7',
];
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',');
if (only?.some((id) => !species[id])) throw Error('Unknown species in --only');
const manifest = only ? await read('src/data/generated/spriteManifest.json') : {};
if (only)
  for (const id of Object.keys(species).filter((id) => !only.includes(id)))
    if (!manifest[id] || manifest[id].sourceCommit !== lock.spriteRepoRevision)
      throw Error(
        `Cannot retain missing or differently pinned sprite ${id}; prepare the full roster.`,
      );
export async function atlas(buffer, path) {
  const meta = await sharp(buffer, { animated: true }).metadata();
  const { data, info } = await sharp(buffer, { animated: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = meta.pageHeight || info.height,
    n = meta.pages || 1;
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0;
  for (let f = 0; f < n; f++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[((f * h + y) * w + x) * 4 + 3] > 12) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
  if (x1 < x0 || y1 < y0) throw Error('Empty sprite alpha');
  const cw = x1 - x0 + 1,
    ch = y1 - y0 + 1,
    cols = Math.min(8, n),
    rows = Math.ceil(n / cols),
    cellW = cw + 4,
    cellH = ch + 4,
    aw = cellW * cols,
    ah = cellH * rows;
  if (aw > 8192 || ah > 8192) throw Error('Atlas exceeds supported texture size');
  const composites = [],
    frames = [];
  let first;
  for (let f = 0; f < n; f++) {
    const frame = await sharp(data, { raw: { width: w, height: info.height, channels: 4 } })
      .extract({ left: x0, top: f * h + y0, width: cw, height: ch })
      .png()
      .toBuffer();
    first ??= frame;
    const x = (f % cols) * cellW + 2,
      y = Math.floor(f / cols) * cellH + 2;
    composites.push({ input: frame, left: x, top: y });
    frames.push({ rectPx: [x, y, cw, ch], durationMs: Math.max(20, meta.delay?.[f] || 100) });
  }
  await sharp({ create: { width: aw, height: ah, channels: 4, background: '#00000000' } })
    .composite(composites)
    .png()
    .toFile(`${path}_atlas.png`);
  await fs.writeFile(`${path}_static.png`, first);
  return {
    atlasUrl: `${path.replace('public/', '')}_atlas.png`,
    staticUrl: `${path.replace('public/', '')}_static.png`,
    atlasSize: [aw, ah],
    size: [cw, ch],
    frames,
    anchor: [0.5, 1],
    trimBounds: [x0, y0, cw, ch],
    sourceFrameCount: n,
  };
}
const selectedSpecies = Object.entries(species).filter(([id]) => !only || only.includes(id));
await parallel(selectedSpecies, async ([id, s]) => {
  const i = Object.keys(species).indexOf(id);
  const entry = {
    speciesId: id,
    dexNumber: s.dexNumber,
    visualScale: s.visualScale,
    shadowRadius: 1,
    sourceCommit: lock.spriteRepoRevision,
    redistributable: standins,
    rightsStatus: standins ? 'placeholder' : 'copyrighted-restricted',
  };
  for (const side of ['front', 'back']) {
    let buf,
      sourceUrl,
      fallbackReason = null;
    if (!standins) {
      const dir = side === 'back' ? 'back/' : '';
      const base = `https://raw.githubusercontent.com/PokeAPI/sprites/${lock.spriteRepoRevision}/sprites/pokemon/versions/generation-v/black-white/`;
      try {
        sourceUrl = `${base}animated/${dir}${s.dexNumber}.gif`;
        buf = await download(sourceUrl);
      } catch {
        sourceUrl = `${base}${dir}${s.dexNumber}.png`;
        try {
          buf = await download(sourceUrl);
          fallbackReason = 'Gen-V GIF unavailable; static PNG.';
        } catch {
          throw Error(
            `Gen-V art unavailable for ${id}/${side}; no placeholder published. Retry the pinned source or explicitly use --standins for development.`,
          );
        }
      }
    }
    if (!buf) {
      buf = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="100"><path d="M48 4 79 25 86 65 66 94 30 94 10 65 17 25Z" fill="${colors[i % colors.length]}" stroke="#27354b" stroke-width="5"/><path d="M48 4 34 39 48 94 62 39Z" fill="#ffffff" opacity=".2"/>${side === 'front' ? '<path d="M25 44h13v9H25zm33 0h13v9H58z" fill="#182636"/><path d="M38 65h20v5H38z" fill="#182636"/>' : '<path d="m30 40 18 12 18-12M30 55l18 12 18-12" fill="none" stroke="#27354b" stroke-width="5"/>'}</svg>`,
      );
      entry.rightsStatus = 'placeholder';
      entry.redistributable = true;
      sourceUrl = 'original procedural geometric stand-in';
    }
    entry[side] = {
      ...(await atlas(buf, `${root}/${s.dexNumber}_${side}`)),
      sourceUrl,
      sha256: hash(buf.toString('base64')),
      fallbackReason,
      rightsStatus: sourceUrl.startsWith('https') ? 'copyrighted-restricted' : 'placeholder',
    };
  }
  const restricted = [entry.front, entry.back].some(
    (a) => a.rightsStatus === 'copyrighted-restricted',
  );
  entry.rightsStatus = restricted ? 'copyrighted-restricted' : 'placeholder';
  entry.redistributable = !restricted;
  entry.icon = entry.front.staticUrl;
  entry.portrait = entry.front.staticUrl;
  manifest[id] = entry;
  console.log(
    `${id}: ${entry.front.frames.length}/${entry.back.frames.length} frames (${entry.rightsStatus})`,
  );
});
await write(
  'src/data/generated/spriteManifest.json',
  Object.fromEntries(Object.keys(species).map((id) => [id, manifest[id]])),
);
