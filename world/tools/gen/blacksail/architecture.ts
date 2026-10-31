/** Authored maritime architecture. Every addition is ART-only: gameplay proxies stay in build.ts. */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import type { Piece } from '../structures.js';

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const C = {
  chalk: '#e5d7b9', cream: '#d8c5a2', coral: '#bba88a', mortar: '#827e71',
  timber: '#735344', dark: '#493c35', end: '#9d8261', board: '#a58b6a',
  iron: '#414e50', teal: '#4e7775', red: '#985645', tile: '#a96850',
  canvas: '#d9c8a1', rope: '#baaa83', recess: '#344b4a', gold: '#c79e60',
};

/** Material-separated visual sink. Never emits COL or changes the source batch order. */
export function architectureBatches() {
  const batches = new Map<string, Batch>();
  const materialFor = (c: THREE.ColorRepresentation) => {
    if ([C.chalk,C.coral,C.mortar,C.cream].includes(c as any)) return 'Stone';
    if (['#e4d6ba','#d4b38c','#c8c3a7','#d9c9a9'].includes(String(c))) return 'Plaster';
    if ([C.red,C.tile].includes(c as any)) return 'Terracotta';
    if (['#697d78','#6b7770','#9d7758','#5d7e7b'].includes(String(c))) return 'Shingle';
    if ([C.canvas,'#cabb98'].includes(c as any)) return 'Canvas';
    if (c===C.rope) return 'Rope';
    if (String(c)==='#bba174') return 'Thatch';
    if ([C.iron].includes(c as any)) return 'Iron';
    if ([C.gold].includes(c as any)) return 'Brass';
    return 'Timber';
  };
  class ArtSink extends Batch {
    add(g: THREE.BufferGeometry,c: THREE.ColorRepresentation,m: THREE.Matrix4,_collide=false) {
      const material = `M_BlackSail${materialFor(c)}`;
      if (!batches.has(material)) batches.set(material,new Batch(`Nassau_Craft_${material.slice(11)}`,material));
      batches.get(material)!.add(g,c,m,false);
      return this;
    }
  }
  return { art:new ArtSink('Architecture_Craft'), pieces:():Piece[] => [...batches.values()].map(batch=>({name:batch.name,material:batch.material,batch,outline:true})) };
}

/** Local X/Z frame, centre-based boxes; deliberately no collision calls. */
class Craft {
  constructor(public b: Batch, public x: number, public y: number, public z: number, public a = 0) {}
  point(x: number, y: number, z: number) {
    return new THREE.Vector3(this.x + Math.cos(this.a) * x + Math.sin(this.a) * z, this.y + y, this.z - Math.sin(this.a) * x + Math.cos(this.a) * z);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, c: string, rx = 0, rz = 0, a = 0) {
    const p = this.point(x, y, z); this.b.add(BOX, c, T(p.x, p.y, p.z, this.a + a, w, h, d, rx, rz), false);
  }
  cyl(x: number, y: number, z: number, r: number, h: number, c: string) {
    const p = this.point(x, y, z); this.b.add(CYL, c, T(p.x, p.y, p.z, this.a, r, h, r), false);
  }
  beam(a: number[], b: number[], width: number, c: string) {
    const p = this.point(a[0], a[1], a[2]), q = this.point(b[0], b[1], b[2]);
    const m = new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), q.clone().sub(p).normalize()), new THREE.Vector3(width,p.distanceTo(q),width));
    this.b.add(BOX,c,m,false);
  }
  mesh(vertices: number[], triangles: number[], color: string) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); g.setIndex(triangles);
    this.b.add(g,color,T(this.x,this.y,this.z,this.a),false); g.dispose();
  }
}

