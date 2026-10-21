// Creates a separate source tree with original geometric stand-ins and no private screenshots.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd(),
  out = path.join(root, 'release', 'public-source');
await fs.mkdir(out, { recursive: true });
for (const name of ['src', 'scripts', 'tests', 'docs', 'public'])
  await fs.cp(path.join(root, name), path.join(out, name), { recursive: true, force: true });
for (const name of [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.js',
  'eslint.config.js',
  'README.md',
  'ASSET_CREDITS.md',
  'LICENSES.md',
  'QA_REPORT.md',
  '.gitignore',
  '.prettierrc.json',
])
  await fs.copyFile(path.join(root, name), path.join(out, name));
const prepared = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/prepare-sprites.mjs'), '--standins'],
  { cwd: out, stdio: 'inherit' },
);
if (prepared.status) throw Error('Stand-in conversion failed');
const checked = spawnSync(process.execPath, [path.join(root, 'scripts/check-assets.mjs')], {
  cwd: out,
  stdio: 'inherit',
});
if (checked.status) throw Error('Stand-in validation failed');
await fs.writeFile(
  path.join(out, 'ART_PROFILE.md'),
  '# Original stand-in profile\n\nAll shipped PNG art in this copy is original geometric stand-in artwork. Pokémon names and data are retained. No franchise artwork, private QA screenshots or prebuilt private dist/ are included. Run npm install then npm run dev. The source archive does not make claims about trademark clearance.\n',
);
console.log(
  `Public source prepared at ${out}. Install dependencies there before building. Do not copy the private dist/ or qa/ folders into it.`,
);
