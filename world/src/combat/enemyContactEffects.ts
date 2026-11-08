import * as THREE from 'three';
import type { CombatEvent, Point3 } from './combat';

type Contact = Extract<CombatEvent, { type: 'attackContact' }>;
interface Surface {
  contactSurface?(bounds: { minX:number; maxX:number; minZ:number; maxZ:number }): Surface;
  colliderCount?: number; totalColliders?: number;
  ground(x: number, z: number, ceiling?: number): { point: Point3 } | null;
  cast(origin: Point3, direction: Point3, max: number): { point: Point3 } | null;
}
export const ENEMY_CONTACT_EFFECT_BUDGET = { slots: 3, vertices: 1536, samples: 256, duration: .24, reducedDuration: .12 } as const;
interface Slot { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; age: number; duration: number; id: string }
/** Warden signal contact, NOT a hit confirmation/projectile. The entire accepted
 * footprint appears at contact, including misses, then fades without expanding.
 * Static cover trims strips; normal depth testing hides surfaces behind scenery.
 * All resources are fixed capacity. Presentation age never drives gameplay.
 */
export class EnemyContactEffects {
  private readonly slots: Slot[] = [];
  private readonly seen = new Map<string, number>();
  private cursor = 0;
  private disposed = false;
  private lastBuild = { samples:0, groundQueries:0, coverQueries:0, vertices:0, colliderCount:0, totalColliders:0 };
  constructor(parent: THREE.Group, private readonly surface: Surface) {
    for (let i = 0; i < ENEMY_CONTACT_EFFECT_BUDGET.slots; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ENEMY_CONTACT_EFFECT_BUDGET.vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const material = new THREE.MeshBasicMaterial({ color: '#77e5f3', transparent: true, opacity: .68, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `echo-warden-contact-${i}`; mesh.visible = false; mesh.frustumCulled = false;
      parent.add(mesh); this.slots.push({ mesh, age: 0, duration: 0, id: '' });
    }
  }
  emit(event: Contact, reduced = false): boolean {
    if (this.disposed || event.storyPattern !== 'echo-warden' || event.attack === 'shot'
      || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || (this.seen.get(event.id) ?? 0) >= event.sequence
      || ![event.origin.x,event.origin.y,event.origin.z,event.target.x,event.target.y,event.target.z,event.radius].every(Number.isFinite)
      || event.radius <= 0 || event.radius > 4 || (event.attack === 'thrust' && (!Number.isFinite(event.length) || event.length! <= 0 || event.length! > 8))) return false;
    this.seen.set(event.id, event.sequence);
    if (this.seen.size > 32) this.seen.delete(this.seen.keys().next().value!);
    const slot = this.slots[this.cursor++ % this.slots.length];
    const attribute = slot.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let count = 0;
    const origin = { x: event.origin.x, y: event.origin.y + 1, z: event.origin.z };
    const center = event.attack === 'burst' ? event.target : event.origin;
    const extent = event.attack === 'thrust' ? event.length! + event.radius : event.radius;
    const surface = this.surface.contactSurface?.({minX:Math.min(event.origin.x,center.x-extent),maxX:Math.max(event.origin.x,center.x+extent),minZ:Math.min(event.origin.z,center.z-extent),maxZ:Math.max(event.origin.z,center.z+extent)}) ?? this.surface;
    const samples = new Map<string, Point3 | null>();
    let groundQueries=0,coverQueries=0;
    const sample = (x: number, z: number): Point3 | null => {
      const key = `${x}:${z}`;
      if (samples.has(key)) return samples.get(key)!;
      if (samples.size >= ENEMY_CONTACT_EFFECT_BUDGET.samples) return null;
      samples.set(key,null); groundQueries++;
      const hit = surface.ground(x,z,center.y + 1.1);
      if (!hit || Math.abs(hit.point.y - center.y) > .85) return null;
      const p = { x, y: hit.point.y + .09, z };
      const d = { x: x-origin.x, y: p.y + .91-origin.y, z: z-origin.z };
      coverQueries++;
      if (surface.cast(origin,d,Math.max(0,Math.hypot(d.x,d.y,d.z)-.06))) return null;
      samples.set(key,p); return p;
    };
    // Conservative four-corner clipping: never bridge an occluded/steep segment.
    const quad = (corners: readonly (readonly [number,number])[], rise = 0) => {
      if (count + 6 > attribute.count) return;
      const points = corners.map(([x,z]) => sample(x,z));
      if (points.some(p => !p)) return;
      for (const index of [0,1,2,0,2,3]) { const p = points[index]!; attribute.setXYZ(count++,p.x,p.y + (rise && index > 1 ? rise : 0),p.z); }
    };
    if (event.attack === 'thrust') {
      const dx = event.target.x-center.x, dz = event.target.z-center.z, magnitude = Math.hypot(dx,dz);
      const ux = magnitude > .001 ? dx/magnitude : 0, uz = magnitude > .001 ? dz/magnitude : 1;
      const point = (along: number, across: number): [number,number] => [center.x+ux*along+uz*across,center.z+uz*along-ux*across];
      const length = event.length!, half = event.radius, steps = Math.ceil(length/.4);
      for (let i=0;i<steps;i++) {
        const a=i*length/steps,b=(i+1)*length/steps;
        for (const track of reduced ? [-half+.045,half-.045] : [-half+.045,0,half-.045])
          quad([point(a,track-.035),point(b,track-.035),point(b,track+.035),point(a,track+.035)]);
        // Low central energy blade communicates the otherwise invisible long reach.
        if (!reduced) quad([point(a,0),point(b,0),point(b,0),point(a,0)],.48);
      }
    } else {
      const segments = 48;
      for (const scale of reduced ? [1] : [.55,1]) for (let i=0;i<segments;i++) {
        const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,r=event.radius*scale;
        const point=(angle:number,radius:number):[number,number]=>[center.x+Math.cos(angle)*radius,center.z+Math.sin(angle)*radius];
        quad([point(a,r-.065),point(b,r-.065),point(b,r),point(a,r)],reduced?0:.18);
      }
    }
    this.lastBuild={samples:samples.size,groundQueries,coverQueries,vertices:count,colliderCount:surface.colliderCount??0,totalColliders:surface.totalColliders??0};
    attribute.needsUpdate = true; slot.mesh.geometry.setDrawRange(0,count);
    slot.id=event.id; slot.age=0; slot.duration=reduced?ENEMY_CONTACT_EFFECT_BUDGET.reducedDuration:ENEMY_CONTACT_EFFECT_BUDGET.duration;
    slot.mesh.material.opacity=reduced?.46:.68; slot.mesh.userData.contactOpacity=slot.mesh.material.opacity;
    slot.mesh.visible=count>0;
    return true;
  }
  update(dt: number, active: boolean) {
    if (!active || !Number.isFinite(dt) || dt <= 0) return;
    for (const slot of this.slots) if (slot.mesh.visible) {
      slot.age += Math.min(.1,dt);
      slot.mesh.visible=slot.age<slot.duration;
      slot.mesh.material.opacity=slot.mesh.userData.contactOpacity*Math.max(0,1-slot.age/slot.duration);
    }
  }
  cancel(id: string) { for (const slot of this.slots) if (slot.id === id) slot.mesh.visible=false; }
  clear() { for (const slot of this.slots) slot.mesh.visible=false; this.seen.clear(); }
  get diagnostics() { return { lastBuild:{...this.lastBuild}, active: this.slots.filter(slot=>slot.mesh.visible).length, slots: this.slots.length, bytes: this.slots.reduce((n,slot)=>n+slot.mesh.geometry.getAttribute('position').array.byteLength,0) }; }
  dispose() { if (this.disposed) return; this.disposed=true; this.clear(); for (const slot of this.slots) { slot.mesh.removeFromParent(); slot.mesh.geometry.dispose(); slot.mesh.material.dispose(); } }
}