/** Thick roof planes and a genuine ridge, not triangular-cylinder caps. */
function roof(k: Craft, w: number, d: number, eave: number, rise: number, color: string, kind: 'gable'|'hip'|'saltbox' = 'gable') {
  const W=w/2+.48,D=d/2+.52, ridge=kind==='saltbox' ? -.7 : 0;
  if(kind==='hip') {
    const R=Math.max(.65,W-D*.65);
    k.mesh([-W,eave,-D,W,eave,-D,W,eave,D,-W,eave,D,-R,eave+rise,0,R,eave+rise,0], [0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0],color);
    k.beam([-R,eave+rise+.04,0],[R,eave+rise+.04,0],.18,C.tile);
    for(const s of [-1,1]) for(const t of [-1,1]) k.beam([s*W,eave,t*D],[s*R,eave+rise,0],.12,C.tile);
  } else {
    // Each half is a separate sloping slab, with visible fascia at the gable ends.
    for(const s of [-1,1]) {
      const span=D-s*ridge, slope=Math.atan2(rise,span), L=Math.hypot(span,rise);
      k.box(0,eave+rise/2,(s*D+ridge)/2,w+1,.17,L,color,s*slope);
      for(const x of [-W+.08,W-.08]) k.beam([x,eave,s*D],[x,eave+rise,ridge],.19,C.dark);
      // Small count of broad courses supplies readable scale without tile spam.
      for(let j=1;j<=4;j++) {
        const t=j/5;
        k.box(0,eave+rise*t+.10,s*D+(ridge-s*D)*t,w+.94,.055,.09,j%2 ? C.tile:color,s*slope);
      }
    }
    for(const s of [-1,1]) k.mesh([s*w/2,eave,-d/2,s*w/2,eave,d/2,s*w/2,eave+rise,ridge],s>0?[0,2,1]:[0,1,2],C.cream);
    k.box(0,eave+rise+.12,ridge,w+1.05,.18,.24,C.tile);
  }
  for(const s of [-1,1]) k.box(0,eave-.06,s*D,w+1.03,.23,.19,C.dark);
}
function shutter(k: Craft,x: number,y: number,z: number,w=1.15,h=1.45,color=C.teal) {
  k.box(x,y,z,w,h,.075,C.recess);
  for(const s of [-1,1]) {
    k.box(x+s*(w/2+.07),y,z+.05,.12,h+.24,.16,C.dark);
    // Side-mounted closed/open half shutter reads as carpentry, not emissive squares.
    const xx=x+s*(w*.76);
    k.box(xx,y,z+.17,w*.42,h,.13,color,0,0,s*.23);
    for(const yy of [-.31,.31]) k.box(xx,y+yy*h,z+.25,w*.41,.075,.06,C.end);
    k.box(x+s*w*.25,y,z+.055,.055,h-.1,.04,C.end);
  }
  k.box(x,y-h/2-.09,z+.10,w+1,.16,.32,C.chalk);
  k.box(x,y+h/2+.08,z+.04,w+.3,.14,.16,C.dark);
}
function door(k: Craft,x: number,z: number,h=2.25,w=1.35) {
  k.box(x,h/2,z,w,h,.12,C.dark);
  for(let j=0;j<4;j++) k.box(x+(j-1.5)*w/4,h/2,z+.08,w/4-.035,h-.12,.045,j%2?C.timber:C.board);
  for(const yy of [.42,h-.42]) k.box(x,yy,z+.13,w-.1,.1,.06,C.iron);
  k.box(x+w*.29,1.05,z+.17,.1,.1,.08,C.gold);
  for(const s of [-1,1]) k.box(x+s*(w/2+.08),h/2,z+.04,.16,h+.18,.2,C.chalk);
  k.box(x,h+.08,z+.04,w+.33,.18,.2,C.chalk);
}
function porch(k: Craft,w: number,z: number,roofY: number,color=C.canvas,depth=1.8) {
  k.box(0,roofY,z+depth/2,w,.13,depth,color,.13);
  k.box(0,roofY-.11,z+depth,w,.25,.13,C.dark);
  for(const s of [-1,1]) {
    k.box(s*(w/2-.15),roofY/2,z+depth-.12,.19,roofY,.19,C.dark);
    k.box(s*(w/2-.15),.32,z+depth-.12,.29,.54,.29,C.coral);
    k.beam([s*(w/2-.15),roofY-.7,z+depth-.12],[s*(w/2-.15),roofY-.12,z+depth-.75],.12,C.end);
  }
}
function sign(k: Craft,x: number,y: number,z: number,kind: number) {
  k.box(x,y+.6,z,.12,1.3,.16,C.dark); k.box(x+.48,y+1.16,z,.95,.12,.16,C.dark);
  for(const dx of [.2,.75]) k.beam([x+dx,y+.97,z],[x+dx,y+.65,z],.045,C.iron);
  k.box(x+.48,y+.36,z,1.15,.72,.12,kind%2?C.teal:C.dark);
  if(kind%3===0) { // Cooper's crossed hoops
    for(const dx of [.27,.67]) { const p=k.point(x+dx,y+.36,z+.085); k.b.add(new THREE.TorusGeometry(.22,.035,5,12),C.gold,T(p.x,p.y,p.z,k.a),false); }
  } else if(kind%3===1) { // Sailmaker's needle and canvas
    k.mesh([x+.2,y+.12,z+.08,x+.77,y+.12,z+.08,x+.32,y+.61,z+.08],[0,1,2],C.canvas);
  } else { // Fishmonger's simple fish silhouette
    k.mesh([x+.1,y+.36,z+.08,x+.48,y+.58,z+.08,x+.83,y+.36,z+.08,x+.48,y+.16,z+.08,x+.95,y+.55,z+.08,x+.95,y+.17,z+.08],[0,1,2,0,2,3,2,4,5],C.canvas);
  }
}

