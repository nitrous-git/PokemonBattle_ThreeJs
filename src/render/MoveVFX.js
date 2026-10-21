import * as THREE from 'three';

// Presentation only: never feed visual randomness or these overrides into combat rules.
export const TYPE_COLOR = {
  normal: '#f5e9ca',
  fire: '#ff824c',
  water: '#69d4ff',
  electric: '#ffe576',
  grass: '#9cf29a',
  ice: '#b7faff',
  fighting: '#ff997b',
  poison: '#dba1ff',
  ground: '#d7aa77',
  flying: '#c1e7f3',
  psychic: '#ff9bd5',
  bug: '#c7de6b',
  rock: '#d5bc8b',
  ghost: '#ae95f3',
  dragon: '#a8a1ff',
  dark: '#927cb0',
  steel: '#cee3e8',
  fairy: '#ffb7db',
  typeless: '#ffffff',
};
const FAMILIES = {
  fire: 'fire',
  water: 'water',
  electric: 'electric',
  rock: 'rock',
  ground: 'rock',
  ice: 'ice',
  grass: 'grass',
  bug: 'grass',
  psychic: 'energy',
  ghost: 'energy',
  dragon: 'energy',
  poison: 'energy',
  fairy: 'energy',
  dark: 'physical',
  normal: 'physical',
  fighting: 'physical',
  steel: 'physical',
  flying: 'physical',
};
const OVERRIDES = {
  flamethrower: { style: 'stream' },
  'hydro-pump': { style: 'beam' },
  'bubble-beam': { style: 'volley' },
  'rock-slide': { style: 'rain' },
  'earth-power': { style: 'eruption' },
  bulldoze: { style: 'eruption' },
  'ice-beam': { style: 'beam' },
  'shadow-ball': { style: 'orb' },
  'dragon-claw': { family: 'physical', style: 'claw' },
  'metal-claw': { family: 'physical', style: 'claw' },
  'flash-cannon': { family: 'energy', style: 'beam' },
  'dragon-breath': { style: 'beam' },
  psybeam: { style: 'beam' },
  'seed-bomb': { style: 'orb' },
};
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - (1 - clamp(v)) ** 3;
const envelope = (p) => Math.sin(clamp(p) * Math.PI);

/** Resolve from authored metadata; unknown future moves retain a typed fallback. */
export function resolveMoveVFX(event = {}, move = {}, settings = {}) {
  const type = move.type || event.moveType || 'typeless';
  const status = (move.category || event.category) === 'status';
  const power = Number(move.power) || 0;
  const tier = status ? 0 : power >= 90 ? 3 : power >= 55 ? 2 : 1;
  const preset = move.vfxPreset;
  const family = status ? 'status' : FAMILIES[preset] || FAMILIES[type] || 'physical';
  const override = status ? {} : OVERRIDES[event.moveId || move.id] || {};
  return {
    type,
    tier,
    family,
    style: 'projectile',
    ...override,
    color: TYPE_COLOR[type] || TYPE_COLOR.typeless,
    category: move.category || event.category || 'special',
    reduced: Boolean(settings.reducedMotion),
    low: Boolean(settings.lowVFX),
    duration: settings.reducedMotion ? 0.28 : status ? 0.62 : [0, 0.58, 0.78, 1.02][tier],
    impact: status ? 0 : 0.57,
    size: status ? 1 : [0, 0.65, 0.95, 1.3][tier],
  };
}

/** Shared geometry/texture pool. Materials belong to each effect and are disposed on finish. */
export class MoveVFX {
  constructor() {
    this.geometries = {
      orb: new THREE.IcosahedronGeometry(1, 1),
      rock: new THREE.DodecahedronGeometry(1, 0),
      flame: new THREE.ConeGeometry(0.65, 2, 7),
      crystal: new THREE.OctahedronGeometry(1),
      ring: new THREE.TorusGeometry(1, 0.035, 4, 40),
      slash: new THREE.TorusGeometry(1, 0.045, 4, 28, Math.PI * 0.85),
      beam: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
      leaf: new THREE.CircleGeometry(1, 4),
    };
    const size = 32,
      pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
        const i = (y * size + x) * 4;
        pixels.set([255, 255, 255, Math.round(Math.max(0, 1 - r) ** 2 * 255)], i);
      }
    this.glow = new THREE.DataTexture(pixels, size, size);
    this.glow.magFilter = this.glow.minFilter = THREE.LinearFilter;
    this.glow.needsUpdate = true;
  }

  create(config, start, end, camera) {
    return new MoveEffect(this, config, start, end, camera);
  }

  dispose() {
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.glow.dispose();
  }
}

