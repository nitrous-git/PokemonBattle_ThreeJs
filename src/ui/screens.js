/**
 * Screen presentation only. Static structure is in templates.html; these bindings
 * populate the current game state while preserving the original CSS and actions.
 */
import { pokemon, moves, economy } from '../data/catalogue.js';
import { rewardEstimate } from '../domain/battle.js';
import { stats, legalMoves, getMove, effectiveness } from '../domain/rules.js';
import { PALETTES } from '../render/ArenaScene.js';
import { card, dex, healthPanel, moveRow, sprite, title, types, escapeHTML, moveDetail } from './components.js';

const ids = Object.keys(pokemon);
const starters = ['pikachu', 'bulbasaur', 'charmander', 'squirtle'];
const flavor = {
    pikachu: 'Small spark. Limitless potential.',
    bulbasaur: 'Rooted in patience. Built to grow.',
    charmander: 'A little fire goes a long way.',
    squirtle: 'Keep your cool. Make a splash.',
};

const SELECTORS = {
    bind: (key) => `[data-bind="${key}"]`,
    slot: (key) => `[data-slot="${key}"]`,
};

let templates;

/** Load the HTML file once, before starting GameApp. No third-party framework. */
export async function loadTemplates() {
    if (templates) return;

    const url = new URL('./templates.html', import.meta.url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`UI templates unavailable (${response.status})`);

    const documentFragment = document.createElement('div');
    documentFragment.innerHTML = await response.text();

    templates = new Map(
        [...documentFragment.querySelectorAll('template[id]')].map((el) => [el.id, el]),
    );

    for (const name of [
        'app-header',
        'app-footer',
        'screen-menu',
        'screen-starter',
        'screen-setup',
        'screen-catalogue',
        'screen-battle',
        'screen-results',
        'screen-settings',
        'screen-credits',
        'screen-recovery',
        'modal-confirm',
        'vs-intro',
    ]) {
        if (!templates.has(name)) throw new Error(`UI template missing: ${name}`);
    }
}

function clone(name) {
    const template = templates?.get(name);
    if (!template) throw new Error(`UI template unavailable: ${name}`);
    return template.content.cloneNode(true);
}

function target(view, selector) {
    const element = view.querySelector(selector);
    if (!element) throw new Error(`UI binding missing: ${selector}`);
    return element;
}

function text(view, key, value) {
    target(view, SELECTORS.bind(key)).textContent = String(value);
}

/** Only HTML assembled by the trusted component functions enters these slots. */
function html(view, key, value) {
    target(view, SELECTORS.slot(key)).innerHTML = value;
}

function replaceSlot(view, key, markup) {
    const placeholder = target(view, SELECTORS.slot(key));
    const template = document.createElement('template');
    template.innerHTML = markup;
    placeholder.replaceWith(template.content);
}

function options(entries, selected) {
    return entries
        .map(
            ([value, label]) =>
                `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(label)}</option>`,
        )
        .join('');
}

export function createHeader(app) {
    const view = clone('app-header');
    view.querySelector('[data-wallet]').textContent = (app.save?.trainer.coins ?? 0).toLocaleString();

    view.querySelectorAll('nav [data-route]').forEach((el) => {
        el.classList.toggle('active', el.dataset.route === app.route);
    });

    return view;
}

export function createFooter(app) {
    const view = clone('app-footer');
    text(view, 'save-state', app.save ? '● SAVED LOCALLY' : '◆ YOUR NEXT ADVENTURE');
    return view;
}

export function createModal(heading, message, label) {
    const view = clone('modal-confirm');
    text(view, 'modal-heading', heading);
    text(view, 'modal-message', message);
    text(view, 'modal-accept', label);
    return view;
}

function menu(app) {
    const view = clone('screen-menu');
    text(view, 'cta', app.save ? 'Enter the arena' : 'Begin your journey');
    text(view, 'featured-dex', dex('charizard'));
    html(view, 'featured-types', types('charizard'));
    text(view, 'arena-name', PALETTES[app.arenaId].name);
    return view;
}

function starter() {
    const view = clone('screen-starter');
    html(
        view,
        'starters',
        starters
            .map(
                (id, i) =>
                    `<button class="starter-card type-${pokemon[id].types[0]}" data-action="starter" data-id="${id}">` +
                    `<span class="eyebrow">PARTNER 0${i + 1}</span>${sprite(id)}` +
                    `<h2>${pokemon[id].displayName}</h2><div>${types(id)}</div><p>${flavor[id]}</p>` +
                    '<span class="starter-select">Choose partner <b>→</b></span></button>',
            )
            .join(''),
    );
    return view;
}

