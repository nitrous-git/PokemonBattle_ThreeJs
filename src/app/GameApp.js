import { pokemon, moves, economy } from '../data/catalogue.js';
import { createBattle, resolveTurn, rewardEstimate } from '../domain/battle.js';
import { chooseAI } from '../domain/ai.js';
import { stats, legalMoves, getMove, effectiveness } from '../domain/rules.js';
import { newSave, purchase, applyReward, DEFAULT_SETTINGS } from '../domain/progression.js';
import { SaveService } from '../services/SaveService.js';
import { AudioService } from '../services/AudioService.js';
import { ArenaScene, PALETTES } from '../render/ArenaScene.js';
import {
  card,
  dex,
  healthPanel,
  moveRow,
  sprite,
  title,
  types,
  escapeHTML,
  moveDetail,
} from '../ui/components.js';
const ids = Object.keys(pokemon),
  starters = ['pikachu', 'bulbasaur', 'charmander', 'squirtle'];
const flavor = {
  pikachu: 'Small spark. Limitless potential.',
  bulbasaur: 'Rooted in patience. Built to grow.',
  charmander: 'A little fire goes a long way.',
  squirtle: 'Keep your cool. Make a splash.',
};
const identity = () => ({
  seed: crypto.getRandomValues(new Uint32Array(1))[0],
  instanceId: crypto.randomUUID(),
  acquiredAt: new Date().toISOString(),
});
export class GameApp {
  constructor(root) {
    this.root = root;
    this.saveService = new SaveService(localStorage);
    this.audio = new AudioService();
    this.route = 'menu';
    this.selectedId = null;
    this.opponentId = 'squirtle';
    this.detailId = 'pikachu';
    this.tier = 'rival';
    this.difficulty = 'normal';
    this.arenaId = 'meadow';
    this.busy = false;
    this.log = [];
    this.filter = '';
    this.save = null;
    this.pendingReward = null;
    try {
      this.save = this.saveService.load();
    } catch (e) {
      this.recovery = e.message;
    }
    try {
      this.scene = new ArenaScene(document.querySelector('#arena'), (lost) => {
        document.querySelector('#context-message').hidden = !lost;
      });
      this.scene.setArena(this.arenaId);
    } catch (e) {
      this.graphicsError = e.message;
      document.querySelector('#scene').classList.add('no-webgl');
    }
    this.applySettings();
    this.root.addEventListener('click', (e) => this.click(e));
    this.root.addEventListener('change', (e) => this.change(e));
    this.root.addEventListener('input', (e) => {
      if (e.target.id === 'filter') {
        this.filter = e.target.value;
        this.filterCards();
      }
      if (e.target.id === 'volume') {
        this.audio.apply({ ...this.settings, volume: Number(e.target.value) });
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input,select,textarea')) return;
      if (e.code === 'Space' && this.route === 'battle' && this.busy) {
        e.preventDefault();
        this.skip();
      }
      if (this.route === 'battle' && !this.busy && /^[1-4]$/.test(e.key)) {
        const slot = Number(e.key) - 1;
        if (legalMoves(this.battle.player).includes(slot)) this.turn(slot);
      }
      if (e.key === 'Escape' && this.route === 'battle' && !this.busy) this.confirmAbandon();
    });
    this.root.addEventListener(
      'error',
      (e) => {
        if (e.target.tagName === 'IMG') {
          e.target.outerHTML =
            '<span class="missing-art" role="img" aria-label="Original sprite stand-in">◇</span>';
        }
      },
      true,
    );
    this.render();
    this.preview();
  }
  get settings() {
    return (
      this.save?.settings ||
      this.tempSettings || {
        ...DEFAULT_SETTINGS,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
    );
  }
  get selected() {
    return (
      this.save?.collection.find((x) => x.instanceId === this.selectedId) ||
      this.save?.collection[0]
    );
  }
  applySettings() {
    const s = this.settings;
    document.documentElement.dataset.motion = s.reducedMotion ? 'reduced' : 'full';
    document.documentElement.style.setProperty('--ui-scale', s.uiScale);
    this.scene?.settingsChanged(s);
    this.audio.apply(s);
  }
  commit(transform) {
    this.save = this.saveService.commit(this.save, transform);
    this.updateWallet();
    return this.save;
  }
  toast(message) {
    const el = document.querySelector('#toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
  }
  updateWallet() {
    const el = this.root.querySelector('[data-wallet]');
    if (el) el.textContent = (this.save?.trainer.coins ?? 0).toLocaleString();
  }
  async preview() {
    const route = this.route;
    this.scene?.setArena(this.arenaId);
    if (route === 'battle') return;
    const featured =
      route === 'setup'
        ? this.opponentId
        : route === 'collection' || route === 'shop'
          ? this.detailId
          : 'charizard';
    await this.scene?.setActors(this.selected?.speciesId || 'pikachu', featured, 'menu');
  }
  go(route) {
    if (this.recovery) {
      this.render();
      return;
    }
    if (!this.save && ['setup', 'collection', 'shop'].includes(route)) {
      this.afterStarter = route;
      route = 'starter';
    }
    this.route = route;
    this.filter = '';
    this.busy = false;
    this.render();
    this.preview();
    const focus = this.root.querySelector('h1');
    if (focus) {
      focus.tabIndex = -1;
      focus.focus({ preventScroll: true });
    }
  }
  header() {
    return `<header class="topbar"><button class="brand" data-action="nav" data-route="menu" aria-label="Battle Atelier home"><span class="brand-mark">◇</span><span>BATTLE <b>ATELIER</b><small>NITROUS · VOL. 01</small></span></button><nav aria-label="Main navigation">${[
      ['setup', 'Battle'],
      ['collection', 'Collection'],
      ['shop', 'Shop'],
    ]
      .map(
        ([r, n]) =>
          `<button data-action="nav" data-route="${r}" class="${this.route === r ? 'active' : ''}">${n}</button>`,
      )
      .join(
        '',
      )}</nav><div class="topbar-right"><span class="wallet"><i>◈</i> <b data-wallet>${(this.save?.trainer.coins ?? 0).toLocaleString()}</b><small>COINS</small></span><button class="icon-button" data-action="nav" data-route="settings" aria-label="Settings">⚙</button></div></header>`;
  }
  render() {
    document.body.dataset.screen = this.route;
    this.root.innerHTML =
      this.header() +
      (this.recovery ? this.recoveryScreen() : this[this.route + 'Screen']()) +
      `<footer class="footer"><span>UNOFFICIAL FAN EXPERIMENT · SINGLE PLAYER</span><button data-action="nav" data-route="credits">About & credits ↗</button><span class="save-state">${this.save ? '● SAVED LOCALLY' : '◆ YOUR NEXT ADVENTURE'}</span></footer>`;
    if (this.graphicsError)
      this.toast('WebGL unavailable. Battle rules remain playable; try hardware acceleration.');
  }
  menuScreen() {
    return `<main class="menu-screen"><div class="hero-copy"><span class="eyebrow"><i></i> POKÉMON · BATTLE SIMULATOR</span><h1>Every battle.<br>A new <em>story.</em></h1><p>Choose your partner. Find your edge.<br>A small arena for big possibilities.</p><button class="button primary hero-cta" data-action="nav" data-route="setup">${this.save ? 'Enter the arena' : 'Begin your journey'} <span>↗</span></button><div class="hero-links"><button data-action="nav" data-route="collection">Your collection <span>→</span></button><button data-action="nav" data-route="shop">Visit the shop <span>→</span></button></div><div class="hero-facts"><span><b>16</b> Pokémon</span><span><b>61</b> Moves</span><span><b>03</b> Arenas</span></div></div><div class="featured-label"><span class="eyebrow">IN THE SPOTLIGHT / ${dex('charizard')}</span><h2>Charizard <span>↗</span></h2><div>${types('charizard')}</div><p>A familiar flame. A whole new dimension.</p></div><div class="arena-label"><span class="live-dot"></span> ${PALETTES[this.arenaId].name}<small>LIVE 3D ARENA</small></div></main>`;
  }
  starterScreen() {
    return `<main class="page starter-page"><div class="page-heading"><span class="eyebrow">01 / A FRESH START</span><h1>Every trainer starts somewhere.</h1><p>Choose one partner. Your first four moves are drafted once and stay with you.</p></div><div class="starter-grid">${starters.map((id, i) => `<button class="starter-card type-${pokemon[id].types[0]}" data-action="starter" data-id="${id}"><span class="eyebrow">PARTNER 0${i + 1}</span>${sprite(id)}<h2>${pokemon[id].displayName}</h2><div>${types(id)}</div><p>${flavor[id]}</p><span class="starter-select">Choose partner <b>→</b></span></button>`).join('')}</div><div class="info-strip"><span>◇ Level 5 partner</span><span>◈ 200 starting coins</span><span>∞ Unlimited challenges</span></div></main>`;
  }
  setupScreen() {
    const s = this.selected,
      enemy = pokemon[this.opponentId],
      level = Math.max(3, Math.min(50, s.level + economy.tiers[this.tier].delta)),
      rewards = rewardEstimate(level, this.tier, this.difficulty);
    return `<main class="page setup-page"><div class="page-heading inline"><div><span class="eyebrow">THE ARENA / CHALLENGE SETUP</span><h1>Pick your next challenge.</h1></div><span class="page-note">Every matchup is a new possibility.</span></div><div class="setup-layout"><section class="partner-panel panel"><div class="panel-kicker">01 <span>YOUR PARTNER</span></div><div class="partner-feature">${sprite(s.speciesId)}<span class="dex-label">${dex(s.speciesId)}</span><h2>${pokemon[s.speciesId].displayName}<small>Lv. ${s.level}</small></h2><div>${types(s.speciesId)}</div></div><label class="field">Switch partner<select id="owned-select">${this.save.collection.map((x) => `<option value="${x.instanceId}" ${x.instanceId === s.instanceId ? 'selected' : ''}>${pokemon[x.speciesId].displayName} · Lv. ${x.level}</option>`).join('')}</select></label><div class="compact-moves">${s.moveIds.map((id) => `<span><i class="type-dot type-${moves[id].type}"></i>${moves[id].name}</span>`).join('')}</div><div class="partner-hint">Your partner starts every battle with full HP and PP.</div></section><section class="opponent-panel panel"><div class="panel-kicker">02 <span>CHOOSE AN OPPONENT</span><button data-action="random" class="text-button">Random ↻</button></div><div class="search-row"><label class="search"><span>⌕</span><input id="filter" placeholder="Find a Pokémon or type…" aria-label="Filter opponents"></label><span>16 available</span></div><div class="opponent-grid">${ids.map((id) => card(id, { selected: id === this.opponentId, owned: this.save.collection.some((x) => x.speciesId === id) })).join('')}</div></section></div><section class="setup-bottom panel"><div class="match-summary"><span class="eyebrow">YOUR MATCHUP</span><strong>${pokemon[s.speciesId].displayName} <i>vs.</i> ${enemy.displayName}</strong><small>Opponent Lv. ${level} · Win: <b>◈ ${rewards.coins}</b> + ${rewards.xp} XP</small></div><label class="field">Challenge tier<select id="tier">${['rookie', 'rival', 'champion'].map((t) => `<option ${t === this.tier ? 'selected' : ''} value="${t}">${title(t)} ${t === 'rookie' ? '(−1 Lv.)' : t === 'champion' ? '(+2 Lv.)' : '(equal)'}</option>`).join('')}</select></label><label class="field">Opponent AI<select id="difficulty">${['easy', 'normal', 'hard'].map((d) => `<option value="${d}" ${d === this.difficulty ? 'selected' : ''}>${title(d)}</option>`).join('')}</select></label><label class="field">Battlefield<select id="arena-select">${Object.entries(
      PALETTES,
    )
      .map(
        ([k, p]) =>
          `<option value="${k}" ${k === this.arenaId ? 'selected' : ''}>${p.name}</option>`,
      )
      .join(
        '',
      )}</select></label><button class="button primary" data-action="start">Let's battle <span>↗</span></button></section></main>`;
  }
  collectionScreen() {
    return this.catalogueScreen(false);
  }
  shopScreen() {
    return this.catalogueScreen(true);
  }
  catalogueScreen(shop) {
    const own = this.save.collection.find((x) => x.speciesId === this.detailId),
      s = pokemon[this.detailId],
      st = stats(s.id, own?.level || 5);
    return `<main class="page catalogue-page"><div class="page-heading inline"><div><span class="eyebrow">${shop ? 'THE EXCHANGE / POKÉMON SHOP' : 'YOUR FIELD NOTES / COLLECTION'}</span><h1>${shop ? 'A new partner awaits.' : 'A collection of possibilities.'}</h1></div><div class="collection-count"><b>${String(this.save.collection.length).padStart(2, '0')}</b><span>/ 16<br>COLLECTED</span></div></div><div class="catalogue-layout"><section class="panel catalogue-list"><div class="search-row"><label class="search"><span>⌕</span><input id="filter" placeholder="Search names or types…" aria-label="Filter catalogue"></label><span>${shop ? 'Permanent unlocks' : 'Your partners'}</span></div><div class="catalogue-grid">${ids
      .map((id) => {
        const p = this.save.collection.find((x) => x.speciesId === id);
        return card(id, {
          action: 'detail',
          selected: id === this.detailId,
          owned: !!p,
          locked: !shop && !p,
          subtitle: p
            ? `Owned · Level ${p.level}`
            : shop
              ? `◈ ${pokemon[id].priceCoins}`
              : 'Not collected',
        });
      })
      .join(
        '',
      )}</div></section><aside class="panel detail-panel"><div class="detail-top"><span class="eyebrow">${dex(s.id)} / ${shop ? 'PARTNER PROFILE' : 'FIELD NOTES'}</span><span class="rarity">${s.rarity.includes('premium') ? 'PREMIUM' : s.rarity.includes('rare') ? 'RARE' : 'COMMON'}</span></div><div class="detail-art">${sprite(s.id)}</div><h2>${s.displayName}<small>Lv. ${own?.level || 5}</small></h2><div>${types(s.id)}</div>${own ? `<div class="xp-info"><span>EXPERIENCE <b>${own.level === 50 ? 'MAX LEVEL' : `${own.totalXP - own.level ** 3} / ${(own.level + 1) ** 3 - own.level ** 3} XP`}</b></span><div class="xp-track"><i style="width:${own.level === 50 ? 100 : ((own.totalXP - own.level ** 3) / ((own.level + 1) ** 3 - own.level ** 3)) * 100}%"></i></div></div>` : '<p class="detail-copy">A fresh level 5 partner with four permanent moves, drafted from its curated move pool.</p>'}<div class="stats-grid">${Object.entries(
      st,
    )
      .map(
        ([k, v]) =>
          `<div><span>${{ hp: 'HP', attack: 'ATK', defense: 'DEF', spAttack: 'SP. ATK', spDefense: 'SP. DEF', speed: 'SPEED' }[k]}</span><b>${v}</b></div>`,
      )
      .join(
        '',
      )}</div>${own ? `<div class="detail-moves"><span class="eyebrow">ASSIGNED MOVES</span>${own.moveIds.map(moveRow).join('')}</div><button class="button primary full" data-action="use" data-id="${s.id}">Take to the arena <span>↗</span></button>` : `<div class="purchase-box"><div><span class="eyebrow">ONE-TIME UNLOCK</span><strong>◈ ${s.priceCoins}<small> coins</small></strong></div><button class="button primary" data-action="buy" data-id="${s.id}" ${this.save.trainer.coins < s.priceCoins ? 'disabled' : ''}>Recruit <span>+</span></button></div>${this.save.trainer.coins < s.priceCoins ? `<small class="afford-note">${s.priceCoins - this.save.trainer.coins} more coins needed. Keep battling!</small>` : ''}`}</aside></div></main>`;
  }
  battleScreen() {
    const s = this.displayBattle || this.battle;
    return `<main class="battle-screen"><div class="battle-topline"><span><i class="live-dot"></i>${PALETTES[this.arenaId].name}</span><b>TURN <span data-turn>${this.battle.turn}</span></b><div><button data-action="speed" class="small-button">${this.settings.speed}× speed</button><button data-action="abandon" class="small-button" ${this.busy ? 'disabled' : ''}>Leave battle ↗</button></div></div><div id="opponent-hud">${healthPanel(s.opponent, 'opponent')}</div><div id="player-hud">${healthPanel(s.player, 'player')}</div><div id="battle-floats" aria-hidden="true"></div><section class="command-deck"><div class="narration"><span class="eyebrow">BATTLE JOURNAL <i class="live-dot"></i></span><div class="battle-log" role="log" aria-live="polite">${this.log
      .slice(-3)
      .map(
        (l, i) =>
          `<p class="${i === this.log.slice(-3).length - 1 ? 'current' : ''}">${escapeHTML(l)}</p>`,
      )
      .join(
        '',
      )}</div><div class="command-status">${this.busy ? '<span class="thinking"><i></i> Turn in motion</span><button data-action="skip">Skip animation <kbd>Space</kbd></button>' : '<span>Choose your next move.</span><small>Keyboard <kbd>1</kbd> — <kbd>4</kbd></small>'}</div></div><div class="move-grid">${this.moveButtons()}</div></section></main>`;
  }
  moveButtons() {
    const a = this.battle.player;
    return legalMoves(a).includes(-1)
      ? this.moveButton(-1)
      : a.moves.map((_, i) => this.moveButton(i)).join('');
  }
  moveButton(slot) {
    const a = this.battle.player,
      m = getMove(a, slot),
      pp = slot < 0 ? '∞' : a.moves[slot].pp,
      mult = m.power ? effectiveness(m.type, this.battle.opponent.types) : null;
    return `<button class="move-button type-${m.type}" data-action="move" data-slot="${slot}" ${this.busy || pp === 0 ? 'disabled' : ''} title="${escapeHTML(moveDetail(m))}"><span class="move-number">${slot < 0 ? '!' : slot + 1}</span><div class="move-name"><strong>${m.name}</strong><small>${title(m.type)} <i>·</i> ${title(m.category)} ${m.power ? `<i>·</i> ${m.power} power` : ''}</small></div><div class="move-meta"><b>${pp}<small>${slot < 0 ? '' : ' / ' + m.maxPP} PP</small></b><span class="${mult > 1 ? 'effective' : mult === 0 ? 'immune' : ''}">${mult === null ? 'Status move' : mult === 0 ? 'Immune' : mult > 1 ? `${mult}× effective` : mult < 1 ? `${mult}× resisted` : '1× damage'}</span></div></button>`;
  }
  resultsScreen() {
    const r = this.result,
      p = this.save.collection.find((x) => x.instanceId === r.instanceId),
      win = r.outcome === 'player';
    return `<main class="results-page"><section class="result-card panel"><span class="eyebrow">BATTLE COMPLETE / ${r.turns} TURNS</span><div class="result-emblem">${win ? '✧' : r.outcome === 'draw' ? '◇' : '↗'}</div><h1>${win ? 'Well played.' : r.outcome === 'draw' ? 'An even match.' : 'The next one is yours.'}</h1><p>${pokemon[p.speciesId].displayName} ${win ? 'triumphed over' : 'faced'} ${pokemon[r.opponentId].displayName}.</p>${sprite(p.speciesId, 'result-sprite')}<div class="reward-grid"><div><span>COINS EARNED</span><b>+ ${r.coins} <i>◈</i></b></div><div><span>EXPERIENCE</span><b>+ ${r.xp} <i>XP</i></b></div><div><span>${p.level > this.oldLevel ? 'LEVEL UP!' : 'PARTNER LEVEL'}</span><b>${p.level > this.oldLevel ? `${this.oldLevel} → ` : ''}${p.level}</b></div></div>${this.pendingReward ? '<p class="error-note">Rewards could not be saved. Free some browser storage, then retry.</p><button class="button primary" data-action="retry-reward">Retry saving rewards</button>' : `<div class="result-actions"><button class="button primary" data-action="replay">Battle again <span>↗</span></button><button class="button secondary" data-action="nav" data-route="setup">Change opponent</button></div><div class="result-links"><button data-action="nav" data-route="collection">View collection →</button><button data-action="nav" data-route="shop">Spend your coins →</button></div>`}<span class="save-note">${this.pendingReward ? 'Save pending' : '✓ Rewards saved · HP and PP restored for the next battle'}</span></section></main>`;
  }
  settingsScreen() {
    const s = this.settings;
    return `<main class="page narrow-page"><div class="page-heading"><span class="eyebrow">MAKE IT YOURS</span><h1>A little fine-tuning.</h1></div><section class="panel settings-panel"><h2>Sound & atmosphere</h2><label class="setting-row"><span><b>Master volume</b><small>Original synthesized sound effects</small></span><input id="volume" type="range" min="0" max="1" step=".05" value="${s.volume}" aria-label="Master volume"></label>${[
      ['mute', 'Mute audio', 'Silence sound effects and music'],
      ['music', 'Ambient music', 'A gentle original generative loop'],
      ['reducedMotion', 'Reduced motion', 'Quiet cameras, static idles and shorter effects'],
      ['lowVFX', 'Low VFX', 'Fewer particles and lower render resolution'],
    ]
      .map(
        ([id, name, desc]) =>
          `<label class="setting-row"><span><b>${name}</b><small>${desc}</small></span><input id="${id}" type="checkbox" ${s[id] ? 'checked' : ''} role="switch"></label>`,
      )
      .join(
        '',
      )}<label class="setting-row"><span><b>Interface scale</b><small>Adjust text and control size</small></span><select id="uiScale">${[0.85, 1, 1.15].map((v) => `<option value="${v}" ${v === s.uiScale ? 'selected' : ''}>${Math.round(v * 100)}%</option>`).join('')}</select></label><label class="setting-row"><span><b>Battle playback speed</b><small>Combat rules are identical at every speed</small></span><select id="speed">${[1, 2, 3].map((v) => `<option ${v === s.speed ? 'selected' : ''}>${v}</option>`).join('')}</select></label><div class="save-tools"><span><b>Your progress stays in this browser.</b><small>Export a backup before changing browsers or clearing storage.</small></span><button class="button secondary" data-action="export">Export save ↗</button><button class="danger-button" data-action="reset">Reset progress</button></div></section></main>`;
  }
  creditsScreen() {
    return `<main class="page narrow-page"><div class="page-heading"><span class="eyebrow">NITROUS / AN EDUCATIONAL EXPERIMENT</span><h1>A small tribute to big adventures.</h1></div><section class="panel credits-panel"><h2>Battle Atelier</h2><p>A standalone battle simulator built with vanilla JavaScript, Three.js and Vite. Inspired by the battle framing of <b>kkatsi/pokemon-battle</b> and the collection loop of Olivier Trudel's original Java prototype.</p><h3>Data & artwork</h3><p>Species facts and move metadata: PokéAPI. Gen-V front/back sprite sources: PokeAPI/sprites. Pokémon names and character artwork belong to their respective owners, including The Pokémon Company, Nintendo, Creatures and GAME FREAK. This private educational build is unofficial and unaffiliated.</p><h3>Original production</h3><p>Interface, three procedural arenas, effects, synthesized audio, battle rules and progression are implemented for this project. No official music, logos or proprietary fonts are included.</p><h3>Simulator rules</h3><p>Modern 18-type chart. Fixed IV 15 / no EVs. Cross-generation curated move pools include 21 documented custom allowances. No abilities, items, evolutions or switching. Hard AI uses bounded, sampled two-turn minimax; this is not a cartridge-perfect simulator.</p><div class="credit-links"><a href="https://pokeapi.co" target="_blank" rel="noreferrer">PokéAPI ↗</a><a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noreferrer">Sprite source ↗</a><a href="https://github.com/kkatsi/pokemon-battle" target="_blank" rel="noreferrer">Visual reference ↗</a></div></section></main>`;
  }
  recoveryScreen() {
    return `<main class="page narrow-page"><section class="panel credits-panel"><span class="eyebrow">SAVE RECOVERY</span><h1>Your save needs attention.</h1><p>${escapeHTML(this.recovery)}</p><p>The original data has been preserved. Download it before choosing to reset.</p><button class="button primary" data-action="export">Download original save</button><button class="button secondary" data-action="reset">Reset with confirmation</button></section></main>`;
  }
  filterCards() {
    const q = this.filter.trim().toLowerCase();
    this.root.querySelectorAll('.creature-card').forEach((el) => {
      const s = pokemon[el.dataset.id];
      el.hidden = !!q && !`${s.id} ${s.types.join(' ')}`.includes(q);
    });
  }
  async click(event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    this.audio.unlock();
    if (a !== 'move') this.audio.cue('select');
    try {
      if (a === 'skip') {
        this.skip();
        return;
      }
      if (a === 'nav') {
        if (this.route === 'battle') {
          if (this.busy) return;
          this.confirmAbandon(el.dataset.route);
          return;
        }
        if (this.pendingReward) {
          this.toast('Save your pending rewards first.');
          return;
        }
        this.go(el.dataset.route);
      } else if (a === 'starter') {
        this.commit(() => newSave(el.dataset.id, identity()));
        this.selectedId = this.save.collection[0].instanceId;
        this.audio.cue('start');
        this.go(this.afterStarter || 'setup');
      } else if (a === 'opponent') {
        this.opponentId = el.dataset.id;
        this.render();
        this.preview();
      } else if (a === 'detail') {
        this.detailId = el.dataset.id;
        this.render();
        this.preview();
      } else if (a === 'random') {
        this.opponentId = ids[crypto.getRandomValues(new Uint32Array(1))[0] % ids.length];
        this.render();
        this.preview();
      } else if (a === 'start' || a === 'replay') {
        await this.start();
      } else if (a === 'move') {
        await this.turn(Number(el.dataset.slot));
      } else if (a === 'buy') {
        const id = el.dataset.id;
        this.modal(
          'Welcome a new partner?',
          `${pokemon[id].displayName} will join your collection for ${pokemon[id].priceCoins} coins. This unlock is permanent.`,
          () => {
            this.commit((s) => purchase(s, id, identity()));
            this.audio.cue('purchase');
            this.render();
            this.toast(`${pokemon[id].displayName} joined your collection.`);
          },
          'Recruit partner',
        );
      } else if (a === 'use') {
        this.selectedId = this.save.collection.find(
          (x) => x.speciesId === el.dataset.id,
        ).instanceId;
        this.go('setup');
      } else if (a === 'abandon') this.confirmAbandon();
      else if (a === 'speed') {
        this.setSetting('speed', (this.settings.speed % 3) + 1);
        if (this.route === 'battle') el.textContent = `${this.settings.speed}× speed`;
      } else if (a === 'retry-reward') {
        this.commit((s) => applyReward(s, this.pendingReward));
        this.pendingReward = null;
        this.render();
      } else if (a === 'export') {
        const blob = new Blob([this.saveService.raw()], { type: 'application/json' }),
          url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = 'battle-atelier-save.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (a === 'reset') {
        this.modal(
          'Start over?',
          'This removes your collection, coins and settings from this browser. Export a backup first if you want to keep them.',
          () => {
            this.saveService.reset();
            this.save = null;
            this.recovery = null;
            this.selectedId = null;
            this.go('menu');
          },
          'Reset progress',
        );
      }
    } catch (e) {
      this.toast(e.message);
    }
  }
  change(event) {
    const el = event.target;
    try {
      if (el.id === 'owned-select') {
        this.selectedId = el.value;
        this.render();
        this.preview();
      } else if (['tier', 'difficulty', 'arena-select'].includes(el.id)) {
        this[el.id === 'arena-select' ? 'arenaId' : el.id] = el.value;
        this.render();
        this.preview();
      } else if (Object.hasOwn(DEFAULT_SETTINGS, el.id))
        this.setSetting(el.id, el.type === 'checkbox' ? el.checked : Number(el.value));
    } catch (e) {
      this.toast(e.message);
      this.render();
    }
  }
  setSetting(key, value) {
    if (this.save) this.commit((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
    else this.tempSettings = { ...this.settings, [key]: value };
    this.applySettings();
  }
  modal(heading, message, accept, label = 'Confirm') {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `<form method="dialog"><span class="eyebrow">A QUICK CHECK</span><h2>${heading}</h2><p>${escapeHTML(message)}</p><div><button value="cancel" class="button secondary">Cancel</button><button value="confirm" class="button primary">${label}</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'confirm')
        try {
          accept();
        } catch (e) {
          this.toast(e.message);
        }
      dialog.remove();
    });
    dialog.showModal();
    dialog.querySelector('button').focus();
  }
  confirmAbandon(route = 'setup') {
    if (this.busy) return;
    this.modal(
      'Leave this battle?',
      'No rewards are given for an unfinished match. Your partner will recover fully.',
      () => {
        this.scene?.clearEffects();
        this.battle = null;
        this.go(route);
      },
      'Leave battle',
    );
  }
  async start() {
    if (this.busy || this.pendingReward) return;
    this.busy = true;
    const s = this.selected;
    this.oldLevel = s.level;
    const id = identity();
    this.battle = createBattle({
      instance: s,
      opponentId: this.opponentId,
      tier: this.tier,
      difficulty: this.difficulty,
      seed: id.seed,
      battleId: crypto.randomUUID(),
    });
    this.displayBattle = structuredClone(this.battle);
    this.route = 'battle';
    this.log = [
      `${pokemon[this.opponentId].displayName} enters the arena.`,
      `Your move, ${pokemon[s.speciesId].displayName}.`,
    ];
    this.render();
    this.audio.cue('start');
    this.scene?.setArena(this.arenaId);
    await this.scene?.setActors(s.speciesId, this.opponentId, 'battle');
    this.busy = false;
    this.render();
  }
  appendLog(text) {
    this.log.push(text);
    this.log = this.log.slice(-60);
    const el = this.root.querySelector('.battle-log');
    if (el)
      el.innerHTML = this.log
        .slice(-3)
        .map(
          (l, i) =>
            `<p class="${i === this.log.slice(-3).length - 1 ? 'current' : ''}">${escapeHTML(l)}</p>`,
        )
        .join('');
  }
  refreshHUD() {
    for (const side of ['player', 'opponent']) {
      const el = this.root.querySelector(`#${side}-hud`);
      if (el) el.innerHTML = healthPanel(this.displayBattle[side], side);
    }
  }
  wait(ms) {
    if (this.skipping) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.finishWait = null;
        resolve();
      }, ms / this.settings.speed);
      this.finishWait = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  skip() {
    this.skipping = true;
    this.finishWait?.();
    this.finishWait = null;
    this.scene?.clearEffects();
  }
  async turn(slot) {
    if (this.busy || this.route !== 'battle' || !legalMoves(this.battle.player).includes(slot))
      return;
    this.busy = true;
    this.skipping = false;
    this.render();
    try {
      const ai = chooseAI(this.battle);
      const resolution = resolveTurn(this.battle, slot, ai);
      this.battle = resolution.state;
      if (resolution.result) {
        this.result = resolution.result;
        try {
          this.commit((s) => applyReward(s, this.result));
        } catch (e) {
          this.pendingReward = this.result;
          this.toast(e.message);
        }
      }
      for (const e of resolution.events) {
        const a = this.displayBattle[e.actor];
        const name = a?.name || '';
        if (e.type === 'PP') {
          a.moves[e.slot].pp = e.pp;
          continue;
        }
        if (e.type === 'MOVE') {
          this.appendLog(`${name} uses ${e.name}.`);
          await this.wait(420);
        }
        if (e.type === 'VFX') {
          if (!this.skipping) this.scene?.play(e);
          this.audio.cue('hit', e.moveType);
          await this.wait(this.settings.reducedMotion ? 180 : 700);
        }
        if (e.type === 'DAMAGE') {
          a.hp = e.afterHP;
          this.refreshHUD();
          if (!this.skipping) this.scene?.hit(e.actor);
          this.floatDamage(e.actor, e.amount, e.critical);
          let text = `${name} lost ${e.amount} HP.`;
          if (['burn', 'poison', 'confusion', 'recoil'].includes(e.cause))
            text = `${name} takes ${e.amount} ${e.cause} damage.`;
          if (e.critical) text += ' A critical hit!';
          if (e.effectiveness > 1) text += ' Super effective!';
          if (e.effectiveness > 0 && e.effectiveness < 1) text += ' Not very effective.';
          this.appendLog(text);
          await this.wait(500);
        }
        if (e.type === 'STATUS') {
          if (e.status === 'confusion') a.confusion = e.duration;
          else a.status = e.status;
          this.refreshHUD();
          this.audio.cue('status');
          this.appendLog(`${name}: ${title(e.status)}.`);
          await this.wait(400);
        }
        if (e.type === 'STATUS_CLEARED') {
          a.status = null;
          this.refreshHUD();
          this.appendLog(`${name} recovered from ${e.status}.`);
          await this.wait(220);
        }
        if (e.type === 'CONFUSION_CLEARED') {
          a.confusion = 0;
          this.refreshHUD();
          this.appendLog(`${name} is no longer confused.`);
        }
        if (e.type === 'STAGE') {
          this.appendLog(
            `${name}'s ${title(e.stat)} ${e.delta > 0 ? 'rose' : 'fell'}${Math.abs(e.delta) > 1 ? ' sharply' : ''}.`,
          );
          await this.wait(350);
        }
        if (e.type === 'IMMUNE') {
          this.appendLog(`${name} is immune to that move.`);
          await this.wait(450);
        }
        if (e.type === 'MISS') {
          this.appendLog(`${name}'s attack missed.`);
          await this.wait(350);
        }
        if (e.type === 'FAILED') {
          this.appendLog('The move had no effect.');
          await this.wait(300);
        }
        if (e.type === 'BLOCKED') {
          this.appendLog(
            `${name} ${e.reason === 'confusion' ? 'hurt itself in confusion' : `could not act: ${e.reason}`}.`,
          );
          await this.wait(400);
        }
        if (e.type === 'FAINT') {
          this.scene?.faint(e.actor);
          this.appendLog(`${name} fainted.`);
          await this.wait(650);
        }
      }
      this.displayBattle = structuredClone(this.battle);
      this.scene?.sync(this.battle);
      this.scene?.clearEffects();
      this.busy = false;
      if (this.battle.phase === 'ended') {
        this.audio.cue(this.result.outcome === 'player' ? 'victory' : 'defeat');
        this.route = 'results';
        this.render();
      } else this.render();
    } catch (e) {
      this.busy = false;
      this.toast(e.message);
      this.render();
    }
  }
  floatDamage(side, amount, critical) {
    if (this.skipping) return;
    const wrap = this.root.querySelector('#battle-floats');
    if (!wrap) return;
    const el = document.createElement('b');
    el.className = `damage-float ${side}`;
    el.textContent = `−${amount}${critical ? '!' : ''}`;
    wrap.append(el);
    setTimeout(() => el.remove(), 1000);
  }
}
