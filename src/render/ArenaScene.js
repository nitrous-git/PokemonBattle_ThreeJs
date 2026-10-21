import * as THREE from 'three';
import { MoveVFX, resolveMoveVFX } from './MoveVFX.js';
import { moves } from '../data/catalogue.js';
import { assetUrl } from '../assetUrl.js';
import sprites from '../data/generated/spriteManifest.json' with { type: 'json' };

export const PALETTES = {
    meadow: {
        name: 'Verdant Meadow',
        caption: 'A quiet clearing. A new challenge.',
        sky: '#c9e0cf',
        fog: '#c2d9c6',
        floor: '#5f9982',
        pad: '#b3c994',
        rim: '#304f46',
        trees: '#225d50',
        rock: '#6e8d79',
        accent: '#e2c475',
    },
    canyon: {
        name: 'Crimson Canyon',
        caption: 'Where warm winds meet weathered stone.',
        sky: '#e6b8a2',
        fog: '#d8a68e',
        floor: '#b87c59',
        pad: '#e2bb84',
        rim: '#754e40',
        trees: '#916549',
        rock: '#9a5d48',
        accent: '#ffe0a4',
    },
    astral: {
        name: 'Astral Chamber',
        caption: 'Among the stars, make your move.',
        sky: '#1c2344',
        fog: '#282e50',
        floor: '#343a60',
        pad: '#696488',
        rim: '#292a46',
        trees: '#4d4d73',
        rock: '#44486c',
        accent: '#b6b6ff',
    },
};

const HIT_COLOR = new THREE.Color('#ffc4ad');
const vec = (x, y, z) => new THREE.Vector3(x, y, z);

function disposeGroup(group) {
    group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
            const list = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of list) m.dispose();
        }
    });
    group.clear();
}

export class ArenaScene {
    constructor(canvas, onContext) {
        this.canvas = canvas;
        this.settings = {};
        this.mode = 'menu';
        this.elapsed = 0;
        this.actors = {};
        this.effects = [];
        this.textureCache = new Map();
        this.ticket = 0;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 180);
        this.baseCamera = vec(0, 9.6, 17);
        this.camera.position.copy(this.baseCamera);
        this.target = vec(0, 0.65, 0);
        this.camera.lookAt(this.target);

        this.world = new THREE.Group();
        this.scene.add(this.world);
        this.fx = new THREE.Group();
        this.scene.add(this.fx);
        this.moveVFX = new MoveVFX();

        this.scene.add(new THREE.HemisphereLight('#f3f0d6', '#3e5c53', 2.6));
        const sun = new THREE.DirectionalLight('#fff0cb', 3);
        sun.position.set(-8, 14, 6);
        this.scene.add(sun);

