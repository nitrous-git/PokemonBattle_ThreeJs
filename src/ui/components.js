import { pokemon, moves } from '../data/catalogue.js';
import { assetUrl } from '../assetUrl.js';
import sprites from '../data/generated/spriteManifest.json' with { type: 'json' };

export const escapeHTML = (value) =>
    String(value).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

export const title = (value) =>
    value.replace(/(^|-)([a-z])/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase());

export const typeChip = (type) =>
    `<span class="type-chip type-${type}">${title(type)}</span>`;

export const types = (id) => pokemon[id].types.map(typeChip).join('');

export const sprite = (id, cls = '', locked = false) =>
    `<img class="creature-art ${cls} ${locked ? 'silhouette' : ''}" src="${assetUrl(sprites[id].portrait)}" alt="${pokemon[id].displayName}" draggable="false">`;

export const dex = (id) => `#${String(pokemon[id].dexNumber).padStart(3, '0')}`;

export const rarity = (id) => pokemon[id].rarity === 'starter/common' ? 'common' : pokemon[id].rarity;
export const rarityBadge = (id) => `<span class="rarity" data-rarity="${rarity(id)}">${title(rarity(id))}</span>`;

export const card = (
    id,
    { selected = false, action = 'opponent', owned = false, subtitle = '', locked = false } = {},
) =>
    `<button class="creature-card ${selected ? 'selected' : ''}" data-rarity="${rarity(id)}" data-action="${action}" data-id="${id}" aria-pressed="${selected}"><span class="card-index">${dex(id)}</span>${owned ? '<span class="owned-dot" title="Owned">✓</span>' : ''}${sprite(id, '', locked)}<strong>${pokemon[id].displayName}</strong><span class="card-subtitle">${subtitle || pokemon[id].types.map(title).join(' / ')}</span><span class="card-rarity">${rarityBadge(id)}</span></button>`;

export const moveDetail = (m) =>
    `${title(m.category)} · Power ${m.power ?? '—'} · Accuracy ${m.alwaysHit ? 'always' : m.accuracy + '%'} · ${m.description === '—' ? 'Direct damage.' : m.description}`;

export const moveRow = (id) => {
    const m = moves[id];
    return `<div class="move-row"><span class="type-dot type-${m.type}"></span><div><strong>${m.name}</strong><small>${moveDetail(m)}</small></div><span>${m.maxPP}<small>PP</small></span></div>`;
};

export function healthPanel(actor, side) {
    const hp = (actor.hp / actor.maxHP) * 100;

    return `<section class="health-panel ${side}" aria-label="${actor.name} health"><div class="health-heading"><div><span class="eyebrow">${side === 'player' ? 'YOUR PARTNER' : 'OPPONENT'}</span><h2>${actor.name} <span>Lv. ${actor.level}</span></h2></div><span class="gender-symbol">${side === 'player' ? '◇' : '◆'}</span></div><div class="hp-line"><span>HP</span><div class="hp-track"><i style="width:${hp}%;background:${hp < 25 ? '#d96854' : hp < 50 ? '#e0b45c' : '#5cab87'}"></i></div><b>${actor.hp}<small> / ${actor.maxHP}</small></b></div><div class="health-bottom">${actor.types.map(typeChip).join('')}<span class="status-badges">${actor.status ? `<b>${title(actor.status)}</b>` : ''}${actor.confusion ? '<b>Confused</b>' : ''}</span></div></section>`;
}