/** Eight fixed footprints, eight authored family/trade combinations. */
export function portHouse(b: Batch,x: number,y: number,z: number,a: number,w: number,d: number,h: number,i: number) {
  const k=new Craft(b,x,y,z,a), plaster=['#e4d6ba','#d4b38c','#c8c3a7','#d9c9a9'][i%4];
  k.box(0,h/2,0,w,h,d,plaster);
  k.box(0,.3,0,w+.16,.6,d+.16,C.coral);
  const timberUpper=i===2||i===4||i===7;
  if(timberUpper) {
    k.box(0,h*.70,0,w+.08,h*.60,d+.08,i===4?C.teal:C.board);
    for(let j=0;j<4;j++) for(const s of [-1,1]) k.box(0,h*.43+j*h*.14,s*(d/2+.065),w+.1,.07,.08,C.end);
  }
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    if(timberUpper||i===1) k.box(sx*(w/2-.1),h/2,sz*(d/2+.04),.21,h,.2,C.dark);
    else for(let j=0;j<4;j++) k.box(sx*(w/2-.18),.5+j*(h-.8)/4,sz*(d/2+.035),.42,.28,.15,C.chalk);
  }
  const roofKind=i===0||i===5?'hip':i===3||i===6?'saltbox':'gable';
  const roofColor=[C.tile,C.red,'#697d78',C.tile,'#6b7770',C.red,'#9d7758','#5d7e7b'][i];
  roof(k,w,d,h+.12,i===4?2.1:1.5,roofColor,roofKind);
  const front=d/2+.08, doorX=i%2? -w*.25:0;
  door(k,doorX,front);
  shutter(k,i%2?w*.24:-w*.27,Math.min(h-1.05,2.7),front,1.05,1.4,i%3===0?'#995746':C.teal);
  if(i%2===0) shutter(k,w*.28,Math.min(h-1.05,2.7),front,1.05,1.4,C.teal);
  // Side facades are finished too, but use their own correctly oriented local frame.
  for(const s of [-1,1]) {
    const p=k.point(s*(w/2+.065),0,0), side=new Craft(b,p.x,p.y,p.z,a+s*Math.PI/2);
    shutter(side,0,Math.min(h-1.05,2.8),0,1.2,1.45,i%2?C.teal:'#995746');
  }
  if(h>=5) {
    k.box(0,h*.56,front,w+.2,.15,.16,C.dark);
    // Small vent in gable / upper storey instead of another copy of a ground-floor window.
    k.box(0,h-.55,-d/2-.05,.65,.5,.08,C.recess);
    for(const xx of [-.18,0,.18]) k.box(xx,h-.55,-d/2-.1,.045,.48,.06,C.end);
  }
  if(i===1||i===3||i===5) porch(k,w-1,front,2.8,i===3?C.teal:C.canvas,i===5?2.1:1.6);
  if(i===0) { // apothecary: tiled lean-to, square chimney, narrow flower ledge
    k.box(-w*.26,h+1.15,-1.2,.85,2.1,.9,C.coral); k.box(-w*.26,h+2.22,-1.2,1.08,.22,1.12,C.chalk);
    k.box(w*.28,1.65,front+.26,1.6,.22,.55,C.dark);
    for(const q of [-.45,0,.45]) k.cyl(w*.28+q,1.96,front+.27,.14,.36,C.tile);
  } else if(i===2) { // sail loft: hoist and folded cloth, raised upper sill
    k.beam([0,h-.3,front],[0,h+.65,front+1.3],.18,C.dark);
    k.beam([0,h+.65,front+1.3],[0,1.1,front+1.3],.035,C.rope);
    k.box(-w*.30,.65,front+.35,1.4,1.3,.7,C.board);
    k.box(-w*.30,1.36,front+.35,1.45,.15,.73,C.canvas);
  } else if(i===4) { // net loft: recessed loading doors and authentic hanging net lattice
    k.box(0,h-1,front+.05,2,1.6,.08,C.dark);
    for(const s of [-1,1]) k.box(s*.52,h-1,front+.11,.95,1.55,.1,C.board);
    for(let j=0;j<6;j++) {
      const xx=-w/2+.45+j*.36;
      k.beam([xx,.3,front+.16],[xx+1.2,2.1,front+.16],.022,C.rope);
      k.beam([xx,2.1,front+.18],[xx+1.2,.3,front+.18],.022,C.rope);
    }
  } else if(i===6) { // warehouse: reinforced double freight doors, eave hoist
    k.box(0,1.4,front+.12,2.8,2.8,.15,C.board);
    for(const s of [-1,1]) { k.box(s*.72,1.4,front+.22,1.32,2.6,.08,C.timber); k.beam([s*.10,.18,front+.28],[s*1.31,2.62,front+.28],.11,C.end); }
    k.box(0,1.4,front+.28,.12,2.8,.06,C.iron);
    k.beam([0,h-.1,front],[0,h-.1,front+1.6],.18,C.dark);
  } else if(i===7) { // small chandlery balcony, supported by corbels (not walkable expansion)
    k.box(0,h-1.9,front+.43,3.2,.2,.9,C.dark);
    for(const s of [-1,1]) { k.beam([s*1.3,h-2.65,front],[s*1.3,h-1.85,front+.8],.15,C.end); k.box(s*1.45,h-1.4,front+.8,.1,.95,.1,C.dark); }
    k.box(0,h-.97,front+.8,3.05,.12,.12,C.dark);
  }
  sign(k,w*.5-.55,2.9,front+.35,i);
}

