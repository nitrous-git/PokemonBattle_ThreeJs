import { it, expect } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { read, hash } from '../scripts/io.mjs';
it('atlases contain genuinely changing frames, correctly bounded and timed', async () => {
  const manifest = await read('src/data/generated/spriteManifest.json');
  for (const id of ['pikachu', 'charizard'])
    for (const side of ['front', 'back']) {
      const s = manifest[id][side],
        path = `public/${s.atlasUrl}`;
      if (s.rightsStatus === 'placeholder') {
        expect(s.frames).toHaveLength(1);
        continue;
      }
      expect(s.frames.length).toBeGreaterThan(1);
      const signatures = new Set();
      for (const f of s.frames) {
        const [left, top, width, height] = f.rectPx;
        expect(f.durationMs).toBeGreaterThanOrEqual(20);
        const pixels = await sharp(path).extract({ left, top, width, height }).raw().toBuffer();
        signatures.add(hash(pixels.toString('base64')));
      }
      expect(signatures.size).toBeGreaterThan(1);
    }
});
it('runtime source has no external fetch, XMLHttpRequest, or remote asset URL', async () => {
  const files = [];
  async function walk(dir) {
    for (const f of await fs.readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) {
        if (!p.includes('/data/')) await walk(p);
      } else if (p.endsWith('.js')) files.push(p);
    }
  }
  await walk('src');
  for (const file of files) {
    const code = await fs.readFile(file, 'utf8');
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest/);
    expect(code).not.toMatch(/(?:src|atlasUrl|staticUrl)=?['"]https?:/);
  }
});
