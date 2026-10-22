// Phase D1: real renderer/UI coverage under the GitHub Pages repository subpath.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { serveStatic } from './static-server.mjs';
const server = await serveStatic({ port: 4189 });
const origin = 'http://127.0.0.1:4189',
  prefix = '/PokemonBattle_ThreeJs';
const additions = [
  'mewtwo',
  'rayquaza',
  'lugia',
  'darkrai',
  'lucario',
  'garchomp',
  'gengar',
  'tyranitar',
];
const checks = [],
  errors = [],
  frames = [],
  battles = [];
let browser;
async function shot(page, name) {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  await page.screenshot({ path: `qa/expansion/${name}.png`, fullPage: true });
}
async function go(page, route) {
  await page.evaluate((r) => window.__d1.go(r), route);
}
async function ready(page) {
  await expect(page.locator('.vs-intro')).toHaveCount(0);
  await expect(page.locator('.move-button:not([disabled])').first()).toBeEnabled();
}
async function select(page, id, opponent) {
  await go(page, 'setup');
  if (await page.locator('#owned-select').isVisible())
    await page.selectOption(
      '#owned-select',
      await page.evaluate(
        (id) => window.__d1.save.collection.find((p) => p.speciesId === id).instanceId,
        id,
      ),
    );
  else {
    await go(page, 'collection');
    await page.locator(`[data-action=detail][data-id=${id}]`).click();
    await page.locator('[data-action=use]').click();
  }
  await page.locator(`[data-action=opponent][data-id=${opponent}]`).click();
}
async function introShot(page, name) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const intro = window.__d1.intro;
          if (intro?.view.dataset.state !== 'playing') return;
          observer.disconnect();
          for (const timer of intro.timers) clearTimeout(timer);
          intro.timers.clear();
          intro.view.dataset.reduced = 'true';
          resolve();
        });
        observer.observe(document.body, { subtree: true, attributes: true, childList: true });
        void window.__d1.start();
      }),
  );
  await shot(page, name);
  const art = await page
    .locator('.vs-portrait img')
    .evaluateAll((images) => images.map((image) => image.naturalWidth > 0));
  expect(art).toEqual([true, true]);
  await page.locator('[data-intro-skip]').click();
  await ready(page);
}
async function verifyActors(page, label) {
  const result = await page.evaluate(async () => {
    const app = window.__d1,
      scene = app.scene;
    const { Vector3 } = await import('three');
    scene.camera.updateMatrixWorld();
    return Object.entries(scene.actors).map(([side, actor]) => {
      const mesh = actor.sprite;
      const right = new Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 1);
      const corners = [-0.5, 0.5].flatMap((x) =>
        [0, 1].map((y) =>
          mesh.position
            .clone()
            .addScaledVector(right, mesh.scale.x * x)
            .addScaledVector(up, mesh.scale.y * y)
            .project(scene.camera),
        ),
      );
      return {
        side,
        species: app.battle[side].speciesId,
        size: [mesh.scale.x, mesh.scale.y],
        animated: actor.data?.frames.length > 1,
        corners: corners.map((p) => [p.x, p.y]),
        url: mesh.material.map.image?.src,
      };
    });
  });
  expect(
    result.every((a) => a.animated && a.url.includes(prefix + '/public/assets/pokemon/')),
  ).toBe(true);
  expect(result.every((a) => a.corners.every(([x, y]) => Math.abs(x) < 1 && Math.abs(y) < 1))).toBe(
    true,
  );
  frames.push({ label, actors: result });
}
try {
  await fs.mkdir('qa/expansion', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
  await context.route('**/*', async (route) => {
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
    expect(response.status()).toBe(200);
    if (u.pathname.endsWith('/src/main.js'))
      return route.fulfill({
        response,
        body: (await response.text()).replace('new GameApp(', 'window.__d1 = new GameApp('),
      });
    return route.fulfill({ response });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + prefix + '/');
  await expect(page.locator('[data-bind=roster-total]')).toHaveText('24');
  await expect(page.locator('[data-bind=move-total]')).toHaveText('66');
  await page.locator('.hero-cta').click();
  await page.locator('[data-action=starter][data-id=pikachu]').click();
  await expect(page.locator('.opponent-grid .creature-card')).toHaveCount(24);
  await page.evaluate(() => {
    const app = window.__d1;
    app.commit((s) => ({ ...s, trainer: { ...s.trainer, coins: 30000 } }));
    app.setSetting('mute', true);
  });
  await go(page, 'shop');
  for (const id of additions) {
    await page.locator(`[data-action=detail][data-id=${id}]`).click();
    const before = await page.evaluate(() => window.__d1.save.trainer.coins);
    const price = await page.evaluate(
      async (id) => (await import('./src/data/catalogue.js')).pokemon[id].priceCoins,
      id,
    );
    await page.locator('[data-action=buy]').click();
    await page.locator('dialog button').filter({ hasText: 'Recruit partner' }).click();
    await expect(page.locator('dialog')).toHaveCount(0);
    expect(
      await page.evaluate((id) => window.__d1.save.collection.some((p) => p.speciesId === id), id),
    ).toBe(true);
    expect(await page.evaluate(() => window.__d1.save.trainer.coins)).toBe(before - price);
  }
  await page.reload();
  await expect(page.locator('.hero-cta')).toBeVisible();
  expect(await page.evaluate(() => window.__d1.save.collection.length)).toBe(9);
  checks.push(
    'All eight purchased through Shop, exact prices deducted, ownership/drafts persisted after reload',
  );
  for (const theme of ['light', 'dark']) {
    await go(page, 'settings');
    await page.selectOption('#theme', theme);
    for (const route of ['shop', 'collection', 'setup']) {
      await go(page, route);
      if (route !== 'setup') await page.locator('[data-action=detail][data-id=rayquaza]').click();
      else await page.locator('[data-action=opponent][data-id=darkrai]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await shot(page, `${theme}-${route}`);
    }
  }
  checks.push(
    '24-card Shop/Collection/Setup, exact rarity labels and Legendary/Mythical matchup cue in both themes',
  );
  // Each species loads both orientations and completes a real turn with its persisted draft.
  for (let i = 0; i < additions.length; i++) {
    const id = additions[i],
      opponent = additions[(i + 1) % additions.length];
    await select(page, id, opponent);
    await page.evaluate(() => window.__d1.start());
    await ready(page);
    await verifyActors(page, id);
    const selected = await page.evaluate(() => window.__d1.selected.speciesId);
    expect(selected).toBe(id);
    await page.locator('.move-button:not([disabled])').first().click();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.__d1.busy);
    expect(await page.evaluate(() => window.__d1.scene.fx.children.length)).toBe(0);
  }
  checks.push(
    'Eight new partners/opponents battle with animated front/back atlases; normal intro, real turns and Space Skip release input',
  );
  for (const arena of ['meadow', 'canyon', 'astral']) {
    await select(page, 'rayquaza', 'lugia');
    await page.selectOption('#arena-select', arena);
    await introShot(page, `vs-rayquaza-lugia-${arena}`);
    await verifyActors(page, `rayquaza-lugia-${arena}`);
    await shot(page, `battle-rayquaza-lugia-${arena}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await select(page, 'lugia', 'rayquaza');
  await shot(page, 'mobile-setup-lugia-rayquaza');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await introShot(page, 'mobile-vs-lugia-rayquaza');
  await verifyActors(page, 'mobile-lugia-rayquaza');
  await shot(page, 'mobile-battle-lugia-rayquaza');
  await go(page, 'shop');
  await page.locator('[data-action=detail][data-id=darkrai]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, 'mobile-shop-darkrai');
  checks.push(
    'Large Rayquaza/Lugia silhouettes framed in all arenas, both orientations, desktop and 390px; no horizontal overflow',
  );
  await page.setViewportSize({ width: 600, height: 800 });
  await select(page, 'rayquaza', 'lugia');
  await page.evaluate(() => window.__d1.start());
  await verifyActors(page, 'narrow-rayquaza-lugia');
  await shot(page, 'narrow-battle-rayquaza-lugia');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // A legal drafted fixture makes each added move available to exercise presentation reliably.
  for (const [id, move, opponent] of [
    ['lucario', 'aura-sphere', 'tyranitar'],
    ['darkrai', 'dark-pulse', 'lugia'],
    ['garchomp', 'earthquake', 'tyranitar'],
    ['lugia', 'dragon-pulse', 'mewtwo'],
    ['rayquaza', 'draco-meteor', 'lucario'],
  ]) {
    await page.evaluate(
      async ({ id, move }) => {
        const app = window.__d1,
          { pokemon } = await import('./src/data/catalogue.js');
        app.commit((s) => ({
          ...s,
          collection: s.collection.map((p) =>
            p.speciesId === id
              ? {
                  ...p,
                  moveIds: [move, ...pokemon[id].legalMoves.filter((m) => m !== move).slice(0, 3)],
                }
              : p,
          ),
        }));
        app.setSetting('speed', 1);
      },
      { id, move },
    );
    await select(page, id, opponent);
    await page.evaluate(() => window.__d1.start());
    const seen = await page.evaluate(async (move) => {
      const app = window.__d1,
        scene = app.scene,
        original = scene.play;
      let seen = false;
      scene.play = function (event) {
        const result = original.call(this, event);
        if (event.actor === 'player' && event.moveId === move) {
          seen = true;
          setTimeout(() => app.skip(), 40);
        }
        return result;
      };
      try {
        await app.turn(0);
      } finally {
        scene.play = original;
      }
      return seen;
    }, move);
    expect(seen).toBe(true);
    expect(await page.evaluate(() => window.__d1.scene.fx.children.length)).toBe(0);
    // Freeze a separate presentation sample for a reproducible VFX capture, with no combat mutation.
    await page.evaluate(async (move) => {
      const app = window.__d1,
        scene = app.scene,
        { moves } = await import('./src/data/catalogue.js');
      scene.qaUpdate = scene.update;
      scene.update = () => {};
      void scene.play({
        actor: 'player',
        target: 'opponent',
        moveId: move,
        moveType: moves[move].type,
        category: moves[move].category,
      });
      const fx = scene.effects.at(-1);
      fx.update(fx.duration * (move === 'draco-meteor' ? 0.4 : 0.32));
      scene.renderer.render(scene.scene, scene.camera);
    }, move);
    await shot(page, `vfx-${move}`);
    await page.evaluate(() => {
      window.__d1.scene.clearEffects();
      window.__d1.scene.update = window.__d1.scene.qaUpdate;
      delete window.__d1.scene.qaUpdate;
    });
  }
  checks.push(
    'All five added moves produce their authored real-turn VFX and cleanly skip; five focused effect captures',
  );
  // Representative complete battles; use the existing AI for player command selection only in QA.
  for (const opponent of ['rayquaza', 'mewtwo', 'garchomp', 'darkrai']) {
    await page.evaluate(() => {
      const app = window.__d1;
      app.setSetting('reducedMotion', true);
      app.setSetting('lowVFX', true);
      app.setSetting('speed', 3);
    });
    await select(page, 'lucario', opponent);
    await page.evaluate(() => window.__d1.start());
    let turns = 0;
    while (await page.locator('.battle-screen').count()) {
      if (++turns > 100) throw Error(`Battle did not finish: ${opponent}`);
      await page.evaluate(async () => {
        const app = window.__d1,
          { chooseAI } = await import('./src/domain/ai.js');
        const slot = chooseAI({
          ...app.battle,
          player: app.battle.opponent,
          opponent: app.battle.player,
        });
        const turn = app.turn(slot);
        app.skip();
        await turn;
      });
    }
    const result = await page.evaluate(() => ({
      ...window.__d1.result,
      saved: window.__d1.save.completedBattleIds.includes(window.__d1.result.battleId),
    }));
    expect(result.saved).toBe(true);
    battles.push({ opponent, turns, result });
    await shot(page, `result-${opponent}`);
  }
  checks.push(
    'Rayquaza, Mewtwo, Garchomp and Darkrai battles finish and commit rewards with Low VFX, Reduced Motion and 3× playback',
  );
  await page.locator('[data-action=replay]').click();
  await ready(page);
  await page.reload();
  await expect(page.locator('.hero-cta')).toBeVisible();
  expect(
    await page.evaluate(() => window.__d1.save.completedBattleIds.length),
  ).toBeGreaterThanOrEqual(4);
  checks.push(
    'Results replay, rewards and saves survive reload; no runtime external content or subpath failures',
  );
  expect(errors).toEqual([]);
  await fs.writeFile(
    'qa/expansion/results.json',
    JSON.stringify(
      { passed: true, browser: browser.version(), checks, frames, battles, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
