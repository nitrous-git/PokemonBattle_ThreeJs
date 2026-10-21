import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export const read = async (path) => JSON.parse(await fs.readFile(path, 'utf8'));
export const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
export async function write(path, value) {
  await fs.mkdir(path.substring(0, path.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  await fs.rename(path + '.tmp', path);
}
export async function download(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`${r.status}: ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw last;
}
export async function parallel(items, fn) {
  let index = 0;
  return Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (index < items.length) await fn(items[index++]);
    }),
  );
}