function setup(app) {
    const view = clone('screen-setup');
    const selected = app.selected;
    const opponent = pokemon[app.opponentId];
    const level = Math.max(3, Math.min(50, selected.level + economy.tiers[app.tier].delta));
    const rewards = rewardEstimate(level, app.tier, app.difficulty);

    // Replace the placeholder node to keep the <img> a direct partner-feature child.
    target(view, SELECTORS.slot('partner-art')).outerHTML = sprite(selected.speciesId);

    text(view, 'partner-dex', dex(selected.speciesId));
    text(view, 'partner-name', pokemon[selected.speciesId].displayName);
    text(view, 'partner-level', `Lv. ${selected.level}`);
    html(view, 'partner-types', types(selected.speciesId));

    html(
        view,
        'owned-options',
        options(
            app.save.collection.map((item) => [
                item.instanceId,
                `${pokemon[item.speciesId].displayName} · Lv. ${item.level}`,
            ]),
            selected.instanceId,
        ),
    );

    html(
        view,
        'partner-moves',
        selected.moveIds
            .map(
                (id) =>
                    `<span><i class="type-dot type-${moves[id].type}"></i>${escapeHTML(moves[id].name)}</span>`,
            )
            .join(''),
    );

    html(
        view,
        'opponents',
        ids
            .map((id) =>
                card(id, {
                    selected: id === app.opponentId,
                    owned: app.save.collection.some((p) => p.speciesId === id),
                }),
            )
            .join(''),
    );

    text(view, 'match-player', pokemon[selected.speciesId].displayName);
    text(view, 'match-opponent', opponent.displayName);
    text(view, 'match-level', level);
    text(view, 'match-coins', rewards.coins);
    text(view, 'match-xp', rewards.xp);

    html(
        view,
        'tier-options',
        options(
            [
                ['rookie', 'Rookie (−1 Lv.)'],
                ['rival', 'Rival (equal)'],
                ['champion', 'Champion (+2 Lv.)'],
            ],
            app.tier,
        ),
    );

    html(
        view,
        'difficulty-options',
        options(['easy', 'normal', 'hard'].map((v) => [v, title(v)]), app.difficulty),
    );

    html(
        view,
        'arena-options',
        options(Object.entries(PALETTES).map(([key, item]) => [key, item.name]), app.arenaId),
    );

    return view;
}

function catalogue(app, shop) {
    const view = clone('screen-catalogue');
    const owned = app.save.collection.find((x) => x.speciesId === app.detailId);
    const species = pokemon[app.detailId];
    const attributes = stats(species.id, owned?.level || 5);

    text(view, 'catalogue-kicker', shop ? 'THE EXCHANGE / POKÉMON SHOP' : 'YOUR FIELD NOTES / COLLECTION');
    text(view, 'catalogue-title', shop ? 'A new partner awaits.' : 'A collection of possibilities.');
    text(view, 'collection-count', String(app.save.collection.length).padStart(2, '0'));
    text(view, 'catalogue-subtitle', shop ? 'Permanent unlocks' : 'Your partners');

    html(
        view,
        'catalogue-grid',
        ids
            .map((id) => {
                const p = app.save.collection.find((item) => item.speciesId === id);
                return card(id, {
                    action: 'detail',
                    selected: id === app.detailId,
                    owned: !!p,
                    locked: !shop && !p,
                    subtitle: p
                        ? `Owned · Level ${p.level}`
                        : shop
                            ? `◈ ${pokemon[id].priceCoins}`
                            : 'Not collected',
                });
            })
            .join(''),
    );

    text(view, 'detail-kicker', `${dex(species.id)} / ${shop ? 'PARTNER PROFILE' : 'FIELD NOTES'}`);
    text(
        view,
        'rarity',
        species.rarity.includes('premium')
            ? 'PREMIUM'
            : species.rarity.includes('rare')
                ? 'RARE'
                : 'COMMON',
    );
    html(view, 'detail-art', sprite(species.id));
    text(view, 'detail-name', species.displayName);
    text(view, 'detail-level', `Lv. ${owned?.level || 5}`);
    html(view, 'detail-types', types(species.id));

    if (owned) {
        const progress =
            owned.level === 50
                ? 100
                : ((owned.totalXP - owned.level ** 3) / ((owned.level + 1) ** 3 - owned.level ** 3)) * 100;
        replaceSlot(
            view,
            'detail-experience',
            `<div class="xp-info"><span>EXPERIENCE <b>${owned.level === 50 ? 'MAX LEVEL' : `${owned.totalXP - owned.level ** 3} / ${(owned.level + 1) ** 3 - owned.level ** 3} XP`}</b></span><div class="xp-track"><i style="width:${progress}%"></i></div></div>`,
        );
    } else {
        replaceSlot(
            view,
            'detail-experience',
            '<p class="detail-copy">A fresh level 5 partner with four permanent moves, drafted from its curated move pool.</p>',
        );
    }

    const statNames = {
        hp: 'HP',
        attack: 'ATK',
        defense: 'DEF',
        spAttack: 'SP. ATK',
        spDefense: 'SP. DEF',
        speed: 'SPEED',
    };

    html(
        view,
        'detail-stats',
        Object.entries(attributes)
            .map(([key, value]) => `<div><span>${statNames[key]}</span><b>${value}</b></div>`)
            .join(''),
    );

    if (owned) {
        replaceSlot(
            view,
            'detail-actions',
            `<div class="detail-moves"><span class="eyebrow">ASSIGNED MOVES</span>${owned.moveIds.map(moveRow).join('')}</div><button class="button primary full" data-action="use" data-id="${species.id}">Take to the arena <span>↗</span></button>`,
        );
    } else {
        replaceSlot(
            view,
            'detail-actions',
            `<div class="purchase-box"><div><span class="eyebrow">ONE-TIME UNLOCK</span><strong>◈ ${species.priceCoins}<small> coins</small></strong></div><button class="button primary" data-action="buy" data-id="${species.id}" ${app.save.trainer.coins < species.priceCoins ? 'disabled' : ''}>Recruit <span>+</span></button></div>${app.save.trainer.coins < species.priceCoins ? `<small class="afford-note">${species.priceCoins - app.save.trainer.coins} more coins needed. Keep battling!</small>` : ''}`,
        );
    }

    return view;
}