/** Tavern-only inward timber lining. The existing hip shell has outward faces only.
 * No COL, no new material, no skylight: source roof is continuous beneath its solid chimney. */
export function tavernRoofUnderside(x: number, y: number, z: number, w: number, d: number): Batch {
  const b = new Batch('Nassau_Tavern_Timber_Underside', 'M_BlackSailTimber');
  const k = new Craft(b, x, y, z), W = w / 2 + .48, D = d / 2 + .52;
  const R = Math.max(.65, W - D * .65), eave = 5.12 - .04, ridge = eave + 2.35;
  k.mesh([-W,eave,-D, W,eave,-D, W,eave,D, -W,eave,D, -R,ridge,0, R,ridge,0],
    [0,5,4, 0,1,5, 1,2,5, 2,4,5, 2,3,4, 3,0,4], C.timber);
  return b;
}

export function tavernCraft(b: Batch,x: number,y: number,z: number,w: number,d: number) {
  const k=new Craft(b,x,y,z);
  roof(k,w,d,5.12,2.35,C.red,'hip');
  const f=d/2+.46;
  // Foundation only at the wings, never across the playable entry.
  for(const s of [-1,1]) {
    k.box(s*(w/2-2.5),.25,d/2+.02,5,.5,.95,C.coral);
    k.box(s*w/2,.25,0,.95,.5,d,C.coral);
    k.box(s*3.16,1.7,f-.43,.21,3.4,.24,C.dark);
    shutter(k,s*(w/2-2.5),2.35,f,1.45,1.45,C.teal);
  }
  k.box(0,3.48,f-.43,6.5,.24,.28,C.dark);
  porch(k,w+1,f,3.6,C.canvas,2.0);
  // Quarterdeck-shaped blackboard and crossed cutlasses identify the landmark without modern signage.
  k.box(4,4.5,f+.15,2.8,1.1,.18,C.dark);
  k.box(4,4.5,f+.26,2.56,.86,.035,C.teal);
  for(const s of [-1,1]) k.beam([4-s*.55,4.2,f+.30],[4+s*.55,4.8,f+.30],.055,C.canvas);
  k.box(-w/2+2.0,7.1,-d/2+1.8,1.1,2.1,1.1,C.coral);
  k.box(-w/2+2.0,8.17,-d/2+1.8,1.35,.22,1.35,C.chalk);
  for(const s of [-1,1]) {
    const p=k.point(s*(w/2+.44),0,0), side=new Craft(b,p.x,p.y,p.z,s*Math.PI/2);
    for(const xx of [-2.7,2.7]) shutter(side,xx,2.6,0,1.35,1.65,C.teal);
    side.box(0,.28,0,d,.48,.10,C.coral);
    side.box(0,4.75,0,d,.20,.14,C.dark);
  }
  // Interior rafters and shelving remain clear of the Blackbeard interaction/counter.
  for(const xx of [-5,0,5]) k.box(xx,4.8,0,.18,.24,d-.2,C.dark);
  for(const yy of [2.1,3.0]) {
    k.box(0,yy,-d/2+.53,w-3,.12,.7,C.dark);
    for(let j=0;j<7;j++) k.cyl(-5+j*1.6,yy+.27,-d/2+.55,.11,.42,j%2?C.teal:C.tile);
  }
}

