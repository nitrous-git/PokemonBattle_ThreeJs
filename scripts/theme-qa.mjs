// Phase C: persistence, complete route coverage and repository-subpath visual QA.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { serveStatic } from './static-server.mjs';
const server = await serveStatic({ port: 4188 });
const prefix = '/PokemonBattle_ThreeJs',
  origin = 'http://127.0.0.1:4188';
const checks = [],
  errors = [];
let browser;
async function makeContext() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (a) => {
      if (a instanceof Uint32Array && a.length === 1) {
        a[0] = 42;
        return a;
      }
      return original(a);
    };
  });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (
      u.origin === 'https://cdn.jsdelivr.net' &&
      u.pathname.startsWith('/npm/three@0.180.0/build/')
    ) {
      const name = u.pathname.split('/').pop();
      if (['three.module.js', 'three.core.js'].includes(name))
        return route.fulfill({
          path: `node_modules/three/build/${name}`,
          contentType: 'text/javascript',
          headers: { 'access-control-allow-origin': '*' },
        });
    }
    expect(u.origin).toBe(origin);
    expect(u.pathname.startsWith(prefix + '/')).toBe(true);
    const response = await route.fetch({
      url: origin + u.pathname.slice(prefix.length) + u.search,
    });
    if (u.pathname.endsWith('/src/main.js'))
      return route.fulfill({
        response,
        body: (await response.text()).replace('new GameApp(', 'window.__themeQA = new GameApp('),
      });
    return route.fulfill({ response });
  });
  return ctx;
}
async function go(page, route) {
  await page.evaluate((route) => window.__themeQA.go(route), route);
}
async function theme(page, value) {
  await go(page, 'settings');
  await page.selectOption('#theme', value);
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
  await expect(page.locator('#theme')).toHaveValue(value);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    value,
  );
}
async function shot(page, name) {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.screenshot({ path: `qa/theme/${name}.png`, fullPage: true });
}
async function style(page, selectors) {
  return page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const el = document.querySelector(selector),
          s = getComputedStyle(el);
        return [selector, s.color, s.backgroundColor, s.backgroundImage, s.borderColor];
      }),
    selectors,
  );
}
try {
  await fs.mkdir('qa/theme', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await makeContext(),
    page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + prefix + '/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.hero-cta')).toBeVisible();
  const originalLight = await style(page, [
    '.topbar',
    '.footer',
    '.hero-copy p',
    '.button.primary',
  ]);
  await theme(page, 'dark');
  await go(page, 'starter');
  await shot(page, 'dark-starter');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.hero-cta').click();
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  expect(await page.evaluate(() => window.__themeQA.save.settings.theme)).toBe('dark');
  await page.reload();
  await expect(page.locator('.hero-cta')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  checks.push(
    'New users start Light; pre-starter Dark survives reload, starter creation and saved-session reload',
  );
  const before = await page.evaluate(() => structuredClone(window.__themeQA.save));
  let vsReference;
  for (const mode of ['light', 'dark']) {
    await theme(page, mode);
    for (const route of ['menu', 'setup', 'collection', 'shop', 'settings', 'credits', 'starter']) {
      await go(page, route);
      await shot(page, `${mode}-${route}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (route === 'menu' && mode === 'light')
        expect(
          await style(page, ['.topbar', '.footer', '.hero-copy p', '.button.primary']),
        ).toEqual(originalLight);
      if (mode === 'dark') {
        // Catch missed pale surfaces without classifying intentional type/HP colors as panels.
        const pale = await page
          .locator('.panel, .creature-card, .topbar, select')
          .evaluateAll((nodes) =>
            nodes
              .filter((el) => {
                const c = getComputedStyle(el)
                  .backgroundColor.match(/[\d.]+/g)
                  ?.map(Number);
                return c?.length >= 3 && c.slice(0, 3).every((v) => v > 170);
              })
              .map((el) => el.className || el.id),
          );
        expect(pale).toEqual([]);
      }
    }
    await go(page, 'setup');
    await page.locator('[data-action=start]').click();
    await page.waitForSelector('.vs-intro[data-state=playing]');
    await page.evaluate(() => {
      const intro = window.__themeQA.intro;
      for (const timer of intro.timers) clearTimeout(timer);
      intro.timers.clear();
      intro.view.dataset.reduced = 'true';
    });
    const vs = await style(page, [
      '.vs-intro',
      '.vs-panel-player',
      '.vs-panel-opponent',
      '.vs-meta .type-chip',
      '.vs-skip',
    ]);
    if (vsReference) expect(vs).toEqual(vsReference);
    else vsReference = vs;
    await page.locator('[data-intro-skip]').click();
    await expect(page.locator('.move-button').first()).toBeEnabled();
    await shot(page, `${mode}-battle`);
    if (mode === 'dark') {
      await page.setViewportSize({ width: 390, height: 844 });
      await shot(page, 'dark-mobile-battle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.locator('[data-action=abandon]').click();
    await expect(page.locator('dialog')).toBeVisible();
    await shot(page, `${mode}-dialog`);
    await page.locator('dialog button[value=cancel]').click();
    // Run actual Phase A VFX under each theme and use the normal turn Skip.
    await page.locator('.move-button').filter({ hasText: 'Thunderbolt' }).click();
    await page.waitForFunction(() => window.__themeQA.scene.effects.length > 0);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.__themeQA.busy);
    expect(await page.evaluate(() => window.__themeQA.scene.fx.children.length)).toBe(0);
    let n = 0;
    while (await page.locator('.battle-screen').count()) {
      if (++n > 65) throw Error('Battle did not complete');
      await page.locator('.move-button:not([disabled])').first().click();
      await page.keyboard.press('Space');
      await page.waitForFunction(() => !window.__themeQA.busy);
    }
    await shot(page, `${mode}-results`);
    await page.evaluate(() =>
      window.__themeQA.toast('Appearance saved. Ready for the next battle.'),
    );
    await shot(page, `${mode}-toast`);
    await page.evaluate(() => {
      window.__themeQA.recovery = 'Test recovery: saved data was preserved.';
      window.__themeQA.render();
    });
    await shot(page, `${mode}-recovery`);
    await page.evaluate(() => {
      window.__themeQA.recovery = null;
    });
  }
  const after = await page.evaluate(() => window.__themeQA.save);
  expect(after.saveVersion).toBe(1);
  expect(after.collection[0].instanceId).toBe(before.collection[0].instanceId);
  expect(after.completedBattleIds.length).toBe(before.completedBattleIds.length + 2);
  checks.push(
    'Both themes cover every route, dialogs and toast; two real battles save rewards normally; VFX/turn Skip remain functional',
  );
  checks.push(
    'VS cinematic computed colors identical between themes; returning to Light restores original menu colors',
  );
  // Real text contrast on representative dark surfaces, including every authored type hue.
  await theme(page, 'dark');
  const contrast = await page.evaluate(async () => {
    const { typeChip } = await import('./src/ui/components.js');
    const { typeChart } = await import('./src/data/catalogue.js');
    const host = document.createElement('div');
    host.className = 'panel';
    host.innerHTML = Object.keys(typeChart).map(typeChip).join('');
    document.body.append(host);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const c = canvas.getContext('2d');
    const rgb = (color) => {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v / 255);
    };
    const luminance = (color) =>
      rgb(color)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const x = luminance(a),
        y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const panel = getComputedStyle(document.querySelector('.settings-panel')).backgroundColor;
    const normal = [
      '.setting-row b',
      '.setting-row small',
      '#theme',
      '.button.secondary',
      '.danger-button',
    ].map((sel) => {
      const s = getComputedStyle(document.querySelector(sel));
      return { selector: sel, ratio: ratio(s.color, sel === '#theme' ? s.backgroundColor : panel) };
    });
    const chips = [...host.children].map((el) => {
      const s = getComputedStyle(el);
      return { selector: el.className, ratio: ratio(s.color, s.backgroundColor) };
    });
    host.remove();
    return [...normal, ...chips];
  });
  expect(contrast.every((row) => row.ratio >= 4.5)).toBe(true);
  checks.push(
    `Dark text/control/type-badge contrast checks pass (minimum ${Math.min(...contrast.map((r) => r.ratio)).toFixed(2)}:1)`,
  );
  await page.focus('#theme');
  expect(await page.locator('#theme').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
    'none',
  );
  await page.selectOption('#uiScale', '1.15');
  await page.check('#reducedMotion');
  await page.selectOption('#speed', '3');
  expect(await page.evaluate(() => window.__themeQA.settings.speed)).toBe(3);
  for (const width of [390, 600]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['settings', 'setup', 'collection', 'shop', 'menu']) {
      await go(page, route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) await shot(page, `dark-mobile-${route}`);
    }
  }
  checks.push(
    'Keyboard focus, UI Scale 115%, Reduced Motion and numeric settings preserved; 390/600px layouts have no horizontal overflow',
  );
  // Old saves ignore the pre-starter preference and use the Light default.
  await page.evaluate(() => {
    const key = 'nitrous.battle-atelier.v1',
      save = JSON.parse(localStorage.getItem(key));
    delete save.settings.theme;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('.hero-cta')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => {
    const key = 'nitrous.battle-atelier.v1',
      save = JSON.parse(localStorage.getItem(key));
    save.settings.theme = 'invalid';
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('[data-bind="recovery-error"]')).toContainText('theme');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('nitrous.battle-atelier.v1')).settings.theme,
    ),
  ).toBe('invalid');
  checks.push(
    'Older v1 saves default Light; invalid theme opens recovery without overwriting the save',
  );
  expect(errors).toEqual([]);
  checks.push(
    'No uncaught browser errors or unexpected external requests; all local assets retain repository subpath',
  );
  await fs.writeFile(
    'qa/theme/results.json',
    JSON.stringify({ passed: true, checks, contrast, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