export function moveButton(app, slot) {
    const actor = app.battle.player;
    const move = getMove(actor, slot);
    const pp = slot < 0 ? '∞' : actor.moves[slot].pp;
    const mult = move.power ? effectiveness(move.type, app.battle.opponent.types) : null;

    return `<button class="move-button type-${move.type}" data-action="move" data-slot="${slot}" ${app.busy || pp === 0 ? 'disabled' : ''} title="${escapeHTML(moveDetail(move))}"><span class="move-number">${slot < 0 ? '!' : slot + 1}</span><div class="move-name"><strong>${escapeHTML(move.name)}</strong><small>${title(move.type)} <i>·</i> ${title(move.category)} ${move.power ? `<i>·</i> ${move.power} power` : ''}</small></div><div class="move-meta"><b>${pp}<small>${slot < 0 ? '' : ' / ' + move.maxPP} PP</small></b><span class="${mult > 1 ? 'effective' : mult === 0 ? 'immune' : ''}">${mult === null ? 'Status move' : mult === 0 ? 'Immune' : mult > 1 ? `${mult}× effective` : mult < 1 ? `${mult}× resisted` : '1× damage'}</span></div></button>`;
}

export function moveButtons(app) {
    const actor = app.battle.player;
    return legalMoves(actor).includes(-1)
        ? moveButton(app, -1)
        : actor.moves.map((_, i) => moveButton(app, i)).join('');
}

export function recentBattleLog(app) {
    return app.log
        .slice(-3)
        .map(
            (line, index, arr) =>
                `<p class="${index === arr.length - 1 ? 'current' : ''}">${escapeHTML(line)}</p>`,
        )
        .join('');
}

function battle(app) {
    const view = clone('screen-battle');
    const state = app.displayBattle || app.battle;

    text(view, 'battle-arena', PALETTES[app.arenaId].name);
    view.querySelector('[data-turn]').textContent = app.battle.turn;
    text(view, 'battle-speed', `${app.settings.speed}× speed`);
    target(view, SELECTORS.bind('abandon-button')).disabled = app.busy;

    html(view, 'opponent-hud', healthPanel(state.opponent, 'opponent'));
    html(view, 'player-hud', healthPanel(state.player, 'player'));
    html(view, 'battle-log', recentBattleLog(app));

    html(
        view,
        'command-status',
        app.introActive
            ? '<span>Preparing your matchup…</span>'
            : app.busy
            ? '<span class="thinking"><i></i> Turn in motion</span><button data-action="skip">Skip animation <kbd>Space</kbd></button>'
            : '<span>Choose your next move.</span><small>Keyboard <kbd>1</kbd> — <kbd>4</kbd></small>',
    );

    html(view, 'move-buttons', moveButtons(app));
    return view;
}