export function pierCraft(b: Batch,x: number,y: number,z0: number,z1: number) {
  const k=new Craft(b,x,y,0);
  for(let z=z0+3;z<z1-2;z+=12) {
    k.box(0,-.65,z,5.6,.38,.4,C.dark);
    for(const s of [-1,1]) {
      k.beam([s*2.2,-3,z],[s*.35,-.65,z],.18,C.end);
      k.box(s*2.2,-.9,z,.47,.1,.48,C.iron);
    }
  }
  for(const z of [z1-4,z1-17]) {
    const p=k.point(-1.8,.10,z);
    for(let j=0;j<3;j++) b.add(new THREE.TorusGeometry(.32+j*.075,.035,5,14),C.rope,T(p.x,p.y+j*.045,p.z,0,1,1,1,Math.PI/2),false);
    if(z!==z1-17)continue;
    // Low mooring cleat with a belayed tail, rather than an unexplained loose
    // stack of rings. Three fittings total, inset at the existing pier edge;
    // staying below the 4k-triangle chunk threshold avoids splitting the
    // original iron batch into eleven extra chunks. Centre lanes stay open.
    k.box(-1.8,.028,z-1.0,.46,.05,.6,C.iron);
    k.box(-1.8,.13,z-1.0,.12,.2,.17,C.iron);
    k.box(-1.8,.23,z-1.0,.14,.09,.67,C.iron);
    for(const xx of [-1.96,-1.64])for(const zz of [z-1.19,z-.81])k.cyl(xx,.063,zz,.035,.025,C.iron);
    b.add(new THREE.TorusGeometry(.145,.032,5,12),C.rope,T(p.x,y+.14,z-1,0,1,1,1,Math.PI/2),false);
    k.beam([-1.8,.14,z-.84],[-1.8,.11,z-.44],.055,C.rope);
  }
}