        this.loader = new THREE.TextureLoader();

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas.parentElement);
        this.resize();

        this.onContextLost = (e) => {
            e.preventDefault();
            this.lost = true;
            this.clearEffects();
            onContext?.(true);
        };
        this.onContextRestored = () => {
            this.lost = false;
            onContext?.(false);
        };
        canvas.addEventListener('webglcontextlost', this.onContextLost);
        canvas.addEventListener('webglcontextrestored', this.onContextRestored);

        let last = performance.now();
        const frame = (now) => {
            const elapsed = Math.max(0, (now - last) / 1000);
            const dt = Math.min(0.05, elapsed);
            last = now;
            this.update(dt, elapsed);
            if (!this.lost) this.renderer.render(this.scene, this.camera);
            this.raf = requestAnimationFrame(frame);
        };
        this.raf = requestAnimationFrame(frame);
    }

    settingsChanged(settings) {
        this.settings = settings;
        this.renderer.setPixelRatio(settings.lowVFX ? 1 : Math.min(devicePixelRatio, 1.5));
        this.resize();
    }

    resize() {
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.fov = width / height < 0.8 ? 68 : width / height < 1.3 ? 49 : 36;
        this.camera.updateProjectionMatrix();
    }

    mesh(geometry, color, x, y, z, group = this.world) {
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }),
        );
        mesh.position.set(x, y, z);
        group.add(mesh);
        return mesh;
    }

    setArena(id) {
        if (this.arena === id) return;
        this.arena = id;
        disposeGroup(this.world);
        const p = PALETTES[id];

        this.scene.background = new THREE.Color(p.sky);
        this.scene.fog = new THREE.Fog(p.fog, 20, 64);

        // The terrain is dimensional; battlefield pads sit above it with layered stone edges.
        const terrain = new THREE.PlaneGeometry(120, 100, 44, 40),
            pos = terrain.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i),
                y = pos.getY(i);
            const edge = Math.max(0, Math.sqrt(x * x + y * y) - 10);
            pos.setZ(i, Math.sin(x * 0.14) * Math.cos(y * 0.12) * Math.min(6, edge * 0.28));
        }
        terrain.computeVertexNormals();

        const land = this.mesh(terrain, p.floor, 0, -0.5, -10);
        land.rotation.x = -Math.PI / 2;

        const center = this.mesh(new THREE.CylinderGeometry(9, 9.4, 0.22, 80), p.floor, 0, -0.32, 0);
        center.material.color.offsetHSL(0, -0.03, 0.035);

        for (const [x, z, rad] of [
            [-3, 2.7, 2.7],
            [3, -3.1, 2.25],
        ]) {
            this.mesh(new THREE.CylinderGeometry(rad, rad + 0.12, 0.32, 64), p.rim, x, -0.05, z);
            this.mesh(new THREE.CylinderGeometry(rad - 0.12, rad, 0.12, 64), p.pad, x, 0.17, z);

            const ring = this.mesh(
                new THREE.RingGeometry(rad - 0.3, rad - 0.27, 72),
                p.accent,
                x,
                0.238,
                z,
            );
            ring.rotation.x = -Math.PI / 2;

            const inner = this.mesh(
                new THREE.RingGeometry(rad * 0.69, rad * 0.7, 72),
                p.rim,
                x,
                0.241,
                z,
            );
            inner.rotation.x = -Math.PI / 2;
            inner.material.transparent = true;
            inner.material.opacity = 0.12;

            const shadow = this.mesh(new THREE.CircleGeometry(rad * 0.48, 40), '#1d3434', x, 0.25, z);
            shadow.rotation.x = -Math.PI / 2;
            shadow.scale.y = 0.55;
            shadow.material.transparent = true;
            shadow.material.opacity = 0.19;
        }

        // Deterministic scenery, deliberately outside the actors' readable silhouettes.
        for (let i = 0; i < 30; i++) {
            const angle = i * 2.39996,
                radius = 12 + (i % 5) * 2.4,
                x = Math.cos(angle) * radius,
                z = Math.sin(angle) * radius - 6;

            if (z > 4 && Math.abs(x) < 13) continue;
            const h = 2.2 + (i % 6) * 0.8;

            if (id === 'meadow') {
                this.mesh(new THREE.CylinderGeometry(0.12, 0.22, h * 0.65, 6), '#6a7660', x, h * 0.25, z);
                for (let n = 0; n < 3; n++)
                    this.mesh(
                        new THREE.ConeGeometry(1.35 - n * 0.3, h * 0.65, 7),
                        n === 2 ? '#4f8a68' : p.trees,
                        x,
                        h * 0.6 + n * 0.65,
                        z,
                    );
            } else if (id === 'canyon') {
                const rock = this.mesh(new THREE.CylinderGeometry(1.2, 1.8, h, 5), p.rock, x, h * 0.4, z);
                rock.rotation.z = Math.sin(i) * 0.08;
                this.mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.24, 5), p.pad, x, h * 0.9, z);
            } else {
                const pillar = this.mesh(new THREE.BoxGeometry(0.8, h, 0.85), p.rock, x, h * 0.5, z);
                pillar.rotation.z = Math.sin(i) * 0.16;

                const cap = this.mesh(new THREE.OctahedronGeometry(0.35), p.accent, x, h + 0.5, z);
                cap.material.emissive = new THREE.Color(p.accent);
                cap.material.emissiveIntensity = 0.6;
            }
        }

        for (let i = 0; i < 34; i++) {
            const x = Math.sin(i * 9.1) * 17,
                z = Math.cos(i * 7.7) * 13 - 2;

            if (Math.abs(x) < 7 && z < 7 && z > -6) continue;

            const rock = this.mesh(
                new THREE.DodecahedronGeometry(0.25 + (i % 3) * 0.18, 0),
                p.rock,
                x,
                -0.03,
                z,
            );
            rock.scale.y = 0.6;
        }

        if (id === 'meadow')
            for (let i = 0; i < 100; i++) {
                const x = Math.sin(i * 8.7) * 19,
                    z = Math.cos(i * 5.3) * 18;

                if (Math.abs(x) < 6 && Math.abs(z) < 7) continue;

                const tuft = this.mesh(new THREE.ConeGeometry(0.11, 0.5, 3), '#91b58b', x, -0.2, z);
                tuft.rotation.z = Math.sin(i) * 0.3;
            }

        this.ambient = [];
        for (let i = 0; i < 50; i++) {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(id === 'astral' ? 0.028 : 0.018, 4, 3),
                new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.65 }),
            );
            m.position.set(Math.sin(i * 23) * 18, 1 + (i % 10) * 0.6, Math.cos(i * 13) * 15);
            this.world.add(m);
            this.ambient.push(m);
        }
    }

    async texture(url) {
        if (!this.textureCache.has(url))
            this.textureCache.set(
                url,
                this.loader.loadAsync(assetUrl(url)).then((t) => {
                    t.colorSpace = THREE.SRGBColorSpace;
                    t.magFilter = THREE.NearestFilter;
                    t.minFilter = THREE.NearestFilter;
                    t.generateMipmaps = false;
                    return t;
                }),
            );
        return this.textureCache.get(url);
    }

    fallback(side) {
        const c = document.createElement('canvas');
        c.width = 96;
        c.height = 100;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffe1a0';
        ctx.beginPath();
        ctx.moveTo(48, 5);
        ctx.lineTo(86, 35);
        ctx.lineTo(75, 92);
        ctx.lineTo(21, 92);
        ctx.lineTo(10, 35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2c3c43';
        if (side === 'front') {
            ctx.fillRect(27, 43, 12, 10);
            ctx.fillRect(58, 43, 12, 10);
        } else {
            ctx.fillRect(28, 43, 40, 5);
            ctx.fillRect(35, 55, 26, 5);
        }
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        return t;
    }

    async setActors(playerId, opponentId, mode = 'battle') {
        this.clearEffects();
        this.mode = mode;
        const ticket = ++this.ticket;
        const wanted = [
            ['player', playerId, 'back', vec(-3, 0.29, 2.7)],
            ['opponent', opponentId, 'front', vec(3, 0.29, -3.1)],
        ];

        await Promise.all(
            wanted.map(async ([key, id, side, position]) => {
                const record = sprites[id],
                    a = record[side];
                let texture,
                    missing = false;

                try {
                    texture = (await this.texture(a.atlasUrl)).clone();
                    texture.needsUpdate = true;
                } catch {
                    texture = this.fallback(side);
                    missing = true;
                }

                if (ticket !== this.ticket) {
                    texture.dispose();
                    return;
                }

                const old = this.actors[key];
                if (old) {
                    this.scene.remove(old.sprite);
                    old.sprite.material.map.dispose();
                    old.sprite.material.dispose();
                }

                const material = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.08,
                    toneMapped: false,
                    depthWrite: false,
                });

                const sprite = new THREE.Sprite(material);
                sprite.center.set(0.5, 0);
                sprite.position.copy(position);

                let height =
                    id === 'charizard' ? 3.6 : id === 'blastoise' ? 3.3 : id === 'gastly' ? 2.6 : 2.75;
                const [w, h] = missing ? [96, 100] : a.size;
                sprite.scale.set((height * w) / h, height, 1);
                this.scene.add(sprite);

                this.actors[key] = {
                    sprite,
                    base: position.clone(),
                    height,
                    data: missing ? null : a,
                    time: 0,
                    hit: 0,
                    lunge: 0,
                    fade: false,
                };

                sprite.visible = mode === 'battle' || key === 'opponent';

                if (mode !== 'battle') {
                    sprite.position.set(3.5, 0.3, -1.3);
                    this.actors[key].base.copy(sprite.position);
                    sprite.scale.multiplyScalar(1.28);
                }
            }),
        );
    }

    sync(state) {
        for (const side of ['player', 'opponent']) {
            const a = this.actors[side];
            if (a) {
                a.fade = state[side].hp <= 0;
                a.sprite.material.opacity = a.fade ? 0.2 : 1;
                a.sprite.material.color.set('#ffffff');
                a.sprite.position.copy(a.base);
            }
        }
    }

    hit(side) {
        const a = this.actors[side];
        if (a) a.hit = 0.45;
    }

    faint(side) {
        const a = this.actors[side];
        if (a) a.fade = true;
    }

    play(event) {
        const actor = this.actors[event.actor], target = this.actors[event.target];
        if (!actor || !target || this.lost) return null;
        const config = resolveMoveVFX(event, moves[event.moveId], this.settings);
        const start = actor.base.clone().add(vec(0, actor.height * 0.6, 0));
        const end = target.base.clone().add(vec(0, target.height * 0.6, 0));
        if (config.category === 'physical' && !config.reduced) actor.lunge = 0.6;
        const effect = this.moveVFX.create(config, start, end, this.camera);
        this.effects.push(effect);
        this.fx.add(effect.group);
        return effect.finished;
    }

    clearEffects() {
        for (const effect of this.effects) effect.dispose();
        this.effects = [];
        for (const a of Object.values(this.actors)) {
            a.hit = 0;
            a.lunge = 0;
            a.sprite.position.copy(a.base);
            a.sprite.material.color.set('#ffffff');
        }
        this.camera.position.copy(this.baseCamera);
        this.camera.lookAt(this.target);
    }

    update(dt, effectDt = dt) {
        this.elapsed += dt;
        const reduced = this.settings.reducedMotion;
        const playbackDt = effectDt * (this.settings.speed || 1);

        for (const [key, a] of Object.entries(this.actors)) {
            if (a.data && !reduced) {
                const cycle = a.data.frames.reduce((sum, f) => sum + f.durationMs, 0);
                a.time = (a.time + dt * 1000) % cycle;

                let t = a.time,
                    frame = a.data.frames[0];
                for (const f of a.data.frames) {
                    frame = f;
                    if (t < f.durationMs) break;
                    t -= f.durationMs;
                }

                const [x, y, w, h] = frame.rectPx,
                    [aw, ah] = a.data.atlasSize;
                const tex = a.sprite.material.map;
                tex.repeat.set(w / aw, h / ah);
                tex.offset.set(x / aw, 1 - (y + h) / ah);
            } else if (a.data) {
                const [x, y, w, h] = a.data.frames[0].rectPx,
                    [aw, ah] = a.data.atlasSize;
                a.sprite.material.map.repeat.set(w / aw, h / ah);
                a.sprite.material.map.offset.set(x / aw, 1 - (y + h) / ah);
            }

            a.sprite.position.copy(a.base);

            if (a.hit > 0) {
                a.hit = Math.max(0, a.hit - playbackDt);
                a.sprite.material.color.set('#ffffff').lerp(HIT_COLOR, a.hit / 0.45);
                if (!reduced) a.sprite.position.x += Math.sin(a.hit * 70) * 0.08;
            } else a.sprite.material.color.set('#ffffff');

            if (a.lunge > 0 && !reduced) {
                a.lunge = Math.max(0, a.lunge - playbackDt);
                const f = Math.sin((1 - a.lunge / 0.6) * Math.PI);
                a.sprite.position.x += (key === 'player' ? 1 : -1) * f * 0.6;
            }

            if (a.fade) a.sprite.material.opacity = Math.max(0.15, a.sprite.material.opacity - dt * 1.8);
        }

        for (const effect of this.effects) effect.update(effectDt, this.settings.speed);
        this.effects = this.effects.filter((effect) => !effect.done);

        if (!reduced)
            for (let i = 0; i < (this.ambient?.length || 0); i++) {
                const m = this.ambient[i];
                m.position.y += Math.sin(this.elapsed + i) * dt * 0.08;
                m.visible = !this.settings.lowVFX || i < 15;
            }

        this.camera.position.copy(this.baseCamera);
        if (!reduced) {
            const pulse = this.effects.reduce((max, effect) => Math.max(max, effect.feedback), 0);
            this.camera.position.z -= pulse;
        }
        if (this.mode === 'menu' && !reduced)
            this.camera.position.x = Math.sin(this.elapsed * 0.15) * 0.12;

        this.camera.lookAt(this.target);
    }

    dispose() {
        cancelAnimationFrame(this.raf);
        this.ticket++; // Invalidate outstanding sprite loads.
        this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
        this.observer.disconnect();
        this.clearEffects();
        this.moveVFX.dispose();
        disposeGroup(this.world);

        for (const a of Object.values(this.actors)) {
            a.sprite.material.map.dispose();
            a.sprite.material.dispose();
        }

        for (const promise of this.textureCache.values())
            promise.then((t) => t.dispose()).catch(() => {});

        this.renderer.dispose();
    }
}