export function createBattleIntro(app) {
    const view = clone('vs-intro');
    text(view, 'intro-matchup', `${app.battle.player.name} versus ${app.battle.opponent.name}`);
    text(view, 'intro-arena', PALETTES[app.arenaId].name);
    for (const side of ['player', 'opponent']) {
        const actor = app.battle[side];
        const id = actor.speciesId;
        text(view, `intro-${side}-name`, actor.name);
        text(view, `intro-${side}-level`, `Lv. ${actor.level}`);
        text(view, `intro-${side}-dex`, dex(id));
        html(view, `intro-${side}-types`, types(id));
        html(view, `intro-${side}-art`,
            `<span class="vs-standin" aria-hidden="true">◇</span>${sprite(id, 'vs-art')}`);
    }
    return view.querySelector('.vs-intro');
}

function results(app) {
    const view = clone('screen-results');
    const result = app.result;
    const partner = app.save.collection.find((item) => item.instanceId === result.instanceId);
    const win = result.outcome === 'player';

    text(view, 'results-turns', `BATTLE COMPLETE / ${result.turns} TURNS`);
    text(view, 'results-emblem', win ? '✧' : result.outcome === 'draw' ? '◇' : '↗');
    text(
        view,
        'results-heading',
        win ? 'Well played.' : result.outcome === 'draw' ? 'An even match.' : 'The next one is yours.',
    );
    text(
        view,
        'results-description',
        `${pokemon[partner.speciesId].displayName} ${win ? 'triumphed over' : 'faced'} ${pokemon[result.opponentId].displayName}.`,
    );

    replaceSlot(view, 'results-sprite', sprite(partner.speciesId, 'result-sprite'));

    text(view, 'results-coins', result.coins);
    text(view, 'results-xp', result.xp);
    text(view, 'results-level-label', partner.level > app.oldLevel ? 'LEVEL UP!' : 'PARTNER LEVEL');
    text(
        view,
        'results-level',
        partner.level > app.oldLevel ? `${app.oldLevel} → ${partner.level}` : partner.level,
    );

    if (app.pendingReward) {
        replaceSlot(
            view,
            'results-actions',
            '<p class="error-note">Rewards could not be saved. Free some browser storage, then retry.</p><button class="button primary" data-action="retry-reward">Retry saving rewards</button>',
        );
    } else {
        replaceSlot(
            view,
            'results-actions',
            '<div class="result-actions"><button class="button primary" data-action="replay">Battle again <span>↗</span></button><button class="button secondary" data-action="nav" data-route="setup">Change opponent</button></div><div class="result-links"><button data-action="nav" data-route="collection">View collection →</button><button data-action="nav" data-route="shop">Spend your coins →</button></div>',
        );
    }

    text(
        view,
        'results-save-state',
        app.pendingReward ? 'Save pending' : '✓ Rewards saved · HP and PP restored for the next battle',
    );

    return view;
}

function settings(app) {
    const view = clone('screen-settings');
    const s = app.settings;

    view.querySelector('#volume').value = s.volume;

    replaceSlot(
        view,
        'settings-switches',
        [
            ['mute', 'Mute audio', 'Silence sound effects and music'],
            ['music', 'Ambient music', 'A gentle original generative loop'],
            ['reducedMotion', 'Reduced motion', 'Quiet cameras, static idles and shorter effects'],
            ['lowVFX', 'Low VFX', 'Fewer particles and lower render resolution'],
        ]
            .map(
                ([key, name, description]) =>
                    `<label class="setting-row"><span><b>${name}</b><small>${description}</small></span><input id="${key}" type="checkbox" ${s[key] ? 'checked' : ''} role="switch"></label>`,
            )
            .join(''),
    );

    html(
        view,
        'ui-scale-options',
        options(
            [.85, 1, 1.15].map((v) => [String(v), `${Math.round(v * 100)}%`]),
            String(s.uiScale),
        ),
    );

    html(
        view,
        'speed-options',
        options([1, 2, 3].map((v) => [String(v), String(v)]), String(s.speed)),
    );

    return view;
}

function recovery(app) {
    const view = clone('screen-recovery');
    text(view, 'recovery-error', app.recovery);
    return view;
}

export function createScreen(app) {
    if (app.recovery) return recovery(app);

    switch (app.route) {
        case 'menu':
            return menu(app);
        case 'starter':
            return starter();
        case 'setup':
            return setup(app);
        case 'collection':
            return catalogue(app, false);
        case 'shop':
            return catalogue(app, true);
        case 'battle':
            return battle(app);
        case 'results':
            return results(app);
        case 'settings':
            return settings(app);
        case 'credits':
            return clone('screen-credits');
        default:
            throw new Error(`Unknown screen: ${app.route}`);
    }
}