export function millCraft(b: Batch,blades: Batch,x: number,y: number,z: number) {
  const k=new Craft(b,x,y,z);
  for(const yy of [.45,4.0,8.0,11.8]) k.cyl(0,yy,0,4.2-yy/12,.15,C.coral);
  for(const a of [-Math.PI/2,0,Math.PI/2,Math.PI]) {
    const rr=3.55,p=k.point(Math.sin(a)*rr,0,Math.cos(a)*rr),v=new Craft(b,p.x,p.y,p.z,a);
    shutter(v,0,7.5,0,.7,1.05,C.teal);
  }
  const v=new Craft(b,x,y,z+4.18); door(v,0,0,2.4,1.4);
  // Spoked capstan and four lattice-backed sails. Same pivot and silhouette as former paddle blades.
  const r=new Craft(blades,x,y+11,z+4.6);
  r.cyl(0,0,0,.45,.7,C.dark);
  for(let j=0;j<4;j++) {
    const a=j*Math.PI/2, along=(u:number,v:number):number[]=>[Math.cos(a)*u-Math.sin(a)*v,Math.sin(a)*u+Math.cos(a)*v,0];
    r.beam(along(.2,0),along(8.3,0),.17,C.dark);
    for(const side of [-.62,.62]) r.beam(along(2,side),along(8.3,side),.09,C.end);
    for(let u=2;u<=8.3;u+=.9) r.beam(along(u,-.65),along(u,.65),.07,C.end);
    // Canvas covers the outboard two-thirds; slim ribs remain clearly visible on the front.
    for(let u=3;u<8.1;u+=1.05) {
      const q=along(u+.45,0); r.box(q[0],q[1],-.055,1.0,1.12,.055,u>6?C.canvas:'#cabb98',0,a);
    }
  }
}

export function lighthouseCraft(b: Batch,x: number,base: number,z: number,H: number,top: number) {
  const k=new Craft(b,x,base,z);
  // Coralline limestone courses, weathered lower ashlar, warm limewashed upper tower.
  for(let j=0;j<12;j++) {
    const yy=(j+.5)*H/12,r=4.2-(j+.5)/12;
    const geo=new THREE.CylinderGeometry(r-.045,r+.045,H/12-.035,24);
    b.add(geo,j<2?C.mortar:j%3===0?C.cream:C.chalk,T(x,base+yy,z),false); geo.dispose();
  }
  for(const yy of [1.1,H*.33,H*.67,H-.15]) k.cyl(0,yy,0,4.28-yy/H,.18,C.coral);
  for(const yy of [5.5,13.0,20.0]) {
    const r=4.23-yy/H,p=k.point(0,0,-r);
    const win=new Craft(b,p.x,p.y,p.z,Math.PI); shutter(win,0,yy,0,.65,1.1,C.teal);
  }
  // Socketed stair brackets below the route; no changes to walking treads or rail clearance.
  for(let j=0;j<96;j+=3) {
    const a=(j+.5)/24*Math.PI*2, yy=.8+(j+.5)*H/96;
    const r=4.2-(yy-1.2)/H-.12;
    const anchor=[Math.cos(a)*r,yy-1.25,Math.sin(a)*r];
    const foot=[Math.cos(a)*5.65,yy-.33,Math.sin(a)*5.65];
    k.beam(anchor,foot,.20,C.dark);
    k.beam([Math.cos(a)*r,yy-.38,Math.sin(a)*r],foot,.18,C.end);
  }
  const ty=top-base;
  k.cyl(0,ty-.5,0,3.65,.3,C.coral); k.cyl(0,ty+2.8,0,2.65,.17,C.dark);
  // 1718-inspired open brazier lantern: bowl, rods and hand-hammered hood, no Fresnel/glass drum.
  const bowl=new THREE.CylinderGeometry(1.15,.68,.55,12);
  b.add(bowl,C.iron,T(x,top+.55,z),false); bowl.dispose();
  k.cyl(0,ty+.12,0,.4,.5,C.iron);
  for(let j=0;j<8;j++) {
    const a=j*Math.PI/4;
    k.beam([Math.cos(a)*2.35,ty+2.7,Math.sin(a)*2.35],[Math.cos(a)*.55,ty+3.75,Math.sin(a)*.55],.11,C.iron);
  }
  k.cyl(0,ty+4.75,0,.12,.9,C.iron);
}

