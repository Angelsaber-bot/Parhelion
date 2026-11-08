import * as THREE from 'three';
import { SiteArt } from '../story/campaignSites';
import { PARALLAX, PARALLAX_LABELS, parallaxSetting } from '../story/parallaxSurvey';
import type { Marker } from '../core/types';

type Point = [number, number, number];
/** Grass exclusions follow the instruments, axial walk and observation baseline. */
export const PARALLAX_CLEARANCE = [[-121.5, 261, -114.5, 282], [-126, 282, -102, 286]] as const;
export const PARALLAX_ART_BUDGET = { meshes: 6, materials: 3, triangles: 7000 } as const;
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'], '2': ['111','001','111','100','111'],
  A: ['010','101','111','101','101'], L: ['100','100','100','100','111'], P: ['110','101','110','100','100'],
  R: ['110','101','110','101','101'], X: ['101','101','010','101','101'],
};

/** Open-air exhibit on the existing campus terrace. Paving follows the sampled
 * terrain and is visual only: neither footpaths nor the saved travel point move. */
export function createParallaxGarden(height: (x: number, z: number) => number | null) {
  const art = new SiteArt();
  const origin: Point = [-118, height(-118, 284) ?? 10, 284];
  const front: Point = [...origin];
  const side: Point = [-104, height(-104, 284) ?? origin[1], 284];
  const subject: Point = [-118, origin[1] + 2.6, 269];
  const floorAt = (x: number, z: number) => height(x, z) ?? origin[1];
  const ink = '#344d5b', concrete = '#c4cac0', edge = '#73848b', brass = '#e6bd72', teal = '#83c7ce';
  const surface = (points: Point[], color: string) => {
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    art.add(geometry, color, [0, 0, 0]); geometry.dispose();
  };
  // Each tile samples its corners, avoiding floating slabs on the campus slope.
  const tile = (x0: number, z0: number, x1: number, z1: number, color: string, lift = .016) => {
    const a: Point = [x0, floorAt(x0,z0)+lift,z0], b: Point = [x0,floorAt(x0,z1)+lift,z1];
    const c: Point = [x1,floorAt(x1,z1)+lift,z1], d: Point = [x1,floorAt(x1,z0)+lift,z0];
    surface([a,b,c,a,c,d],color);
  };
  const paved = (x0: number, z0: number, x1: number, z1: number, step = 1) => {
    for (let x=x0; x<x1; x+=step) for (let z=z0; z<z1; z+=step) {
      tile(x,z,Math.min(x+step,x1),Math.min(z+step,z1),'#78867e',.009);
      tile(x+.025,z+.025,Math.min(x+step,x1)-.025,Math.min(z+step,z1)-.025,Math.round(x+z)%3 ? concrete : '#b5beb9');
    }
    for (let z=z0;z<z1;z+=step) for(const x of[x0,x1-.09])tile(x,z,x+.09,Math.min(z+step,z1),edge,.023);
  };
  paved(-120.8,262,-115.2,274,1.4);
  paved(-119.6,274,-116.4,282,1.6);
  paved(-126,282,-102,286,1);
  // Lettering consists of planar inlays, batched with the exhibit: no font/image load.
  const lettering = (text: string, center: Point, pixel: number, horizontal = false) => {
    let cursor = center[0] - (text.length*4-1)*pixel/2;
    for(const letter of text) {
      const glyph=GLYPHS[letter];
      if(glyph) for(let row=0;row<glyph.length;row++)for(let col=0;col<glyph[row].length;col++)if(glyph[row][col]==='1') {
        const x=cursor+col*pixel, v=(2.5-row)*pixel, w=pixel*.84;
        if(horizontal)surface([[x,center[1],center[2]-v],[x,center[1],center[2]-v+w],[x+w,center[1],center[2]-v+w],[x,center[1],center[2]-v],[x+w,center[1],center[2]-v+w],[x+w,center[1],center[2]-v]],ink);
        else surface([[x,center[1]+v,center[2]],[x,center[1]+v-w,center[2]],[x+w,center[1]+v-w,center[2]],[x,center[1]+v,center[2]],[x+w,center[1]+v-w,center[2]],[x+w,center[1]+v,center[2]]],ink);
      }
      cursor+=4*pixel;
    }
  };
  // Two real separated optical rings on rigid fork mounts. The open centers and
  // low cross-braces preserve the two observation rays and all walking routes.
  for (const [z, radius, color] of [[272, 1.05, brass], [264, 1.6, teal]] as const) {
    const floor = floorAt(-118,z), half = radius+.26;
    const layer=z===272?'choiceA':'choiceB';
    art.ring([-118, subject[1], z], radius, .09, color, layer);
    art.beam([-118,floor+.24,z],[-118,subject[1]-radius,z],.13,ink,true,'metal');
    art.box([-118,floor+.1,z],[half*2+.7,.2,1.5],edge,true);
    art.box([-118,floor+.215,z],[half*2+.48,.03,1.3],ink);
    for(const sign of[-1,1]) {
      const x=-118+sign*half, base=floorAt(x,z);
      art.box([x,base+.25,z],[.48,.1,.9],'#a9b6b5',true,'metal');
      art.beam([x+sign*.16,base+.3,z-.34],[x,subject[1],z],.14,ink,true,'metal');
      art.beam([x+sign*.16,base+.3,z+.34],[x,subject[1],z],.14,ink,true,'metal');
      art.cyl([x,subject[1],z],.16,.22,'#a9b6b5',false,'metal',[0,0,Math.PI/2]);

      for(const dx of[-.14,.14])for(const dz of[-.3,.3])art.cyl([x+dx,base+.31,z+dz],.035,.025,ink,false,'metal');
    }
    // Engraved azimuth marks and one broad zero mark make the instrument legible.
    for(let i=0;i<16;i++) {
      const angle=i*Math.PI/8, major=i%4===0;
      art.box([-118+Math.cos(angle)*radius,subject[1]+Math.sin(angle)*radius,z+.093],[major?.045:.025,major?.13:.07,.012],ink,false,layer,[0,0,angle-Math.PI/2]);
    }
    art.box([-118,floor+.24,z+.53],[.9,.018,.23],'#e0dfcc');
    lettering(z===272?'01':'02',[-118,floor+.252,z+.53],.035,true);
  }
  // Distinct shapes as well as colour: the survey never depends on colour vision.
  art.ring([front[0], front[1] + .06, front[2]], 1.25, .035, brass, 'metal', [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, b = (i + 1) * Math.PI / 2;
    art.beam([side[0] + Math.cos(a) * 1.4, side[1] + .065, side[2] + Math.sin(a) * 1.4], [side[0] + Math.cos(b) * 1.4, side[1] + .065, side[2] + Math.sin(b) * 1.4], .055, teal, false, 'metal');
  }
  for(const [station,number,color] of [[front,'01',brass],[side,'02',teal]] as const) {
    const z=station[2]+1.65,y=floorAt(station[0],z);
    art.box([station[0],y+.038,z],[1.15,.025,.38],color);
    lettering(number,[station[0],y+.054,z],.055,true);
    // Short pointers flank the sight line without covering the footprint.
    for(const sign of[-1,1])art.beam([station[0]+sign*.18,station[1]+.05,station[2]-1.66],[station[0],station[1]+.05,station[2]-1.92],.035,ink);
  }
  for(let x=-115.5;x<-106;x+=.5) {
    const major=Math.abs(x-Math.round(x))<.01;
    tile(x,284.9,x+.025,284.9+(major?.24:.12),ink,.03);
  }
  // A dial legend identifies the two controls without illustrating the answer.
  const boardY = floorAt(-124,284);
  for(const x of[-125,-123]) {
    art.box([x,boardY+.5,284],[.13,1,.18],edge,true,'metal');
    art.box([x,boardY+.06,284],[.35,.12,.42],ink,true);
  }
  art.box([-124,boardY+1.3,284],[2.6,1.05,.18],ink,true);
  art.box([-124,boardY+1.33,284.105],[2.35,.84,.025],'#e9dec6');
  art.box([-124,boardY+1.84,284.05],[2.75,.06,.36],edge,false,'metal');
  lettering('PARALLAX',[-124,boardY+1.64,284.126],.045);
  art.box([-124,boardY+1.26,284.13],[.018,.48,.012],'#9baba6');
  for(const [cx,number] of[[-124.65,'01'],[-123.37,'02']] as const) {
    art.ring([cx,boardY+1.3,284.145],.13,.012,number==='01'?brass:teal);
    for(const sign of[-1,1])art.box([cx+sign*.07,boardY+1.3,284.15],[.04,.05,.018],ink);
    lettering(number,[cx,boardY+1.025,284.14],.028);
  }
  art.box([-124, boardY + 1.9, 284.12], [2.25, .07, .04], '#9dd8bc', false, 'resolved');
  for(const x of[-120.2,-115.8]) {
    const y=floorAt(x,284);art.box([x,y+.5,284],[.12,1,.18],edge,true,'metal');
    art.ring([x,y+1.12,284],.26,.035,brass);art.beam([x-.22,y+1.12,284],[x+.22,y+1.12,284],.035,ink);
    for(const dx of[-.22,0,.22])art.box([x+dx,y+.82,284.04],[.04,.07,.04],ink);
  }
  art.finish('alpha'); art.root.name = 'ParallaxGarden';
  const rings=[art.layers.get('choiceA')!,art.layers.get('choiceB')!];
  rings.forEach((mesh,i)=>{mesh.geometry.translate(118,-subject[1],-(i===0?272:264));mesh.position.set(-118,subject[1],i===0?272:264);mesh.name=i===0?'Parallax_Near_Ring':'Parallax_Far_Ring';});

  const markers: Marker[] = [
    {id:PARALLAX.near,type:'interact',label:PARALLAX_LABELS[0][1][0],p:[-120.2,floorAt(-120.2,284)+1.12,284],radius:1.7},
    {id:PARALLAX.far,type:'interact',label:PARALLAX_LABELS[1][1][0],p:[-115.8,floorAt(-115.8,284)+1.12,284],radius:1.7},
    { id: PARALLAX.board, type: 'interact', label: PARALLAX_LABELS.find(x=>x[0]===PARALLAX.board)![1][0], p: [-124, boardY + 1.2, 284.35], radius: 2.7 },
    { id: PARALLAX.front, type: 'interact', label: PARALLAX_LABELS.find(x=>x[0]===PARALLAX.front)![1][0], p: [front[0], front[1] + .8, front[2]], radius: 2 },
    { id: PARALLAX.side, type: 'interact', label: PARALLAX_LABELS.find(x=>x[0]===PARALLAX.side)![1][0], p: [side[0], side[1] + .8, side[2]], radius: 2 },
  ];
  let disposed = false;
  return {
    root: art.root, markers, collisionGeometries: art.solids, front, side, subject,
    apply(done: ReadonlySet<string>) { rings.forEach((mesh,i)=>{mesh.rotation.y=((done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)?1:parallaxSetting(done,i===0?'near':'far'))-1)*Math.PI/3;mesh.updateMatrix();}); art.layers.get('resolved')!.visible = done.has(PARALLAX.tested)||(done.has(PARALLAX.complete)&&!done.has(PARALLAX.experiment)); },
    dispose() {
      if (disposed) return; disposed = true;
      art.root.removeFromParent();
      art.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      for (const g of art.solids) g.dispose();
      for (const m of Object.values(art.materials)) m.dispose();
    },
  };
}
