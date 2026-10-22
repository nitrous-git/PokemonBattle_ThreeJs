import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const html = readFileSync('src/ui/templates.html', 'utf8');
const screens = readFileSync('src/ui/screens.js', 'utf8');
const app = readFileSync('src/app/GameApp.js', 'utf8');

describe('static HTML UI integration', () => {
  it('provides every route and dialog as an HTML template', () => {
    for (const id of ['app-header', 'app-footer', 'screen-menu', 'screen-starter',
      'screen-setup', 'screen-catalogue', 'screen-battle', 'screen-results',
      'screen-settings', 'screen-credits', 'screen-recovery', 'modal-confirm', 'vs-intro']) {
      expect(html).toContain(`<template id="${id}">`);
    }
  });
  it('preserves navigation, battle and settings selectors', () => {
    for (const selector of ['data-action="nav"', 'data-action="start"',
      'data-action="abandon"', 'data-action="speed"', 'id="opponent-hud"',
      'id="player-hud"', 'class="battle-log"', 'id="owned-select"',
      'id="difficulty"', 'id="arena-select"', 'id="volume"', 'id="uiScale"', 'id="theme"']) {
      expect(html).toContain(selector);
    }
  });
  it('keeps layout out of the application controller', () => {
    expect(app).not.toContain('innerHTML = this.header()');
    expect(app).toContain('this.root.replaceChildren(createHeader(this), createScreen(this), createFooter(this))');
    expect(screens).toContain('export function createScreen(app)');
  });
});

describe('title screen contract', () => {
  const menu = html.match(/<template id="screen-menu">([\s\S]*?)<\/template>/)[1];
  it('has one main action using the existing setup route', () => {
    expect(menu.match(/<button\b/g)).toHaveLength(1);
    expect(menu).toContain('data-route="setup"');
    expect(menu).toContain('PLAY');
    expect(menu).toContain('aria-labelledby="title-heading"');
    expect(menu).toContain('Battle Atelier</span>');
  });
  it('uses native vector branding and no marketing cards or image backgrounds', () => {
    expect(menu).toContain('class="title-logo"');
    expect(menu).toContain('class="title-environment"');
    expect(menu).not.toMatch(/<img|hero-facts|featured-label|hero-links|hero-copy/);
  });
});
