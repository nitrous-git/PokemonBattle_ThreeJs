import { read, hash } from './io.mjs';
import { compile } from './compile-content.mjs';
const current = await compile(await read('src/data/source/snapshot.json'), { validateOnly: true });
for (const [name, value] of Object.entries(current))
  if (hash(value) !== hash(await read(`src/data/generated/${name}.json`)))
    throw Error(`Stale generated content: ${name}. Run data:compile.`);
console.log(
  'Content validation passed, including source identities, custom allowances, structured effects and generated freshness.',
);