/** Stone coping, mortar courses and embrasure reveals follow the existing star walls exactly. */
export function fortWallCraft(b: Batch,x: number,z: number,base: number,top: number,ry: number,len: number,crenel: boolean) {
  const k=new Craft(b,x,base,z,ry),H=top-base;
  for(const s of [-1,1]) {
    for(let yy=1.1;yy<H-.3;yy+=1.25) k.box(s*1.313,yy,0,.045,.055,len-.06,C.mortar);
    for(let j=0;j<3;j++) k.box(s*1.335,H-.20-j*1.26,(j%2?.22:-.22)*len,.04,.85,.055,C.mortar);
  }
  k.box(0,H+.10,0,2.75,.20,len-.01,C.cream);
  if(crenel) {
    for(const ss of [-1,1]) k.box(0,H+.12,ss*len*.27,2.7,.24,len*.12,C.coral);
  }
}
export function fortCraft(b: Batch,fx: number,y: number,fz: number,cx: number,cz: number) {
  const k=new Craft(b,fx,y,fz);
  roof(new Craft(b,fx-14,y,fz+4),14,7,4.02,1.8,C.red,'gable');
  roof(new Craft(b,fx-6,y,fz-18),9,8,5.02,2.0,'#697d78','hip');
  // Existing barracks and captain's house get differentiated trade-built facades.
  for(const dx of [-18.5,-14,-9.5]) shutter(k,dx,2.3,7.57,1.1,1.4,C.teal);
  door(k,-14,7.6,2.6,1.5);
  const captain=new Craft(b,fx-6,y,fz-18);
  shutter(captain,-2.6,2.8,4.1,1.1,1.5,'#995746'); shutter(captain,2.6,2.8,4.1,1.1,1.5,'#995746'); door(captain,0,4.1,2.6,1.4);
  for(const s of [-1,1]) k.box(-14+s*7,2,7.6,.22,4,.21,C.dark);
  // Muzzle rings, carriage bands and handspikes give the working battery a coherent period scale.
  const gun=new Craft(b,cx,y+2.6,cz);
  for(let j=-2;j<=2;j++) {
    const z=j*4.5;
    { const p=gun.point(-1.4,1,z); b.add(new THREE.CylinderGeometry(.27,.34,3.0,12),C.iron,T(p.x,p.y,p.z,0,1,1,1,0,Math.PI/2),false); }
    { const p=gun.point(.106,1,z); b.add(new THREE.CylinderGeometry(.22,.22,.015,12),C.recess,T(p.x,p.y,p.z,0,1,1,1,0,Math.PI/2),false); }
    for(const xx of [-2.6,-.1]) {
      const p=gun.point(xx,1,z);
      b.add(new THREE.TorusGeometry(xx===-.1?.34:.36,.055,6,12),C.iron,T(p.x,p.y,p.z,Math.PI/2),false);
    }
    gun.box(-2.7,.72,z,1.7,.08,1.8,C.end);
    gun.box(-3.65,.44,z,.16,.15,2.5,C.dark);
    gun.box(-4.8,.12,z,1.15,.12,1.7,C.board);
  }
}

export function reefCraft(b: Batch,x: number,y: number,z: number) {
  const k=new Craft(b,x,y,z,.6);
  // Eroded jaw ledges and asymmetrical brow ribs tie the skull to a limestone outcrop.
  for(const s of [-1,1]) {
    k.beam([s*1.2,9.6,-7.1],[s*5.4,9.2,-6.2],.55,C.cream);
    k.mesh([s*1.0,5.7,-7.6,s*2.2,4.6,-7.6,s*.9,4.6,-8.0],[0,1,2],C.mortar);
  }
  for(let j=0;j<7;j++) {
    const a=j*2.399,r=6.5+(j%3)*.8;
    const p=k.point(Math.cos(a)*r,-.1,Math.sin(a)*r);
    b.add(new THREE.DodecahedronGeometry(1,0),j%2?C.coral:C.cream,T(p.x,p.y,p.z,a,2.3+(j%2),1.2,2.7,.2),false);
  }
}

