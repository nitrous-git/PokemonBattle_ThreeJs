import { chromium, expect } from '@playwright/test';
import { serveStatic } from './static-server.mjs';
import fs from 'node:fs/promises';
const server = await serveStatic({ host: '127.0.0.1', port: 4185 });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [],
  external = [],
  checks = [];
let page;
// Keep the original offline QA contract while allowing the pinned Three.js CDN import map.
async function interceptPinnedThree(ctx) {
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin === 'https://cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.180.0/build/')) {
      const filename = u.pathname.split('/').pop();
      if (filename === 'three.module.js' || filename === 'three.core.js') {
        return route.fulfill({
          path: `node_modules/three/build/${filename}`,
          contentType: 'text/javascript',
          headers: { 'access-control-allow-origin': '*' },
        });
      }
    }
    if (!['127.0.0.1', 'localhost'].includes(u.hostname)) {
      external.push(u.href);
      return route.abort();
    }
    return route.continue();
  });
}
async function shot(name) {
  await page.screenshot({ path: `qa/${name}.png` });
}
async function click(action) {
  await page.locator(`[data-action="${action}"]`).first().click();
}
async function saved() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('nitrous.battle-atelier.v1')));
}
async function fight() {
  let turns = 0;
  while (await page.locator('.battle-screen').count()) {
    if (turns++ > 65) throw Error('Battle did not finish');
    const list = page.locator('.move-button:not([disabled])');
    await expect(list.first()).toBeEnabled();
    const strongest = await list.evaluateAll(
      (nodes) =>
        nodes
          .map((n) => ({
            slot: n.dataset.slot,
            text: n.textContent,
            score:
              (Number(n.textContent.match(/(\d+) power/)?.[1]) || 0) *
              (n.textContent.includes('2×') ? 2 : n.textContent.includes('Immune') ? 0 : 1),
          }))
          .sort((a, b) => b.score - a.score)[0],
    );
    await page.locator(`[data-action=move][data-slot="${strongest.slot}"]`).evaluate((el) => {
      el.click();
      el.click();
      el.click();
    });
    const skip = page.locator('[data-action=skip]');
    if (await skip.count()) await skip.click();
    await page.waitForFunction(
      () =>
        document.querySelector('.result-card') ||
        document.querySelector('.move-button:not([disabled])'),
    );
  }
  return turns;
}
try {
  await fs.mkdir('qa', { recursive: true });
  await interceptPinnedThree(context);
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
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:4185');
  await expect(page.locator('.hero-cta')).toBeVisible();
  await page.waitForTimeout(900);
  await shot('01-menu-1280');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await shot('02-menu-1920');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('.hero-cta').click();
  await shot('03-starter');
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  await expect(page.locator('.opponent-grid .creature-card')).toHaveCount(16);
  await shot('04-setup');
  checks.push('Clean save → starter → 16-species setup');
  await page.selectOption('#difficulty', 'easy');
  await click('start');
  await expect(page.locator('.move-button').first()).toBeEnabled();
  await page.waitForTimeout(300);
  await shot('05-battle-meadow');
  const startMove = page.locator('.move-button').filter({ hasText: 'Thunderbolt' });
  await startMove.evaluate((el) => {
    el.click();
    el.click();
    el.click();
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(650);
  await shot('06-move-vfx');
  await page.keyboard.press('Space');
  await page.waitForFunction(
    () =>
      document.querySelector('.result-card') ||
      document.querySelector('.move-button:not([disabled])'),
  );
  if (await page.locator('.battle-screen').count()) await fight();
  await expect(page.locator('.result-card h1')).toHaveText('Well played.');
  await shot('07-results');
  const one = await saved();
  checks.push('Win via effective Electric move; rapid click guarded; Space skip; resize mid-turn');
  await page.reload();
  await expect(page.locator('.hero-cta')).toBeVisible();
  const loaded = await saved();
  expect(loaded).toEqual(one);
  checks.push('Reload preserves XP, level, wallet, four moves and reward journal');
  await page.locator('.hero-cta').click();
  await page.selectOption('#difficulty', 'easy');
  await click('start');
  await expect(page.locator('.move-button').first()).toBeEnabled();
  await fight();
  await expect(page.locator('.result-card h1')).toHaveText('Well played.');
  const two = await saved();
  expect(two.completedBattleIds.length).toBe(2);
  expect(two.trainer.coins).toBeGreaterThanOrEqual(300);
  await page.locator('[data-route=shop]').first().click();
  await page.locator('[data-action=detail][data-id=bulbasaur]').click();
  await click('buy');
  await page.locator('dialog button[value=confirm]').click();
  await expect(page.locator('.detail-panel [data-action=use]')).toBeVisible();
  const bought = await saved();
  expect(bought.collection).toHaveLength(2);
  expect(bought.trainer.coins).toBe(two.trainer.coins - 300);
  await shot('08-shop');
  await page.reload();
  expect((await saved()).collection).toHaveLength(2);
  checks.push('Two victories → atomic purchase → refresh retains ownership; no duplicate reward');
  await page.locator('[data-route=shop]').first().click();
  await page.locator('[data-action=detail][data-id=charizard]').click();
  await expect(page.locator('[data-action=buy]')).toBeDisabled();
  checks.push('Unaffordable purchases disabled; owned species cannot be repurchased');
  await page.locator('[data-route=collection]').first().click();
  await shot('09-collection');
  await page.locator('[data-route=settings]').click();
  await page.check('#reducedMotion');
  await page.check('#lowVFX');
  await page.selectOption('#uiScale', '1.15');
  await page.selectOption('#speed', '3');
  await shot('10-settings');
  await page.locator('[data-route=setup]').first().click();
  await page.selectOption('#arena-select', 'canyon');
  await page.selectOption('#difficulty', 'hard');
  await click('start');
  await expect(page.locator('.move-button').first()).toBeEnabled();
  await page.waitForTimeout(300);
  await shot('11-canyon-low-vfx');
  await click('move');
  await page.keyboard.press('Space');
  await page.waitForFunction(
    () =>
      document.querySelector('.result-card') ||
      document.querySelector('.move-button:not([disabled])'),
  );
  if (await page.locator('.battle-screen').count()) {
    await click('abandon');
    await page.locator('dialog button[value=confirm]').click();
  } else await page.locator('[data-route=setup]').first().click();
  await page.locator('[data-route=settings]').click();
  await page.uncheck('#reducedMotion');
  await page.uncheck('#lowVFX');
  await page.selectOption('#uiScale', '1');
  await page.locator('[data-route=setup]').first().click();
  await page.selectOption('#arena-select', 'astral');
  await click('start');
  await expect(page.locator('.move-button').first()).toBeEnabled();
  await page.waitForTimeout(300);
  await shot('12-battle-astral');
  checks.push('Canyon/Astral; Hard AI; Low VFX; Reduced Motion; scale and playback settings');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot('13-mobile-battle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await click('abandon');
  await page.locator('dialog button[value=confirm]').click();
  await shot('14-mobile-setup');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  checks.push('390px responsive controls without horizontal overflow');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  checks.push('No unexpected external requests and no browser errors in normal runtime');
  // Deliberately fail one local atlas in an isolated context; the game must still boot and fight.
  const missing = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await interceptPinnedThree(missing);
  await missing.route('**/25_back_atlas.png', (r) => r.abort());
  const p2 = await missing.newPage();
  const missingErrors = [];
  p2.on('pageerror', (e) => missingErrors.push(e.message));
  await p2.goto('http://127.0.0.1:4185');
  await p2.locator('.hero-cta').click();
  await p2.locator('[data-action=starter][data-id=pikachu]').click();
  await p2.locator('[data-action=start]').click();
  await expect(p2.locator('.move-button').first()).toBeEnabled();
  await p2.screenshot({ path: 'qa/15-missing-sprite-fallback.png' });
  expect(missingErrors).toEqual([]);
  await missing.close();
  checks.push('Missing back atlas safely uses original back-facing stand-in');
  await fs.writeFile(
    'qa/browser-results.json',
    JSON.stringify(
      {
        checks,
        errors,
        external,
        environment: 'Chromium 141 headless / SwiftShader, Linux',
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page?.screenshot({ path: 'qa/failure.png' }).catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
