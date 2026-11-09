/** Scope glint: a sniper or DMR user who is scoped in flashes a lens glint to everyone they
 * point at, brightest when looking straight at you. Cosmetic, from the forwarded aim bit. */
import * as THREE from 'three';

function glintTexture() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const c = canvas?.getContext?.('2d');
  if (!canvas || !c?.createRadialGradient) return new THREE.Texture();
  const s = 128; canvas.width = canvas.height = s;
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,250,220,.95)'); g.addColorStop(.35, 'rgba(255,220,150,.35)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  // Long horizontal streak and a shorter vertical one, like a lens catching the sun.
  for (const [w, h, a] of [[s, 4, .9], [6, s * .55, .6]] as const) {
    const lg = c.createLinearGradient(w > h ? 0 : s / 2, w > h ? s / 2 : (s - h) / 2, w > h ? s : s / 2, w > h ? s / 2 : (s + h) / 2);
    lg.addColorStop(0, 'rgba(255,240,200,0)'); lg.addColorStop(.5, `rgba(255,252,235,${a})`); lg.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = lg; c.fillRect((s - w) / 2, (s - h) / 2, w, h);
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ScopeGlints {
  private sprites = new Map<string, THREE.Sprite>();
  private texture = glintTexture();
  constructor(private parent: THREE.Object3D) {}
  /** `facing` is the cosine between their aim and the direction to the viewer. */
  set(id: string, at: THREE.Vector3 | null, facing: number, distance: number, time: number) {
    let s = this.sprites.get(id);
    const strength = at ? Math.max(0, Math.min(1, (facing - .72) / .22)) : 0;
    if (!strength) { if (s) s.visible = false; return; }
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xfff1d0 }));
      s.name = 'Scope glint'; s.renderOrder = 8; s.raycast = () => {}; this.sprites.set(id, s); this.parent.add(s);
    }
    s.visible = true; s.position.copy(at!);
    const twinkle = .85 + .15 * Math.sin(time * 9 + id.length);
    // Roughly constant on screen, so a far sniper still gives themselves away.
    const size = Math.max(.5, distance * .055) * (.55 + .45 * strength) * twinkle;
    s.scale.set(size * 2.2, size, 1); s.material.opacity = Math.min(1, .35 + strength);
  }
  prune(live: ReadonlySet<string>) { for (const [id, s] of this.sprites) if (!live.has(id)) { s.removeFromParent(); s.material.dispose(); this.sprites.delete(id); } }
  dispose() { this.prune(new Set()); this.texture.dispose(); }
}
