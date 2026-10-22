/**
 * Application controller: state, input, navigation and turn presentation.
 * HTML layout and component markup live under src/ui/.
 */
import { pokemon, moves } from '../data/catalogue.js';
import { createBattle, resolveTurn } from '../domain/battle.js';
import { chooseAI } from '../domain/ai.js';
import { legalMoves } from '../domain/rules.js';
import { newSave, purchase, applyReward, DEFAULT_SETTINGS } from '../domain/progression.js';
import { SaveService } from '../services/SaveService.js';
import { AudioService } from '../services/AudioService.js';
import { ArenaScene } from '../render/ArenaScene.js';
import { TitleScene } from '../render/TitleScene.js';
import { resolveMoveVFX } from '../render/MoveVFX.js';
import { title, healthPanel } from '../ui/components.js';
import { createHeader, createFooter, createScreen, createModal, createBattleIntro, recentBattleLog } from '../ui/screens.js';
import { BattleIntro } from '../ui/BattleIntro.js';

const speciesIds = Object.keys(pokemon);

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
        this.arenaId = 'canyon';
        this.busy = false;
        this.introActive = false;
        this.intro = null;
        this.log = [];
        this.filter = '';
        this.save = null;
        this.pendingReward = null;

        try {
            this.save = this.saveService.load();
        } catch (error) {
            this.recovery = error.message;
        }

        try {
            this.scene = new ArenaScene(document.querySelector('#arena'), (lost) => {
                document.querySelector('#context-message').hidden = !lost;
            });
            this.scene.setArena(this.arenaId);
        } catch (error) {
            this.graphicsError = error.message;
            document.querySelector('#scene').classList.add('no-webgl');
        }

        this.applySettings();

        // Event delegation survives full screen DOM replacement.
        this.root.addEventListener('click', (event) => this.click(event));
        this.root.addEventListener('change', (event) => this.change(event));
        this.root.addEventListener('input', (event) => {
            if (event.target.id === 'filter') {
                this.filter = event.target.value;
                this.filterCards();
            }
            if (event.target.id === 'volume') {
                this.audio.apply({ ...this.settings, volume: Number(event.target.value) });
            }
        });

        document.addEventListener('keydown', (event) => {
            if (this.introActive || this.introSpaceHeld) {
                if (event.code === 'Space') {
                    event.preventDefault();
                    this.introSpaceHeld = true;
                    this.intro?.skip();
                }
                if (event.key === 'Escape') event.preventDefault();
                return;
            }
            if (event.target.matches('input,select,textarea')) return;

            if (event.code === 'Space' && this.route === 'battle' && this.busy) {
                event.preventDefault();
                this.skip();
            }

            if (this.route === 'battle' && !this.busy && /^[1-4]$/.test(event.key)) {
                const slot = Number(event.key) - 1;
                if (legalMoves(this.battle.player).includes(slot)) this.turn(slot);
            }

            if (event.key === 'Escape' && this.route === 'battle' && !this.busy) this.confirmAbandon();
        });

        // A Space keyup must not activate the move button that receives focus after Skip.
        document.addEventListener('keyup', (event) => {
            if (event.code === 'Space' && this.introSpaceHeld) {
                event.preventDefault();
                this.introSpaceHeld = false;
            }
        });
        window.addEventListener('blur', () => { this.introSpaceHeld = false; });
        window.addEventListener('pagehide', () => {
            if (!this.introActive) return;
            this.cancelIntro();
            // A back/forward-cache return must not restore disabled intro-era controls.
            this.render();
        });

        this.root.addEventListener(
            'error',
            (event) => {
                if (event.target.tagName === 'IMG') {
                    const fallback = document.createElement('span');
                    fallback.className = 'missing-art';
                    fallback.setAttribute('role', 'img');
                    fallback.setAttribute('aria-label', 'Original sprite stand-in');
                    fallback.textContent = '◇';
                    event.target.replaceWith(fallback);
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
                theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
                reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            }
        );
    }

    get selected() {
        return (
            this.save?.collection.find((item) => item.instanceId === this.selectedId) ||
            this.save?.collection[0]
        );
    }

    applySettings() {
        const settings = this.settings;
        document.documentElement.dataset.theme = settings.theme;
        document.documentElement.style.colorScheme = settings.theme;
        document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
        document.documentElement.style.setProperty('--ui-scale', settings.uiScale);
        this.scene?.settingsChanged(settings);
        this.titleScene?.settingsChanged(settings);
        this.audio.apply(settings);
    }

    commit(transform) {
        this.save = this.saveService.commit(this.save, transform);
        this.updateWallet();
        return this.save;
    }

    toast(message) {
        const element = document.querySelector('#toast');
        element.textContent = message;
        element.classList.add('visible');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
    }

    updateWallet() {
        const element = this.root.querySelector('[data-wallet]');
        if (element) element.textContent = (this.save?.trainer.coins ?? 0).toLocaleString();
    }

    async preview() {
        const route = this.route;
        if (route === 'menu' && !this.recovery) return;
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
        this.cancelIntro();
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

    render() {
        document.body.dataset.screen = this.recovery ? 'recovery' : this.route;
        this.root.replaceChildren(createHeader(this), createScreen(this), createFooter(this));
        this.root.inert = Boolean(this.introActive);
        const titleHost = this.root.querySelector('.title-environment');
        this.scene?.setActive(!titleHost);
        if (titleHost) {
            if (this.titleScene) this.titleScene.attach(titleHost);
            else if (!this.graphicsError) {
                try { this.titleScene = new TitleScene(titleHost, this.settings); }
                catch { /* The CSS sky and native PLAY remain usable without WebGL. */ }
            }
        } else {
            this.titleScene?.dispose();
            this.titleScene = null;
        }

        if (this.graphicsError)
            this.toast('WebGL unavailable. Battle rules remain playable; try hardware acceleration.');
    }

    filterCards() {
        const query = this.filter.trim().toLowerCase();
        this.root.querySelectorAll('.creature-card').forEach((element) => {
            const species = pokemon[element.dataset.id];
            element.hidden = !!query && !`${species.id} ${species.types.join(' ')}`.includes(query);
        });
    }

    async click(event) {
        if (this.introActive) return;
        const element = event.target.closest('[data-action]');
        if (!element || element.disabled) return;

        const action = element.dataset.action;
        this.audio.unlock();
        if (action !== 'move') this.audio.cue('select');

        try {
            if (action === 'skip') {
                this.skip();
                return;
            }

            if (action === 'nav') {
                if (this.route === 'battle') {
                    if (this.busy) return;
                    this.confirmAbandon(element.dataset.route);
                    return;
                }
                if (this.pendingReward) {
                    this.toast('Save your pending rewards first.');
                    return;
                }
                this.go(element.dataset.route);
            } else if (action === 'starter') {
                const settings = { ...this.settings };
                this.commit(() => ({ ...newSave(element.dataset.id, identity()), settings }));
                this.tempSettings = null;
                this.selectedId = this.save.collection[0].instanceId;
                this.audio.cue('start');
                this.go(this.afterStarter || 'setup');
            } else if (action === 'opponent') {
                this.opponentId = element.dataset.id;
                this.render();
                this.preview();
            } else if (action === 'detail') {
                this.detailId = element.dataset.id;
                this.render();
                this.preview();
            } else if (action === 'random') {
                this.opponentId =
                    speciesIds[crypto.getRandomValues(new Uint32Array(1))[0] % speciesIds.length];
                this.render();
                this.preview();
            } else if (action === 'start' || action === 'replay') {
                await this.start();
            } else if (action === 'move') {
                await this.turn(Number(element.dataset.slot));
            } else if (action === 'buy') {
                const id = element.dataset.id;
                this.modal(
                    'Welcome a new partner?',
                    `${pokemon[id].displayName} will join your collection for ${pokemon[id].priceCoins} coins. This unlock is permanent.`,
                    () => {
                        this.commit((save) => purchase(save, id, identity()));
                        this.audio.cue('purchase');
                        this.render();
                        this.toast(`${pokemon[id].displayName} joined your collection.`);
                    },
                    'Recruit partner',
                );
            } else if (action === 'use') {
                this.selectedId = this.save.collection.find(
                    (item) => item.speciesId === element.dataset.id,
                ).instanceId;
                this.go('setup');
            } else if (action === 'abandon') {
                this.confirmAbandon();
            } else if (action === 'speed') {
                this.setSetting('speed', (this.settings.speed % 3) + 1);
                if (this.route === 'battle') element.textContent = `${this.settings.speed}× speed`;
            } else if (action === 'retry-reward') {
                this.commit((save) => applyReward(save, this.pendingReward));
                this.pendingReward = null;
                this.render();
            } else if (action === 'export') {
                const blob = new Blob([this.saveService.raw()], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'battle-atelier-save.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } else if (action === 'reset') {
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
        } catch (error) {
            this.toast(error.message);
        }
    }

    change(event) {
        if (this.introActive) return;
        const element = event.target;

        try {
            if (element.id === 'owned-select') {
                this.selectedId = element.value;
                this.render();
                this.preview();
            } else if (['tier', 'difficulty', 'arena-select'].includes(element.id)) {
                this[element.id === 'arena-select' ? 'arenaId' : element.id] = element.value;
                this.render();
                this.preview();
            } else if (Object.hasOwn(DEFAULT_SETTINGS, element.id)) {
                this.setSetting(
                    element.id,
                    element.id === 'theme' ? element.value
                        : element.type === 'checkbox' ? element.checked : Number(element.value),
                );
            }
        } catch (error) {
            this.toast(error.message);
            this.render();
        }
    }

    setSetting(key, value) {
        if (this.save) this.commit((save) => ({ ...save, settings: { ...save.settings, [key]: value } }));
        else this.tempSettings = { ...this.settings, [key]: value };
        this.applySettings();
        // Before starter selection there is no game save; retain only the appearance preference.
        if (key === 'theme') {
            try { localStorage.setItem('nitrous.battle-atelier.theme', value); }
            catch { this.toast('Appearance changed for this session; browser storage is unavailable.'); }
        }
    }

    modal(heading, message, accept, label = 'Confirm') {
        const view = createModal(heading, message, label);
        const dialog = view.querySelector('dialog');
        document.body.append(view);

        dialog.addEventListener('close', () => {
            if (dialog.returnValue === 'confirm') {
                try {
                    accept();
                } catch (error) {
                    this.toast(error.message);
                }
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
        if (this.busy || this.introActive || this.pendingReward || this.route === 'battle') return;
        const selected = this.selected;
        if (!selected || !pokemon[this.opponentId]) return;
        const id = identity();
        // Validate/create before locking input; a domain failure cannot leave a busy screen.
        const battle = createBattle({
            instance: selected,
            opponentId: this.opponentId,
            tier: this.tier,
            difficulty: this.difficulty,
            seed: id.seed,
            battleId: crypto.randomUUID(),
        });
        const token = {};
        this.introToken = token;
        this.introActive = true;
        this.busy = true;
        this.oldLevel = selected.level;
        this.battle = battle;
        this.displayBattle = structuredClone(battle);
        this.route = 'battle';
        this.log = [
            `${pokemon[this.opponentId].displayName} enters the arena.`,
            `Your move, ${pokemon[selected.speciesId].displayName}.`,
        ];

        try {
            this.render();
            const view = createBattleIntro(this);
            this.intro = new BattleIntro(view, {
                reducedMotion: this.settings.reducedMotion,
                cue: (kind) => this.audio.cue(kind),
            });
            document.body.append(view);
            const prepare = Promise.resolve().then(() => {
                if (this.introToken !== token) return;
                this.scene?.setArena(this.arenaId);
                return this.scene?.setActors(selected.speciesId, battle.opponent.speciesId, 'battle');
            });
            await this.intro.run(prepare);
        } catch (error) {
            this.toast(`Introduction unavailable: ${error.message}`);
        } finally {
            // A cancelled startup cannot re-render or unlock a subsequent battle.
            if (this.introToken === token) {
                this.cancelIntro();
                this.render();
                this.root.querySelector('.move-button:not([disabled])')?.focus({ preventScroll: true });
            }
        }
    }

    cancelIntro() {
        if (!this.introActive) return;
        this.introToken = null;
        this.intro?.cancel();
        this.intro = null;
        this.introActive = false;
        this.busy = false;
        this.root.inert = false;
    }

    appendLog(message) {
        this.log.push(message);
        this.log = this.log.slice(-60);

        const element = this.root.querySelector('.battle-log');
        if (element) element.innerHTML = recentBattleLog(this);
    }

    refreshHUD() {
        for (const side of ['player', 'opponent']) {
            const element = this.root.querySelector(`#${side}-hud`);
            if (element) element.innerHTML = healthPanel(this.displayBattle[side], side);
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
        if (this.introActive) return;
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
                    this.commit((save) => applyReward(save, this.result));
                } catch (error) {
                    this.pendingReward = this.result;
                    this.toast(error.message);
                }
            }

            for (const event of resolution.events) {
                const actor = this.displayBattle[event.actor];
                const name = actor?.name || '';

                if (event.type === 'PP') {
                    actor.moves[event.slot].pp = event.pp;
                    continue;
                }

                if (event.type === 'MOVE') {
                    this.appendLog(`${name} uses ${event.name}.`);
                    await this.wait(420);
                }

                if (event.type === 'VFX') {
                    this.audio.cue('hit', event.moveType);
                    if (!this.skipping) {
                        const playback = this.scene?.play(event);
                        // Renderer completion shares its speed clock and resolves on Skip/context loss.
                        if (playback) await playback;
                        else await this.wait(resolveMoveVFX(event, moves[event.moveId], this.settings).duration * 1000);
                    }
                }

                if (event.type === 'DAMAGE') {
                    actor.hp = event.afterHP;
                    this.refreshHUD();
                    if (!this.skipping) this.scene?.hit(event.actor);
                    this.floatDamage(event.actor, event.amount, event.critical);

                    let message = `${name} lost ${event.amount} HP.`;
                    if (['burn', 'poison', 'confusion', 'recoil'].includes(event.cause))
                        message = `${name} takes ${event.amount} ${event.cause} damage.`;
                    if (event.critical) message += ' A critical hit!';
                    if (event.effectiveness > 1) message += ' Super effective!';
                    if (event.effectiveness > 0 && event.effectiveness < 1) message += ' Not very effective.';
                    this.appendLog(message);
                    await this.wait(500);
                }

                if (event.type === 'STATUS') {
                    if (event.status === 'confusion') actor.confusion = event.duration;
                    else actor.status = event.status;
                    this.refreshHUD();
                    this.audio.cue('status');
                    this.appendLog(`${name}: ${title(event.status)}.`);
                    await this.wait(400);
                }

                if (event.type === 'STATUS_CLEARED') {
                    actor.status = null;
                    this.refreshHUD();
                    this.appendLog(`${name} recovered from ${event.status}.`);
                    await this.wait(220);
                }

                if (event.type === 'CONFUSION_CLEARED') {
                    actor.confusion = 0;
                    this.refreshHUD();
                    this.appendLog(`${name} is no longer confused.`);
                }

                if (event.type === 'STAGE') {
                    this.appendLog(
                        `${name}'s ${title(event.stat)} ${event.delta > 0 ? 'rose' : 'fell'}${Math.abs(event.delta) > 1 ? ' sharply' : ''}.`,
                    );
                    await this.wait(350);
                }

                if (event.type === 'IMMUNE') {
                    this.appendLog(`${name} is immune to that move.`);
                    await this.wait(450);
                }

                if (event.type === 'MISS') {
                    this.appendLog(`${name}'s attack missed.`);
                    await this.wait(350);
                }

                if (event.type === 'FAILED') {
                    this.appendLog('The move had no effect.');
                    await this.wait(300);
                }

                if (event.type === 'BLOCKED') {
                    this.appendLog(
                        `${name} ${event.reason === 'confusion' ? 'hurt itself in confusion' : `could not act: ${event.reason}`}.`,
                    );
                    await this.wait(400);
                }

                if (event.type === 'FAINT') {
                    this.scene?.faint(event.actor);
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
            }
            this.render();
        } catch (error) {
            this.scene?.clearEffects();
            this.busy = false;
            this.toast(error.message);
            this.render();
        }
    }

    floatDamage(side, amount, critical) {
        if (this.skipping) return;
        const wrap = this.root.querySelector('#battle-floats');
        if (!wrap) return;

        const element = document.createElement('b');
        element.className = `damage-float ${side}`;
        element.textContent = `−${amount}${critical ? '!' : ''}`;
        wrap.append(element);
        setTimeout(() => element.remove(), 1000);
    }
}