/** One thatched fish stall and three stitched canvas awnings, all on original stall footprints. */
export function marketCraft(b:Batch,x:number,y:number,z:number,i:number) {
 const k=new Craft(b,x,y,z);
 if(i===3) {
   for(const s of [-1,1]) k.box(0,2.55,s*.52,3.2,.19,1.2,'#bba174',s*.25);
   k.box(0,2.73,0,3.25,.17,.25,'#bba174');
   for(let xx=-1.4;xx<1.5;xx+=.35) for(const s of [-1,1]) k.beam([xx,2.65,0],[xx,2.35,s*1.08],.06,C.dark);
 } else {
   for(let j=0;j<5;j++) k.box((j-2)*.62,2.5,0,.61,.075,2.1,j%2?C.canvas:i===1?C.teal:'#995746',.09);
   k.box(0,2.38,1.03,3.1,.25,.08,C.canvas);
 }
 for(const xx of [-.85,0,.85]) {
   k.box(xx,1.08,0,.65,.13,.85,C.end);
   for(let j=0;j<3;j++) k.cyl(xx+(j-1)*.15,1.23,-.1+(j%2)*.18,.10,.2,i===2?C.tile:C.gold);
 }
}

/** A timber gate bridge is tied back to the two existing stone jambs; no new columns in the route. */
export function gateCraft(b:Batch,fx:number,y:number,fz:number,gateA:number,R:number) {
  const k=new Craft(b,fx,y,fz);
  const gx=Math.cos(gateA)*R,gz=Math.sin(gateA)*R;
  // Original overhead collider remains visible as a timber drawbridge crosshead.
  const top=new Craft(b,fx+gx,y,fz+gz,-gateA);
  top.box(0,6,0,3,2.4,9,C.dark);
  for(const z of [-3.8,3.8]) top.box(0,6,z,3.12,2.52,.18,C.iron);
  const anchors=[[-28.2124,20.6851],[-25.9624,9.4023]];
  const tips=[top.point(0,5.1,-3.8),top.point(0,5.1,3.8)];
  // Pair each crosshead end to the nearest stone wall-end, with two triangulated knees.
  for(const tip of tips) {
    const t=[tip.x-fx,tip.y-y,tip.z-fz];
    const anchor=anchors.slice().sort((a,c)=>Math.hypot(a[0]-t[0],a[1]-t[2])-Math.hypot(c[0]-t[0],c[1]-t[2]))[0];
    k.beam([anchor[0],4.9,anchor[1]],t,.34,C.dark);
    k.beam([anchor[0],2.8,anchor[1]],t,.26,C.end);
    k.box(anchor[0],3.6,anchor[1],.7,2.5,.7,C.dark);
  }
}

/** Continuous triangulated gallery surface, replacing the overlapping legacy radial box ART only. */
export function lighthouseGallery(b:Batch,cx:number,top:number,cz:number,lastA:number) {
 const k=new Craft(b,cx,top,cz),N=24,inner=3.4,outer=7.5;
 for(let j=0;j<N;j++) {
   const a=(j+.5)/N*Math.PI*2,da=((lastA-a)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
   const a0=j/N*Math.PI*2,a1=(j+1)/N*Math.PI*2;
   const p=(r:number,t:number,y:number)=>[Math.cos(t)*r,y,Math.sin(t)*r];
   const i0=p(inner,a0,0),i1=p(inner,a1,0);
   k.mesh([0,0,0,...i1,...i0],[0,1,2],C.cream);
   if(da<3.1) {
     const q0=p(inner,a0,-.4),q1=p(inner,a1,-.4);
     k.mesh([...i0,...i1,...q1,...q0],[0,1,2,0,2,3],C.coral);
     continue;
   }
   const o0=p(outer,a0,0),o1=p(outer,a1,0),b0=p(outer,a0,-.4),b1=p(outer,a1,-.4);
   k.mesh([...i0,...i1,...o1,...o0],[0,1,2,0,2,3],C.cream);
   k.mesh([...o0,...o1,...b1,...b0],[0,1,2,0,2,3],C.coral);
   const bi0=p(inner,a0,-.4),bi1=p(inner,a1,-.4);
   k.mesh([...bi0,...bi1,...b1,...b0],[0,2,1,0,3,2],C.coral);
   for(const [aa,ii,oo,bb,bii] of [[a0,i0,o0,b0,bi0],[a1,i1,o1,b1,bi1]] as const) {
     const neighbor=(aa===a0?a0-Math.PI/N:a1+Math.PI/N),nd=((lastA-neighbor)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
     if(nd<3.1) k.mesh([...ii,...oo,...bb,...bii],aa===a0?[0,1,2,0,2,3]:[0,2,1,0,3,2],C.coral);
   }
 }
}