class MoveEffect {
  constructor(pool, config, start, end, camera) {
    this.pool = pool;
    this.config = config;
    this.start = start.clone();
    this.end = end.clone();
    this.camera = camera;
    this.group = new THREE.Group();
    this.nodes = [];
    this.materials = new Set();
    this.ownedGeometries = [];
    this.time = 0;
    this.duration = config.duration;
    this.done = false;
    this.feedback = 0;
    this.finished = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.axis = end.clone().sub(start);
    this.length = this.axis.length();
    this.axis.normalize();
    if (!this.length) this.axis.set(1, 0, 0);
    this.orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      this.axis,
    );
    this.side = new THREE.Vector3(-this.axis.z, 0, this.axis.x).normalize();
    if (config.reduced || config.family === 'status') this.aura();
    else {
      if (['beam', 'stream'].includes(config.style)) this.beam();
      else if (config.family === 'electric') this.lightning();
      else if (config.family === 'rock') this.rocks();
      else if (config.family === 'physical') this.slashes();
      else this.projectile();
      this.impact();
    }
    this.update(0);
  }

  node(shape, color, animate, { solid = false, opacity = 1 } = {}) {
    const options = {
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      // Keep pigment on bright arenas; only soft halos add light.
      blending: shape === 'glow' && !solid ? THREE.AdditiveBlending : THREE.NormalBlending,
    };
    const material =
      shape === 'glow'
        ? new THREE.SpriteMaterial({ ...options, map: this.pool.glow })
        : shape === 'rock'
          ? new THREE.MeshStandardMaterial({
              ...options,
              roughness: 0.9,
              flatShading: true,
              toneMapped: true,
            })
          : new THREE.MeshBasicMaterial({ ...options, side: THREE.DoubleSide });
    const mesh =
      shape === 'glow'
        ? new THREE.Sprite(material)
        : new THREE.Mesh(this.pool.geometries[shape], material);
    this.materials.add(material);
    this.group.add(mesh);
    this.nodes.push({ mesh, animate, opacity });
    return mesh;
  }

  // Single local swell for reduced motion; no travel, rotation, shake or blinking.
  aura() {
    const c = this.config;
    this.node('glow', c.color, (m, p) => {
      m.position.copy(this.end);
      m.scale.setScalar(c.reduced ? 2.5 : 3.2);
      m.material.opacity = envelope(p) * 0.65;
    });
    for (let i = 0; i < (c.low || c.reduced ? 1 : 3); i++) {
      this.node('ring', c.color, (m, p) => {
        m.position.copy(this.end);
        m.position.y += c.reduced ? 0 : (p - 0.5) * 1.3 + i * 0.3;
        m.quaternion.copy(this.camera.quaternion);
        m.scale.setScalar(c.reduced ? 0.7 : 0.5 + p * 0.65 + i * 0.12);
        m.material.opacity = envelope(p) * 0.65;
      });
    }
    if (!c.low && !c.reduced)
      for (let i = 0; i < 8; i++) {
        this.node(c.type === 'grass' ? 'leaf' : 'crystal', c.color, (m, p) => {
          const angle = i * 2.39996 + p;
          m.position.copy(this.end);
          m.position.x += Math.cos(angle) * 0.8;
          m.position.z += Math.sin(angle) * 0.8;
          m.position.y += p * 1.3 - 0.7;
          m.scale.set(0.05, 0.12, 0.05);
          m.material.opacity = envelope(p) * 0.8;
        });
      }
  }

  projectile() {
    const c = this.config;
    const count = c.low ? 4 : c.family === 'grass' ? 10 : 14;
    const travel = (p) => clamp(p / c.impact);
    // Spectral cores keep a dark center inside a colored halo.
    const coreColor = c.type === 'ghost' ? '#39245d' : c.family === 'fire' ? '#fff0a5' : c.color;
    for (let i = 0; i < (c.style === 'volley' ? 3 : 1); i++) {
      const delay = i * 0.07;
      this.node(
        'orb',
        coreColor,
        (m, p) => {
          const t = clamp((p - delay) / (c.impact - delay));
          m.position.lerpVectors(this.start, this.end, ease(t));
          m.scale.setScalar(c.size * (c.style === 'orb' ? 0.42 : 0.22));
          m.visible = p >= delay;
          m.material.opacity = p < c.impact ? 0.95 : clamp(1 - (p - c.impact) * 10);
        },
        { solid: true },
      );
    }
    this.node('glow', c.color, (m, p) => {
      m.position.lerpVectors(this.start, this.end, ease(travel(p)));
      m.scale.setScalar(c.size * 2.4);
      m.material.opacity = envelope(travel(p)) * 0.8;
    });
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996;
      const shape = c.family === 'grass' ? 'leaf' : c.family === 'ice' ? 'crystal' : 'orb';
      this.node(
        shape,
        i % 4 === 0 ? '#fff4dc' : c.color,
        (m, p) => {
          const t = clamp((p - (i / count) * 0.16) / c.impact);
          m.position.lerpVectors(this.start, this.end, ease(t));
          const radius = Math.sin(t * Math.PI) * c.size * 0.33;
          m.position.addScaledVector(this.side, Math.cos(angle + t * 7) * radius);
          m.position.y += Math.sin(angle + t * 7) * radius;
          const s = c.size * (0.06 + (i % 3) * 0.035);
          m.scale.set(s, c.family === 'fire' || c.family === 'grass' ? s * 2.5 : s, s);
          m.rotation.set(t * 5, angle, t * 9);
          m.material.opacity = envelope(t) * 0.9;
        },
        { solid: c.family === 'grass' },
      );
    }
    if (c.family === 'water' || c.family === 'energy') {
      for (let i = 0; i < (c.low ? 1 : 3); i++)
        this.node('ring', c.color, (m, p) => {
          const t = clamp((p - i * 0.055) / c.impact);
          m.position.lerpVectors(this.start, this.end, ease(t));
          m.quaternion.copy(this.camera.quaternion);
          m.rotateY(c.family === 'energy' ? p * 5 + i : 0);
          m.scale.setScalar(c.size * (0.22 + i * 0.1));
          m.material.opacity = envelope(t);
        });
    }
  }

  beam() {
    const c = this.config;
    const fire = c.family === 'fire';
    const grow = (p) => clamp((p - 0.08) / (c.impact - 0.08));
    // Bright narrow core with a wider translucent sheath, never a full-screen pass.
    for (let i = 0; i < 2; i++)
      this.node('beam', i ? (fire ? '#fff0a0' : '#e3faff') : c.color, (m, p) => {
        const reach = grow(p);
        m.position.lerpVectors(this.start, this.end, reach * 0.5);
        m.quaternion.copy(this.orientation);
        const width = c.size * (i ? 0.055 : fire ? 0.24 : 0.14);
        m.scale.set(width, this.length * reach, width);
        m.material.opacity = envelope(clamp((p - 0.05) / 0.75)) * (i ? 0.8 : 0.32);
      });
    for (let i = 0; i < (c.low ? 6 : 20); i++) {
      const offset = i / (c.low ? 6 : 20);
      this.node(
        fire ? 'flame' : c.family === 'ice' ? 'crystal' : 'ring',
        fire && i % 3 === 0 ? '#ffd34d' : c.color,
        (m, p) => {
          const t = (p * 1.8 + offset) % 1;
          m.visible = p > 0.08 && p < 0.82 && t < grow(p);
          m.position.lerpVectors(this.start, this.end, t);
          m.position.addScaledVector(this.side, Math.sin(offset * 35 + p * 8) * t * 0.16);
          m.quaternion.copy(this.orientation);
          if (!fire) m.rotateX(Math.PI / 2);
          const size = c.size * (fire ? 0.07 + t * 0.24 : 0.12 + t * 0.14);
          m.scale.setScalar(size);
          if (fire) {
            m.scale.y *= 1.6;
            m.position.y += t * 0.16;
          } else if (c.family === 'ice') m.scale.y *= 2.5;
          m.material.opacity = envelope(clamp(p / 0.88)) * (fire ? 0.65 : 0.8);
        },
      );
    }
    this.node('glow', c.color, (m, p) => {
      m.position.copy(this.start);
      m.scale.setScalar(c.size * 1.5);
      m.material.opacity = envelope(clamp(p / 0.8)) * 0.8;
    });
  }

  lightning() {
    const c = this.config;
    const branches = c.low ? 1 : c.tier === 3 ? 5 : c.tier === 2 ? 3 : 1;
    for (let b = 0; b < branches; b++) {
      const points = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const point = this.start.clone().lerp(this.end, t);
        const spread = Math.sin(t * Math.PI) * (0.16 + b * 0.12);
        point.addScaledVector(this.side, Math.sin(i * 127.1 + b * 311.7) * spread);
        point.y += Math.sin(i * 269.5 + b * 183.3) * spread;
        points.push(point);
      }
      const curve = new THREE.CurvePath();
      for (let i = 1; i < points.length; i++)
        curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
      const geometry = new THREE.TubeGeometry(
        curve,
        48,
        b ? 0.018 : 0.025 + c.tier * 0.008,
        3,
        false,
      );
      this.ownedGeometries.push(geometry);
      const bolt = this.node('orb', b ? c.color : '#fff5ca', (m, p) => {
        m.material.opacity = envelope(clamp((p - 0.1 - b * 0.025) / 0.65));
        m.geometry.setDrawRange(0, Math.floor(clamp(p / c.impact) * 48) * 18);
      });
      bolt.geometry = geometry;
    }
    this.node('glow', c.color, (m, p) => {
      m.position.copy(this.start);
      m.scale.setScalar(c.size * 1.7);
      m.material.opacity = envelope(clamp(p / 0.55));
    });
  }

  rocks() {
    const c = this.config,
      rain = c.style === 'rain',
      eruption = c.style === 'eruption';
    const count = rain || eruption ? (c.low ? 3 : 6) : 1;
    for (let i = 0; i < count; i++)
      this.node(
        'rock',
        i % 2 ? '#9c7754' : c.color,
        (m, p) => {
          const t = clamp((p - i * 0.025) / (c.impact - i * 0.025));
          m.visible = p < c.impact + 0.05;
          if (rain || eruption) {
            m.position.copy(this.end);
            m.position.x += Math.cos(i * 2.4) * c.size * 0.75;
            m.position.z += Math.sin(i * 2.4) * c.size * 0.6;
            m.position.y += eruption ? Math.sin(t * Math.PI) * 1.5 - 0.8 : (1 - t * t) * 3;
          } else {
            m.position.lerpVectors(this.start, this.end, t);
            m.position.y += Math.sin(t * Math.PI) * 1.5;
          }
          m.scale.setScalar(c.size * (rain ? 0.3 + (i % 3) * 0.06 : 0.5));
          m.rotation.set(t * 7 + i, t * 5, i);
          m.material.opacity = clamp((1 - p) * 5);
        },
        { solid: true },
      );
  }

  slashes() {
    const c = this.config;
    const count = c.style === 'claw' ? 3 : c.low ? 1 : 2;
    for (let i = 0; i < count; i++)
      this.node('slash', i % 2 ? '#ffffff' : c.color, (m, p) => {
        const t = clamp((p - 0.24 - i * 0.045) / 0.48);
        m.position.copy(this.end);
        m.position.x += (i - (count - 1) / 2) * 0.22;
        m.quaternion.copy(this.camera.quaternion);
        m.rotateZ(-0.8 + t * 1.4);
        m.scale.set(c.size * 1.1, c.size * 0.65, c.size);
        m.material.opacity = envelope(t);
      });
    for (let i = 0; i < (c.low ? 2 : 5); i++)
      this.node('crystal', c.color, (m, p) => {
        const t = clamp(p / c.impact);
        m.position.lerpVectors(this.start, this.end, ease(t));
        m.position.y += (i - 2) * 0.15;
        m.quaternion.copy(this.orientation);
        m.scale.set(0.025, c.size * 0.5, 0.025);
        m.material.opacity = envelope(t);
      });
  }

  impact() {
    const c = this.config;
    const impactProgress = (p) => clamp((p - c.impact) / (1 - c.impact));
    this.node('glow', c.color, (m, p) => {
      const t = impactProgress(p);
      m.position.copy(this.end);
      m.scale.setScalar(c.size * (1.5 + ease(t) * 3));
      m.material.opacity = envelope(t) * (c.low ? 0.6 : 0.95);
    });
    for (let i = 0; i < (c.low ? 1 : 2); i++)
      this.node('ring', i ? c.color : '#fff2d4', (m, p) => {
        const t = impactProgress(p);
        m.position.copy(this.end);
        m.quaternion.copy(this.camera.quaternion);
        if (i) {
          m.rotation.x = -Math.PI / 2;
          m.position.y = 0.35;
        }
        m.scale.setScalar(c.size * (0.2 + ease(t) * (i ? 1.8 : 1.1)));
        m.material.opacity = envelope(t) * 0.8;
      });
    const count = c.low ? 6 : 12 + c.tier * 4;
    const shape =
      c.family === 'rock'
        ? 'rock'
        : c.family === 'ice'
          ? 'crystal'
          : c.family === 'grass'
            ? 'leaf'
            : 'orb';
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996;
      const radius = c.size * (0.7 + (i % 5) * 0.19);
      this.node(
        shape,
        i % 4 ? c.color : '#fff2da',
        (m, p) => {
          const t = impactProgress(p),
            burst = ease(t);
          m.position.copy(this.end);
          m.position.x += Math.cos(angle) * radius * burst;
          m.position.z += Math.sin(angle) * radius * burst;
          m.position.y +=
            Math.sin(i * 7) * radius * burst + (c.family === 'fire' ? t : -t * t * 0.65);
          const size = c.size * (0.035 + (i % 3) * 0.03) * (1 - t * 0.6);
          m.scale.set(size, shape === 'crystal' || shape === 'leaf' ? size * 3 : size, size);
          m.rotation.set(angle, t * 5, angle + t * 3);
          m.material.opacity = envelope(t);
        },
        { solid: c.family === 'rock' || c.family === 'grass' },
      );
    }
    if (c.family === 'rock' || c.family === 'fire')
      for (let i = 0; i < (c.low ? 2 : 4); i++) {
        this.node(
          'glow',
          c.family === 'rock' ? '#ae9577' : '#ff6b25',
          (m, p) => {
            const t = impactProgress(p);
            m.position.copy(this.end);
            m.position.x += Math.cos(i * 2.4) * t * c.size;
            m.position.y += t * 0.8 - 0.4;
            m.scale.setScalar(c.size * (0.4 + t * 1.4));
            m.material.opacity = envelope(t) * 0.3;
          },
          { solid: true },
        );
      }
  }

  update(dt, speed = 1) {
    if (this.done) return;
    this.time += Math.max(0, dt) * Math.max(1, Math.min(3, Number(speed) || 1));
    const p = clamp(this.time / this.duration);
    for (const { mesh, animate, opacity } of this.nodes) {
      animate(mesh, p);
      mesh.material.opacity *= opacity;
    }
    const c = this.config;
    this.feedback =
      c.reduced || c.family === 'status'
        ? 0
        : envelope(clamp((p - c.impact) / (1 - c.impact))) * c.size * (c.low ? 0.06 : 0.16);
    if (p >= 1) this.dispose();
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    this.feedback = 0;
    this.group.removeFromParent();
    this.group.clear();
    this.materials.forEach((material) => material.dispose());
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.nodes.length = 0;
    this.materials.clear();
    this.ownedGeometries.length = 0;
    this.resolve(); // Completion and cancellation release the same presentation wait.
  }
}
