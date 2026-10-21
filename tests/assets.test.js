import { it, expect } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { read, hash } from '../scripts/io.mjs';

it('atlases contain genuinely changing frames, correctly bounded and timed', async () => {
  const manifest = await read('src/data/generated/spriteManifest.json');
  for (const id of ['pikachu', 'charizard'])
    for (const side of ['front', 'back']) {
      const sprite = manifest[id][side];
      const path = `public/${sprite.atlasUrl}`;
      if (sprite.rightsStatus === 'placeholder') {
        expect(sprite.frames).toHaveLength(1);
        continue;
      }
      expect(sprite.frames.length).toBeGreaterThan(1);
      const signatures = new Set();
      for (const frame of sprite.frames) {
        const [left, top, width, height] = frame.rectPx;
        expect(frame.durationMs).toBeGreaterThanOrEqual(20);
        const pixels = await sharp(path).extract({ left, top, width, height }).raw().toBuffer();
        signatures.add(hash(pixels.toString('base64')));
      }
      expect(signatures.size).toBeGreaterThan(1);
    }
});

it('browser runtime never fetches Pokémon API or other external content', async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!path.includes('/data/')) await walk(path);
      } else if (path.endsWith('.js')) files.push(path);
    }
  }
  await walk('src');
  for (const path of files) {
    const source = await fs.readFile(path, 'utf8');
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/(?:src|atlasUrl|staticUrl)=?['"]https?:/);
    // The sole runtime fetch is the same-origin, repository-relative HTML template.
    if (path === 'src/ui/screens.js') {
      expect(source).toContain("new URL('./templates.html', import.meta.url)");
      expect((source.match(/\bfetch\s*\(/g) || []).length).toBe(1);
    } else {
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  }
});
