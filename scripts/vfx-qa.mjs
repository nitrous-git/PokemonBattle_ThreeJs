// Focused Phase A checks. Run: node scripts/vfx-qa.mjs (after Playwright Chromium install).
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { serveStatic } from './static-server.mjs';

const server = await serveStatic({ port: 4186 });
let browser;
const errors = [];
const checks = [];
const prefix = '/PokemonBattle_ThreeJs';
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin === 'https://cdn.jsdelivr.net' &&
      url.pathname.startsWith('/npm/three@0.180.0/build/')
    ) {
      const name = url.pathname.split('/').pop();
      if (['three.module.js', 'three.core.js'].includes(name))
        return route.fulfill({
          path: `node_modules/three/build/${name}`,
          contentType: 'text/javascript',
          headers: { 'access-control-allow-origin': '*' },
        });
    }
    if (url.hostname !== '127.0.0.1') return route.abort();
    // Mirror Pages' repository mount; imports and public assets must retain the prefix.
    expect(url.pathname.startsWith(prefix + '/')).toBe(true);
    const local = `http://127.0.0.1:4186${url.pathname.slice(prefix.length)}${url.search}`;
    const response = await route.fetch({ url: local });
    if (url.pathname.endsWith('/src/main.js')) {
      const source = (await response.text()).replace(
        'new GameApp(',
        'window.__vfxQA = new GameApp(',
      );
      return route.fulfill({ response, body: source });
    }
    return route.fulfill({ response });
  });
  await context.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 42;
        return array;
      }
      return original(array);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await fs.mkdir('qa/vfx', { recursive: true });
  await page.goto(`http://127.0.0.1:4186${prefix}/`);
  await page.locator('.hero-cta').click();
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  await page.locator('[data-action=start]').click();
  await expect(page.locator('.move-button').first()).toBeEnabled();
  expect(
    await page.evaluate(() => Boolean(window.__vfxQA.scene && !window.__vfxQA.graphicsError)),
  ).toBe(true);
  checks.push('Real WebGL renderer, sprites and templates load under repository subpath');

  // Exercise actual event playback at both speeds, not only manually stepped effects.
  for (const speed of [1, 3]) {
    const result = await page.evaluate(async (speed) => {
      const app = window.__vfxQA;
      app.setSetting('speed', speed);
      const begin = performance.now();
      await app.scene.play({ actor: 'player', target: 'opponent', moveId: 'flamethrower' });
      return { ms: performance.now() - begin, remaining: app.scene.fx.children.length };
    }, speed);
    expect(result.remaining).toBe(0);
    expect(result.ms).toBeGreaterThan(speed === 1 ? 850 : 250);
    expect(result.ms).toBeLessThan(5000); // Software rendering varies between hosts.
  }
  checks.push('1× / 3× renderer completion waits finish with an empty effect group');

  await page.evaluate(() => window.__vfxQA.setSetting('speed', 1));
  await page.locator('.move-button').filter({ hasText: 'Growl' }).click();
  await page.waitForFunction(() => window.__vfxQA.scene.effects.length > 0);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__vfxQA.busy);
  expect(await page.evaluate(() => window.__vfxQA.scene.fx.children.length)).toBe(0);
  checks.push(
    'Space during a real turn cancels VFX and releases input without lingering particles',
  );

  const loss = await page.evaluate(async () => {
    const scene = window.__vfxQA.scene;
    const playback = scene.play({ actor: 'player', target: 'opponent', moveId: 'hydro-pump' });
    scene.renderer.forceContextLoss();
    await playback;
    return { lost: scene.lost, effects: scene.effects.length };
  });
  expect(loss).toEqual({ lost: true, effects: 0 });
  await page.evaluate(() => window.__vfxQA.scene.renderer.forceContextRestore());
  await page.waitForFunction(() => !window.__vfxQA.scene.lost);
  checks.push('Context loss cancels playback; context restoration resumes rendering');

  // Pause RAF solely for repeatable visual samples. Runtime code has no QA hooks.
  await page.evaluate(() => cancelAnimationFrame(window.__vfxQA.scene.raf));
  async function sample(id, progress = 0.43, settings = {}, reverse = false) {
    await page.evaluate(
      ({ id, progress, settings, reverse }) => {
        const scene = window.__vfxQA.scene;
        scene.clearEffects();
        scene.settingsChanged({
          ...window.__vfxQA.settings,
          speed: 1,
          lowVFX: false,
          reducedMotion: false,
          ...settings,
        });
        scene.play({
          actor: reverse ? 'opponent' : 'player',
          target: reverse ? 'player' : 'opponent',
          moveId: id,
        });
        const effect = scene.effects[0];
        scene.update(effect.duration * progress);
        scene.renderer.render(scene.scene, scene.camera);
      },
      { id, progress, settings, reverse },
    );
  }
  for (const id of [
    'ember',
    'flamethrower',
    'water-gun',
    'hydro-pump',
    'rock-throw',
    'rock-slide',
    'thunder-shock',
    'thunderbolt',
    'ice-beam',
    'shadow-ball',
    'dragon-claw',
    'razor-leaf',
  ]) {
    await sample(id);
    await page.screenshot({ path: `qa/vfx/${id}.png` });
  }
  for (const [name, settings, reverse] of [
    ['impact', {}, false],
    ['reverse', {}, true],
    ['low', { lowVFX: true }, false],
    ['reduced', { reducedMotion: true }, false],
  ]) {
    await sample('hydro-pump', 0.72, settings, reverse);
    await page.screenshot({ path: `qa/vfx/${name}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await sample('thunderbolt', 0.48);
  await page.screenshot({ path: 'qa/vfx/mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  checks.push(
    '12 move samples, impact, reverse direction, Low VFX, Reduced Motion and 390px layout',
  );

  const memory = await page.evaluate(async () => {
    const scene = window.__vfxQA.scene;
    const batch = () => {
      for (let i = 0; i < 50; i++) {
        scene.play({
          actor: 'player',
          target: 'opponent',
          moveId: i % 2 ? 'thunderbolt' : 'hydro-pump',
        });
        scene.update(0.3);
        scene.renderer.render(scene.scene, scene.camera);
        scene.clearEffects();
      }
      scene.renderer.render(scene.scene, scene.camera);
      return { ...scene.renderer.info.memory, groups: scene.fx.children.length };
    };
    return [batch(), batch()];
  });
  expect(memory[1]).toEqual(memory[0]);
  expect(memory[1].groups).toBe(0);
  checks.push(
    '100 repeated effects/cancellations: stable GPU geometry/texture counts, no retained groups',
  );
  // Failure fallback uses the same effect-derived duration and remains skippable.
  await page.reload();
  await page.locator('.hero-cta').click();
  await page.locator('[data-action=start]').click();
  await expect(page.locator('.move-button').first()).toBeEnabled();
  await page.evaluate(() => {
    const app = window.__vfxQA;
    app.scene.dispose();
    app.scene = null;
    app.setSetting('speed', 3);
  });
  await page.locator('.move-button').filter({ hasText: 'Growl' }).click();
  await page.waitForFunction(() => !window.__vfxQA.busy);
  checks.push('No-renderer fallback completes a real turn with effect-aware timing');
  expect(errors).toEqual([]);
  const report = { passed: true, browser: await browser.version(), checks, errors, memory };
  await fs.writeFile('qa/vfx/results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
