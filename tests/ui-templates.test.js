import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const html = readFileSync('src/ui/templates.html', 'utf8');
const screens = readFileSync('src/ui/screens.js', 'utf8');
const app = readFileSync('src/app/GameApp.js', 'utf8');

describe('static HTML UI integration', () => {
  it('provides every route and dialog as an HTML template', () => {
    for (const id of ['app-header', 'app-footer', 'screen-menu', 'screen-starter',
      'screen-setup', 'screen-catalogue', 'screen-battle', 'screen-results',
      'screen-settings', 'screen-credits', 'screen-recovery', 'modal-confirm']) {
      expect(html).toContain(`<template id="${id}">`);
    }
  });
  it('preserves navigation, battle and settings selectors', () => {
    for (const selector of ['data-action="nav"', 'data-action="start"',
      'data-action="abandon"', 'data-action="speed"', 'id="opponent-hud"',
      'id="player-hud"', 'class="battle-log"', 'id="owned-select"',
      'id="difficulty"', 'id="arena-select"', 'id="volume"', 'id="uiScale"']) {
      expect(html).toContain(selector);
    }
  });
  it('keeps layout out of the application controller', () => {
    expect(app).not.toContain('innerHTML = this.header()');
    expect(app).toContain('this.root.replaceChildren(createHeader(this), createScreen(this), createFooter(this))');
    expect(screens).toContain('export function createScreen(app)');
  });
});
