import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { LOOKBACK_CHANNEL } from '../map/valleyFoundationPlan';
import { VT } from '../story/valleyTownSetPieces';
import { landscapeWalkway } from './landscapeWalkway';

type V3 = [number, number, number];
/** Valley and Homeward Town formal set pieces with real collision, placed at load on the reviewed maps:
 * V01 Lookback Bridge (stream abutments, rails, town north gate, under-bridge steps and old path),
 * V06 West Ridge (breach rock slopes, local camp, lookout), T02 kitchen annex with its back door,
 * the protagonist's room and small yard, T01 Homeward Square fixtures, and the H13 residents' footbridge.
 * Roofs are visual only, so ground queries from above never land on them. */
export function createValleyTownArchitecture(ground: (x: number, z: number) => number) {
  const root = new THREE.Group(); root.name = 'ValleyTownArchitecture';
  const colliders: Collider[] = [], arts: SiteArt[] = [];
  const stone = '#8a8578', darkStone = '#6f6a5f', timber = '#8d7150', darkTimber = '#5b4632', plaster = '#e4dccb', roof = '#6b4e3a', iron = '#45474a', canvas = '#cdbb94';
  function finish(a: SiteArt, name: string, enabled = true) {
    a.finish('alpha'); a.root.name = name; root.add(a.root); arts.push(a);
    if (!a.solids.length) return null;
    const geometry = mergeParts(a.solids); a.solids.forEach(g => g.dispose()); a.solids.length = 0;
    const c: Collider = { name: `COL_${name}`, enabled, bvh: new MeshBVH(geometry) }; colliders.push(c); return c;
  }
  const at = (x: number, z: number, lift = 0): V3 => [x, ground(x, z) + lift, z];

  // V01 Lookback Bridge: stone abutments at both banks under the existing decks, outer rails,
  // the town north gate at the east end, steps down to the stream bed and the old path beneath.
  const bridge = new SiteArt(), c = LOOKBACK_CHANNEL, west = c.x - c.halfWidth - c.bank, east = c.x + c.halfWidth + c.bank;
  // Abutments face the banks under the deck ends; flush with the ground so they never trip the walk.
  for (const x of [west + .25, east - .25]) for (const z of [-30, -26]) bridge.box([x, ground(x, z) - .5, z], [.6, 1.1, 2.4], stone);
  for (const z of [-31.4, -23.8]) {
    for (let x = west - .6; x <= east + .6; x += 1.6) bridge.box([x, ground(x, z) + .55, z], [.12, 1.1, .12], darkTimber, true);
    bridge.box([c.x, ground(c.x - 3, z) + 1.08, z], [east - west + 1.4, .1, .1], timber, true);
  }
  for (const z of [-33.6, -21.6]) {
    const p = at(-263, z); bridge.box([p[0], p[1] + 2.6, z], [1.2, 5.2, 1.2], stone, true);
    bridge.box([p[0], p[1] + .3, z], [1.6, .6, 1.6], darkStone, true);
  }
  { const p = at(-263, -27.6); bridge.box([p[0], p[1] + 5.45, -27.6], [1.4, .5, 13.4], darkTimber); bridge.box([p[0], p[1] + 6, -27.6], [2.2, .25, 14.2], roof); }
  // Steps from the south walk down the west bank to the stream bed, then the old path under the bridge.
  for (let i = 0; i < 4; i++) { const x = west - .2 + i * .45, z = -21.2; bridge.box([x, ground(x, z) + .1, z], [.45, .2, 1.2], stone, true); }
  for (let z = -22; z >= -36; z -= 2) { const x = c.x - c.halfWidth + .7; bridge.box([x, ground(x, z) + .06, z], [1.3, .12, 1.9], darkStone, true); }
  bridge.box([c.x, ground(c.x, -40) + .32, -28], [c.halfWidth * 2 - .2, .04, 40], '#5d8fa0');
  finish(bridge, 'ValleyLookbackBridge');

  // H13: the footbridge residents finish while the player is away (enabled by state).
  const foot = new SiteArt(), fz = -41;
  foot.box([c.x, ground(west - .5, fz) + .2, fz], [east - west + 2, .22, 1.8], timber, true);
  const footY = ground(west - .5, fz) + .2;
  for (const z of [fz - .85, fz + .85]) {
    foot.box([c.x, footY + .58, z], [east - west + 2, .08, .08], darkTimber, true);
    foot.box([c.x, footY - .16, z], [east - west + 1.6, .23, .12], darkTimber);
    for(const x of[west-.48,c.x,east+.48]){
      foot.box([x,footY+.24,z],[.11,.76,.11],timber);
      foot.box([x,footY+.055,z],[.14,.085,.14],iron);
    }
  }
  for (const x of [west - .4, east + .4]) foot.box([x, ground(x, fz) - .1, fz], [.6, .8, 2], stone, true);
  const footCollider = finish(foot, 'ValleyResidentsFootbridge', false)!;

  // V06 West Ridge: breach rock slopes on both sides of the route, the local camp and a lookout.
  const ridge = new SiteArt();
  for (const [x, z, w, d, h, r] of [[-322, -50, 7, 3.4, 3.2, .3], [-316, -52, 5, 3, 2.4, -.2], [-322, -10, 7, 3.4, 3, -.25], [-316, -8, 5, 3, 2.2, .2]] as const) {
    ridge.box([x, ground(x, z) + h / 2 - .4, z], [w, h, d], darkStone, true, 'body', [0, r, z < -30 ? .18 : -.18]);
  }
  for (const x of [-324, -322.5, -321]) ridge.box([x, ground(x, -44) + .9, -44], [.5, 1.8, .5], '#c8a86a', true);
  { const p=at(-302,-19),peak=p[1]+2.4;
    const fly=(dx:number,dz:number):V3=>[p[0]+dx,ground(p[0]+dx,p[2]+dz)+.1,p[2]+dz];
    const skin=new THREE.BufferGeometry(), points: number[]=[];
    for(const side of[-1,1]){
      const front=fly(side*1.85,1.5),back=fly(side*1.85,-1.5);
      const frontTop:V3=[p[0],peak,p[2]+1.5],backTop:V3=[p[0],peak,p[2]-1.5];
      const face=side>0?[frontTop,front,back,frontTop,back,backTop]:[frontTop,back,front,frontTop,backTop,back];
      points.push(...face.flat());
      for(const edge of[front,back]){
        ridge.box(edge,[.12,.23,.12],darkTimber);
        const stake=fly(side*2.17,edge[2]-p[2]+Math.sign(edge[2]-p[2])*.2);
        ridge.beam([edge[0],edge[1]+.2,edge[2]],stake,.025,canvas);
      }
    }
    skin.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    ridge.add(skin,canvas,[0,0,0],[1,1,1],true);
    const lining: number[]=[];
    for(let i=0;i<points.length;i+=9){
      for(const v of[i+6,i+3,i])lining.push(points[v],points[v+1]-.024,points[v+2]);
    }
    skin.setAttribute('position',new THREE.Float32BufferAttribute(lining,3));
    ridge.add(skin,canvas,[0,0,0]);skin.dispose();
    ridge.beam([p[0],peak-.03,p[2]-1.6],[p[0],peak-.03,p[2]+1.6],.065,darkTimber);
    for(const dz of[-1.45,1.45])ridge.beam(fly(0,dz),[p[0],peak,p[2]+dz],.075,darkTimber);
    ridge.box([p[0]+.52,p[1]+.11,p[2]],[.68,.09,1.8],'#7e826c');
    ridge.box([p[0]+2.2,p[1]+.12,p[2]+2],[.8,.24,.8],'#d88a3a');
    ridge.box([p[0]-1.2,p[1]+.25,p[2]+2.4],[2,.2,.45],timber,true);
  }
  { const p = at(-305, -41); ridge.box([p[0], p[1] + 1.55, p[2]], [3.2, .2, 3.2], timber, true);
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) ridge.box([p[0] + dx, p[1] + .75, p[2] + dz], [.2, 1.5, .2], darkTimber, true);
    for (let i = 0; i < 5; i++) ridge.box([p[0] + 1.6 + i * .5, p[1] + 1.4 - i * .3, p[2]], [.5, .2, 1.1], timber, true); }
  finish(ridge, 'ValleyWestRidge');

  // T02: kitchen annex north of the residence hall (back door on the west), the protagonist's room,
  // and the small yard. Walls are solid; door gaps are real openings; roofs are visual.
  // The ground falls ~2 m toward the north; a stone plinth carries the annex level with the hall floor.
  const annex = new SiteArt(), floor = Math.max(...[[-183, 183.3], [-171.3, 183.3], [-183, 196.6], [-171.3, 196.6], [-177, 190]].map(([x, z]) => ground(x, z)));
  { const low = Math.min(ground(-183, 183.3), ground(-171.3, 183.3)) - .3; annex.box([-177.25, (floor + low) / 2, 189.95], [12.1, floor - low, 13.4], '#8a8578', true); }
  const wall = (x0: number, z0: number, x1: number, z1: number,bottom=0,top=3) => { const len = Math.hypot(x1 - x0, z1 - z0); annex.box([(x0 + x1) / 2, floor+(bottom+top)/2, (z0 + z1) / 2], [Math.abs(x1 - x0) > .01 ? len : .2, top-bottom, Math.abs(z1 - z0) > .01 ? len : .2], plaster, true); };
  wall(-183, 183.5, -176, 183.5); wall(-183, 196.5, -176, 196.5);                 // south (hall side) and north
  wall(-183,183.5,-183,185.5);wall(-183,187.1,-183,190.1);wall(-183,191.7,-183,193.6);wall(-183,195.2,-183,196.5);
  for(const z of[186.3,190.9]){
    wall(-183,z-.8,-183,z+.8,0,1.48);wall(-183,z-.8,-183,z+.8,2.46,3);
    for(const side of[-1,1]){
      annex.box([-183,floor+1.97,z+side*.77],[.23,.98,.07],darkTimber);
      annex.box([-183,floor+1.97,z+side*.265],[.13,.98,.055],darkTimber,true);
      annex.box([-183.05,floor+1.97+side*.5,z],[.33,.09,1.76],timber);
    }
  }
  wall(-176, 183.5, -176, 185); wall(-176, 186.6, -176, 191.6); wall(-176, 193.2, -176, 196.5); // east wall, room and kitchen doors
  wall(-183, 189.6, -180.6, 189.6); wall(-179, 189.6, -176, 189.6);               // shared wall with an inner door
  const pitch=Math.atan2(1.25,3.85),roofRun=Math.hypot(3.85,1.25);
  for(const side of[-1,1]){
    annex.box([-179.5+side*1.925,floor+3.61,190],[roofRun,.17,13.85],roof,false,'body',[0,0,-side*pitch]);
    for(const z of[183.1,196.9])annex.beam([-179.5,floor+4.24,z],[-179.5+side*3.85,floor+2.99,z],.13,darkTimber);
    annex.box([-179.5+side*3.83,floor+2.99,190],[.14,.19,13.9],darkTimber);
  }
  for(const z of[183.5,196.5]){
    const gable=new THREE.Shape();
    gable.moveTo(-3.5,0);gable.lineTo(3.5,0);gable.lineTo(0,1.16);gable.closePath();
    const g=new THREE.ExtrudeGeometry(gable,{depth:.14,bevelEnabled:false});
    annex.add(g,plaster,[-179.5,floor+2.99,z-.07]);g.dispose();
  }
  annex.box([-179.5,floor+4.27,190],[.18,.12,13.9],iron);
  // The open leaf rests against the outside wall. A cart can roll in through the opening from the west.
  annex.box([-183.17, floor + 1.15, 192.92], [.09, 2.3, 1.36], darkTimber);
  const deliveryRamp: V3[] = [
    at(-186, 182, .04), at(-186, 186.5, .22), at(-186, 191, .19),
    [-186, floor + .02, 194.4], [-182.82, floor + .02, 194.4],
  ];
  landscapeWalkway(annex, deliveryRamp, { width: 1.52, floor: timber, edge: darkTimber, continuousCorners: true });
  for (let i = 1; i < 4; i++) {
    const [x, y, z] = deliveryRamp[i];
    annex.box([x - .89, y + .41, z], [.13, .82, .13], darkTimber);
    annex.box([x - .89, y + .79, z], [.15, .11, .15], '#f3d995');
  }
  // Sawdust-coloured rims and the ladle silhouette pick out the serving entrance from both approaches.
  annex.box([-183.24, floor + 2.75, 194.43], [.14, .59, 1.33], darkTimber);
  annex.ring([-183.33, floor + 2.7, 194.25], .14, .036, '#f3d995', 'body', [0, Math.PI / 2, 0]);
  annex.beam([-183.33, floor + 2.78, 194.35], [-183.33, floor + 2.95, 194.78], .06, '#f3d995');
  // Kitchen: counter, stove, water barrel and shelf along the north wall.
  annex.box([-179.5, floor + .45, 195.8], [5, .9, .8], timber, true); annex.box([-181.6, floor + .55, 195.8], [1, 1.1, .8], iron, true);
  annex.cyl([-177, floor + .5, 195.6], .4, 1, darkTimber, true); annex.box([-179.5, floor + 1.9, 196.25], [4, .1, .4], timber);
  // One continuous stovepipe passes through the roof above the stove; the flashing sits on the same pitch.
  annex.cyl([-181.6,floor+2.89,195.86],.17,3.58,iron);
  annex.box([-181.6,floor+3.67,195.86],[.67,.075,.64],iron,false,'body',[0,0,pitch]);
  annex.cyl([-181.6,floor+4.71,195.86],.27,.095,iron);
  annex.box([-181.6,floor+.55,195.37],[.68,.43,.08],'#282b2d');
  annex.box([-181.45,floor+.59,195.31],[.22,.045,.06],timber);
  for(const dy of[.19,.77])annex.cyl([-177,floor+dy,195.6],.411,.055,iron);
  for(const x of[-181.05,-177.95])annex.beam([x,floor+1.54,196.38],[x,floor+1.85,196.08],.07,darkTimber);
  // Both portions and the signed copy remain on the counter when the player returns.
  for (const x of [-180.6, -179.95]) {
    annex.cyl([x, floor + 1.01, 195.7], .205, .19, '#e8d7b1', false, 'resolved');
    annex.cyl([x, floor + 1.112, 195.7], .178, .015, '#b87f47', false, 'resolved');
  }
  annex.paper(-179.35, floor + .925, 195.74, .43, .32, 'resolved');
  // The protagonist's room: bed, desk and chair, a chest and one keepsake shelf.
  annex.box([-181.6, floor + .3, 185.2], [2.2, .6, 1.3], darkTimber, true); annex.box([-181.6, floor + .66, 185.2], [2.1, .14, 1.2], '#f1ece2');
  annex.box([-181.88,floor+.755,185.2],[1.48,.07,1.21],'#809994');
  annex.box([-180.93,floor+.8,185.2],[.42,.14,.86],'#ddd4bd');
  annex.box([-177.2, floor + .38, 188.4], [1.4, .76, .7], timber, true); annex.box([-177.2, floor + .23, 187.6], [.5, .46, .5], darkTimber, true);
  annex.box([-182.4, floor + .3, 188.5], [.9, .6, .6], darkTimber, true); annex.box([-182.85, floor + 1.6, 187], [.25, .08, 1.4], timber);
  // Yard: low fence with a gate toward the hall path, a bench and a clothesline.
  // East fence with its gate near the hall end (level ground); the north edge is a closed fence above the drop.
  for (let z = 183.7; z <= 196.3; z += 1.4) if (z < 193.4 || z > 195.6) annex.box([-171.6, floor + .45, z], [.1, .9, .1], darkTimber, true);
  annex.box([-171.6, floor + .75, 188.4], [.08, .08, 9.4], timber, true);
  for (let x = -175.8; x <= -171.8; x += 1) annex.box([x, floor + .45, 183.4], [.1, .9, .1], darkTimber, true);
  annex.box([-173.8, floor + .75, 183.4], [4.2, .08, .08], timber, true);
  annex.box([-173.5,floor+.46,194.8],[2.2,.12,.5],timber,true);
  for(const x of[-174.32,-172.68])annex.box([x,floor+.2,194.8],[.14,.4,.45],darkTimber);
  const laundry=(t:number):V3=>[-175.6+3.6*t,floor+2.23-.18*(1-Math.abs(2*t-1)),185.2+6.8*t];
  for(const t of[0,1]){
    const [x,y,z]=laundry(t);
    annex.box([x,(floor+y)/2,z],[.105,y-floor,.105],darkTimber);
    annex.beam(laundry(t),laundry(.5),.025,'#d9d2c0');
  }
  for(const [t,color] of [[.36,'#d8caac'],[.68,'#97aaba']] as const){
    const [x,y,z]=laundry(t);
    annex.box([x,y-.355,z],[.7,.71,.035],color,false,'body',[0,-Math.atan2(6.8,3.6),0]);
    for(const pin of[t-.035,t+.035]){
      const [px,py,pz]=laundry(pin);
      annex.box([px,py-.014,pz],[.058,.1,.06],timber);
    }
  }
  finish(annex, 'ValleyCanteenAnnex');
  const supperShelf = annex.layers.get('resolved')!;

  // T01 Homeward Square: return lamp, posted timetable, public bench, departure platform.
  const square = new SiteArt(), sx = 660, sz = 79, sy = ground(sx, sz);
  square.box([sx, sy + 2.6, sz - 1.4], [.18, 5.2, .18], iron, true); square.box([sx, sy + 5.3, sz - 1.4], [.6, .5, .6], '#ffd98a', false, 'glow');
  square.box([sx + 2, sy + 1.2, sz - .6], [2.2, 1.4, .1], timber, true); square.box([sx + 2, sy + 1.3, sz - .54], [2, 1.1, .02], '#e8dfc8');
  square.box([sx - 2.5, sy + .45, sz + .6], [2, .12, .5], timber, true); square.box([sx, sy + .12, sz + 5], [4, .24, 2.5], stone, true);
  for(const dx of[-.79,.79]){
    const bx=sx-2.5+dx,bz=sz+.6,by=ground(bx,bz);
    square.box([bx,(by+sy+.41)/2,bz],[.12,Math.max(.06,sy+.41-by),.44],darkTimber);
    square.box([sx+2+dx,sy+.8,sz-.6],[.12,1.6,.14],darkTimber);
  }
  finish(square, 'HomewardSquareFixtures');

  return {
    root, colliders,
    apply(d: ReadonlySet<string>) {
      const built = d.has('journey_sky_return'); footCollider.enabled = built; foot.root.visible = built;
      supperShelf.visible = d.has(VT.supper);
    },
    update(viewer: THREE.Vector3) { root.visible = Math.hypot(viewer.x + 220, viewer.z - 100) < 420 || Math.hypot(viewer.x - 660, viewer.z - 79) < 260; },
    dispose() {
      colliders.forEach(c=>{c.enabled=false;c.bvh.geometry.dispose();});
      for(const art of arts){
        for(const mesh of art.layers.values())mesh.geometry.dispose();
        Object.values(art.materials).forEach(material=>material.dispose());
      }
      root.removeFromParent();
    },
  };
}
