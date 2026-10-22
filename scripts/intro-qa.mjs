// Focused Phase B browser QA: node scripts/intro-qa.mjs
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { serveStatic } from './static-server.mjs';
const server = await serveStatic({ port: 4187 });
const prefix = '/PokemonBattle_ThreeJs';
const errors = [],
  checks = [];
let browser;
async function context(options = {}, missing = false) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
  await ctx.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 42;
        return array;
      }
      return original(array);
    };
  });
  await ctx.route('**/*', async (route) => {
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
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.pathname.startsWith(prefix + '/')).toBe(true);
    if (missing && url.pathname.endsWith('_front_static.png'))
      return route.fulfill({ status: 404, body: '' });
    const response = await route.fetch({
      url: `http://127.0.0.1:4187${url.pathname.slice(prefix.length)}${url.search}`,
    });
    if (url.pathname.endsWith('/src/main.js'))
      return route.fulfill({
        response,
        body: (await response.text()).replace('new GameApp(', 'window.__introQA = new GameApp('),
      });
    return route.fulfill({ response });
  });
  return ctx;
}
async function boot(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:4187${prefix}/`);
  await page.locator('.hero-cta').click();
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  return page;
}
async function available(page) {
  await expect(page.locator('.vs-intro')).toHaveCount(0);
  await expect(page.locator('.move-button:not([disabled])').first()).toBeEnabled();
  expect(await page.evaluate(() => document.querySelector('#app').inert)).toBe(false);
}
async function reset(page) {
  await page.evaluate(() => window.__introQA.go('setup'));
}
async function capture(page, name, size) {
  await page.setViewportSize(size);
  // Freeze within the browser task that observes readiness, avoiding a protocol-roundtrip race.
  await page.evaluate(() => new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const intro = window.__introQA.intro;
      if (intro?.view.dataset.state !== 'playing') return;
      observer.disconnect();
      for (const timer of intro.timers) clearTimeout(timer);
      intro.timers.clear();
      intro.view.dataset.reduced = 'true';
      resolve();
    });
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    void window.__introQA.start();
  }));
  await page.screenshot({ path: `qa/intro/${name}.png` });
  const bounds = await page.evaluate(() =>
    [...document.querySelectorAll('.vs-info, .vs-portrait, .vs-skip')].map((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }),
  );
  expect(bounds.every(Boolean)).toBe(true);
  expect(
    await page.locator('.vs-fighter').evaluateAll((nodes) =>
      nodes.every((el) => {
        const art = el.querySelector('.vs-art').getBoundingClientRect();
        const info = el.querySelector('.vs-info').getBoundingClientRect();
        return art.bottom <= info.top + 1;
      }),
    ),
  ).toBe(true);
  await page.locator('[data-intro-skip]').click();
  await available(page);
  await reset(page);
}
try {
  await fs.mkdir('qa/intro', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await context();
  const page = await boot(ctx);
  await page.locator('[data-action=opponent][data-id=charizard]').click();
  const timing = await page.evaluate(async () => {
    const app = window.__introQA;
    app.setSetting('speed', 3);
    const begin = performance.now();
    const first = app.start();
    const id = app.battle.battleId;
    await app.start();
    await app.start();
    const unchanged = id === app.battle.battleId;
    const locked = app.busy && app.introActive && app.root.inert;
    await app.turn(0);
    await first;
    return {
      ms: performance.now() - begin,
      unchanged,
      locked,
      turn: app.battle.turn,
      focused: document.activeElement.matches('.move-button'),
    };
  });
  expect(timing.unchanged && timing.locked && timing.focused).toBe(true);
  expect(timing.turn).toBe(1);
  expect(timing.ms).toBeGreaterThan(1550);
  expect(timing.ms).toBeLessThan(5200);
  checks.push(
    'Normal intro at 3× remains 1.65s; repeated Start and turn commands guarded; move focus restored',
  );
  await reset(page);
  await page.locator('[data-action=start]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-intro-skip]')).toBeFocused();
  await page.keyboard.down('Space');
  await available(page);
  await page.keyboard.press('1'); // held Space must not leak into newly enabled commands
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__introQA.battle.turn)).toBe(1);
  expect(await page.evaluate(() => Boolean(window.__introQA.skipping))).toBe(false);
  checks.push(
    'Escape suppressed, focus trapped, Space skip and key release do not submit a turn or set VFX skip state',
  );
  await reset(page);
  await capture(page, 'desktop-pikachu-charizard', { width: 1440, height: 900 });
  // Exercise both larger sprites via normal save ownership, with no content edits.
  await page.evaluate(async () => {
    const app = window.__introQA;
    const { ownedInstance } = await import('./src/domain/progression.js');
    app.save.collection = [
      ownedInstance('charizard', {
        seed: 42,
        instanceId: crypto.randomUUID(),
        acquiredAt: new Date().toISOString(),
      }),
    ];
    app.selectedId = app.save.collection[0].instanceId;
    app.opponentId = 'blastoise';
    app.render();
  });
  await capture(page, 'desktop-charizard-blastoise', { width: 1280, height: 800 });
  await capture(page, 'mobile-charizard-blastoise', { width: 390, height: 844 });
  await capture(page, 'narrow-charizard-blastoise', { width: 600, height: 800 });
  await capture(page, 'landscape-charizard-blastoise', { width: 844, height: 390 });
  checks.push(
    'Button Skip, large-species aspect fit, desktop/narrow/mobile/landscape captures without clipped layout bounds',
  );
  await page.evaluate(() => {
    const app = window.__introQA;
    app.tempSettings = { ...app.settings, reducedMotion: true };
    app.save.settings.reducedMotion = true;
    app.applySettings();
  });
  const reduced = await page.evaluate(async () => {
    const app = window.__introQA,
      begin = performance.now();
    await app.start();
    return performance.now() - begin;
  });
  expect(reduced).toBeLessThan(1600);
  await available(page);
  checks.push('Reduced Motion completes a short static reveal');
  await reset(page);
  const cancelled = await page.evaluate(async () => {
    const app = window.__introQA;
    app.save.settings.reducedMotion = false;
    const original = app.scene.setActors.bind(app.scene);
    let release;
    app.scene.setActors = () =>
      new Promise((r) => {
        release = r;
      });
    const old = app.start();
    await Promise.resolve();
    app.go('setup');
    app.scene.setActors = original;
    const current = app.start();
    const id = app.battle.battleId;
    release();
    await old;
    const guarded = app.introActive && app.battle.battleId === id;
    app.intro.skip();
    await current;
    return guarded && !app.busy && !app.root.inert;
  });
  expect(cancelled).toBe(true);
  checks.push(
    'Cancelled startup cannot unlock or replace a newer intro when preparation resolves late',
  );
  await ctx.close();
  // Independent normal save for a complete battle + replay.
  const playCtx = await context();
  const play = await boot(playCtx);
  await play.selectOption('#difficulty', 'easy');
  await play.locator('[data-action=start]').click();
  await play.locator('[data-intro-skip]').click();
  await available(play);
  await play.locator('.move-button').filter({ hasText: 'Thunderbolt' }).click();
  await play.waitForFunction(() => window.__introQA.scene.effects.length > 0);
  await play.keyboard.press('Space');
  await play.waitForFunction(() => !window.__introQA.busy);
  expect(await play.evaluate(() => window.__introQA.scene.fx.children.length)).toBe(0);
  let turns = 0;
  while (await play.locator('.battle-screen').count()) {
    if (++turns > 65) throw Error('Battle did not finish');
    await play.locator('.move-button:not([disabled])').first().click();
    await play.keyboard.press('Space');
    await play.waitForFunction(() => !window.__introQA.busy);
  }
  const prior = await play.evaluate(() => window.__introQA.battle.battleId);
  await play.locator('[data-action=replay]').click();
  await expect(play.locator('.vs-intro')).toBeVisible();
  await play.locator('[data-intro-skip]').click();
  await available(play);
  expect(await play.evaluate(() => window.__introQA.battle.battleId)).not.toBe(prior);
  checks.push(
    'Phase A real VFX and turn Space Skip still clear effects; completed battle and Results replay produce a fresh intro',
  );
  await playCtx.close();
  const fallbackCtx = await context(
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    true,
  );
  await fallbackCtx.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind.startsWith('webgl')) return null;
      return original.call(this, kind, ...args);
    };
  });
  const fallback = await boot(fallbackCtx);
  await fallback.locator('[data-action=start]').tap();
  await fallback.waitForSelector('.vs-intro[data-state=playing]');
  expect(await fallback.locator('.vs-portrait[data-missing=true]').count()).toBe(2);
  await fallback.locator('[data-intro-skip]').tap();
  await available(fallback);
  await fallback.locator('.move-button').first().tap();
  await fallback.locator('[data-action=skip]').tap();
  await fallback.waitForFunction(() => !window.__introQA.busy);
  expect(await fallback.evaluate(() => Boolean(window.__introQA.graphicsError))).toBe(true);
  checks.push(
    'Missing front portraits + unavailable WebGL still introduce and play a battle; touch Skip works',
  );
  await fallbackCtx.close();
  expect(errors).toEqual([]);
  checks.push(
    'Repository-subpath URLs preserved, no unexpected external requests or uncaught browser exceptions',
  );
  await fs.writeFile(
    'qa/intro/results.json',
    JSON.stringify({ passed: true, checks, timing, reduced, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks, timing, reduced }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
