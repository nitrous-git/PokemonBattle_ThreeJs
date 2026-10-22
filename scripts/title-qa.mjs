// Title-screen integration, lifecycle and responsive QA under a GitHub Pages subpath.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { serveStatic } from './static-server.mjs';

const server = await serveStatic({ port: 4191 });
const origin = 'http://127.0.0.1:4191';
const prefix = '/PokemonBattle_ThreeJs';
const errors = [],
  checks = [];
let browser;
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ...options });
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
    expect(url.origin).toBe(origin);
    expect(url.pathname.startsWith(prefix + '/')).toBe(true);
    const response = await route.fetch({
      url: origin + url.pathname.slice(prefix.length) + url.search,
    });
    expect(response.status()).toBe(200);
    if (url.pathname.endsWith('/src/main.js'))
      return route.fulfill({
        response,
        body: (await response.text()).replace('new GameApp(', 'window.__titleQA = new GameApp('),
      });
    return route.fulfill({ response });
  });
  return ctx;
}
async function go(page, route) {
  await page.evaluate((route) => window.__titleQA.go(route), route);
}
async function shot(page, name) {
  await page.screenshot({ path: `qa/title/${name}.png` });
}
async function noClipping(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const play = await page.locator('.title-play').boundingBox();
  const footer = await page.locator('.footer').boundingBox();
  expect(play.x).toBeGreaterThanOrEqual(0);
  expect(play.y + play.height).toBeLessThanOrEqual(footer.y);
  expect(play.y + play.height).toBeLessThanOrEqual(page.viewportSize().height);
}
try {
  await fs.mkdir('qa/title', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await context();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(origin + prefix + '/');
  await expect(page.getByRole('heading', { name: 'Battle Atelier', exact: true })).toBeVisible();
  await expect(page.locator('.title-canvas')).toBeVisible();
  await page.waitForFunction(() => window.__titleQA?.titleScene?.renderer.info.render.frame > 1);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__titleQA.scene.active)).toBe(false);
  await noClipping(page);
  await shot(page, '01-desktop');
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [360, 640],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await noClipping(page);
    await shot(page, `responsive-${width}x${height}`);
  }
  checks.push(
    'Desktop, laptop, tablet, 320–390px phones and landscape: visible PLAY, no horizontal overflow',
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('.title-play').focus();
  expect(await page.locator('.title-play').evaluate((el) => el.matches(':focus-visible'))).toBe(
    true,
  );
  await page.evaluate(() => {
    window.oldTitle = window.__titleQA.titleScene;
    window.stableArena = document.querySelector('#arena');
  });
  await page.keyboard.press('Enter');
  await expect(page.locator('.starter-page')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.oldTitle.disposed &&
        window.oldTitle.raf === null &&
        !window.oldTitle.canvas.isConnected &&
        window.__titleQA.scene.active,
    ),
  ).toBe(true);
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  await expect(page.locator('.setup-page')).toBeVisible();
  checks.push('Keyboard PLAY → starter → setup; title disposed and original arena resumes');
  const save = await page.evaluate(() => localStorage.getItem('nitrous.battle-atelier.v1'));
  for (const route of ['collection', 'shop', 'settings', 'credits']) {
    await go(page, route);
    await expect(page.locator('.page')).toBeVisible();
  }
  for (const theme of ['light', 'dark']) {
    await go(page, 'settings');
    await page.selectOption('#theme', theme);
    await go(page, 'menu');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.title-canvas')).toBeVisible();
    await shot(page, `theme-${theme}`);
    await page.locator('.title-play').click();
    await expect(page.locator('.setup-page')).toBeVisible();
  }
  expect(await page.evaluate(() => document.querySelector('#arena') === window.stableArena)).toBe(
    true,
  );
  const after = await page.evaluate(() => localStorage.getItem('nitrous.battle-atelier.v1'));
  expect(JSON.parse(after).collection).toEqual(JSON.parse(save).collection);
  expect(JSON.parse(after).trainer).toEqual(JSON.parse(save).trainer);
  checks.push(
    'Returning PLAY → setup; header routes, wallet/save, Light/Dark and stable #arena preserved',
  );
  for (let i = 0; i < 8; i++) {
    await go(page, 'menu');
    await page.evaluate(() => window.__titleQA.render());
    await expect(page.locator('.title-canvas')).toHaveCount(1);
    expect(
      await page.evaluate(() => window.__titleQA.titleScene.renderer.info.memory.geometries),
    ).toBe(1);
    await go(page, 'settings');
    expect(await page.evaluate(() => window.__titleQA.titleScene)).toBe(null);
  }
  checks.push('Repeated enter/render/leave: one title canvas/geometry, disposal on every exit');
  await page.check('#reducedMotion');
  await page.check('#lowVFX');
  await go(page, 'menu');
  expect(await page.evaluate(() => window.__titleQA.titleScene.raf)).toBe(null);
  const frame = await page.evaluate(() => window.__titleQA.titleScene.renderer.info.render.frame);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__titleQA.titleScene.renderer.info.render.frame)).toBe(
    frame,
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(() => {
      const c = window.__titleQA.titleScene.canvas;
      return c.width * c.height <= 900000;
    }),
  ).toBe(true);
  await shot(page, 'reduced-low-vfx');
  await go(page, 'settings');
  await page.uncheck('#reducedMotion');
  await go(page, 'menu');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__titleQA.titleScene.reduced);
  expect(await page.evaluate(() => window.__titleQA.titleScene.raf)).toBe(null);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.__titleQA.titleScene.reduced);
  expect(await page.evaluate(() => window.__titleQA.titleScene.raf !== null)).toBe(true);
  checks.push('Saved and live OS reduced motion render statically; Low VFX pixel budget respected');
  // Simulated background-tab visibility uses the same listener path as the browser.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.__titleQA.titleScene.raf)).toBe(null);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => window.__titleQA.titleScene.raf !== null)).toBe(true);
  await page.evaluate(() => {
    const title = window.__titleQA.titleScene;
    window.loseTitle = title.renderer.getContext().getExtension('WEBGL_lose_context');
    window.loseTitle.loseContext();
  });
  await expect(page.locator('.title-canvas')).toBeHidden();
  await expect(page.locator('.title-play')).toBeVisible();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.loseTitle.restoreContext());
  await expect(page.locator('.title-canvas')).toBeVisible();
  checks.push('Hidden tab stops animation; WebGL context loss shows CSS fallback and restores');
  await page.reload();
  await expect(page.locator('.title-play')).toBeVisible();
  await page.locator('.title-play').click();
  await expect(page.locator('.setup-page')).toBeVisible();
  checks.push('Saved-game reload and repository-subpath requests work');
  expect(errors).toEqual([]);
  const fallback = await context();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : original.call(this, type, ...args);
    };
  });
  const p2 = await fallback.newPage();
  const fallbackErrors = [];
  p2.on('pageerror', (e) => fallbackErrors.push(e.message));
  await p2.goto(origin + prefix + '/');
  await expect(p2.locator('.title-play')).toBeVisible();
  await expect(p2.locator('.title-canvas')).toHaveCount(0);
  await shot(p2, 'no-webgl');
  await p2.locator('.title-play').click();
  await expect(p2.locator('.starter-page')).toBeVisible();
  expect(fallbackErrors).toEqual([]);
  await fallback.close();
  checks.push('WebGL unavailable: CSS horizon, SVG logo and starter navigation remain usable');
  console.log(
    JSON.stringify(
      { passed: true, checks, errors, environment: `Chromium ${browser.version()}, SwiftShader` },
      null,
      2,
    ),
  );
  await fs.writeFile(
    'qa/title/results.json',
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
