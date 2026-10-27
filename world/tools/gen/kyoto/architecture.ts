/** Hand-modelled, deterministic Kyoto architectural vocabulary.
 * Every detail here is visual only: collision remains with the coarse, tested building proxies.
 * No external meshes, textures, or runtime allocations are required by the generated scene.
 */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';

const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const POT = new THREE.SphereGeometry(1, 8, 5);
const CAP = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const roofCache = new Map<string, THREE.BufferGeometry>();
const shade = (hex: string, value: number) => new THREE.Color(hex).multiplyScalar(value);

/** Rectangular timber between arbitrary endpoints, with no collision. */
export function addBeam(b: Batch, a: [number, number, number], c: [number, number, number], width: number, depth: number, color: string) {
  const av = new THREE.Vector3(...a), cv = new THREE.Vector3(...c), delta = cv.clone().sub(av);
  const m = new THREE.Matrix4().compose(av.add(cv).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()), new THREE.Vector3(width, delta.length(), depth));
  b.add(BOX, color, m, false);
}

/** Local builder: x runs along the facade, z points out towards the street, y is absolute. */
export function localCraft(b: Batch, x: number, z: number, ry: number) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const point = (u: number, y: number, v: number): [number, number, number] => [x + c * u + s * v, y, z - s * u + c * v];
  return {
    point,
    box(u: number, y: number, v: number, w: number, h: number, d: number, color: string | THREE.Color, rx = 0) {
      const p = point(u, y, v); b.add(BOX, color, T(...p, ry, w, h, d, rx), false);
    },
    cylinder(u: number, y: number, v: number, r: number, h: number, color: string) {
      b.add(CYL8, color, T(...point(u, y, v), ry, r, h, r), false);
    },
    beam(a: [number, number, number], end: [number, number, number], w: number, d: number, color: string) {
      addBeam(b, point(...a), point(...end), w, d, color);
    },
  };
}

/** Curved roof surface, with exposed soffit and upturned corners rather than a solid pyramid. */
function roofSurface(w: number, d: number, h: number, kind: 'hip' | 'gable') {
  const key = `${w}:${d}:${h}:${kind}`;
  const old = roofCache.get(key); if (old) return old;
  const p: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    p.push(...a, ...c, ...b); // upward-facing outer skin
    p.push(a[0],a[1]-0.14,a[2], b[0],b[1]-0.14,b[2], c[0],c[1]-0.14,c[2]); // visible timber soffit
  };
  const quad = (a: number[], b: number[], c: number[], e: number[]) => { tri(a,b,c); tri(a,c,e); };
  // Five slope breaks make the eave readable at street distance without dense tessellation.
  const N = 5, thick = Math.min(0.22, h * 0.13);
  const height = (t: number) => h * Math.pow(1-t, 1.45) + Math.min(0.30, h * 0.16) * Math.pow(t, 8);
  if (kind === 'gable') {
    for (const sign of [-1,1]) for (let k=0; k<N; k++) {
      const t0=k/N,t1=(k+1)/N;
      const a=[-w/2,height(t0),sign*d/2*t0], q=[w/2,height(t0),sign*d/2*t0];
      const c=[w/2,height(t1),sign*d/2*t1], e=[-w/2,height(t1),sign*d/2*t1];
      if(sign===1) quad(a,q,c,e); else quad(q,a,e,c);
      for (const side of [-1,1]) {
        const x=side*w/2;
        quad([x,height(t0),sign*d/2*t0],[x,height(t1),sign*d/2*t1],[x,height(t1)-thick,sign*d/2*t1],[x,height(t0)-thick,sign*d/2*t0]);
      }
    }
  } else {
    // Ridge follows the long axis; square pagodas finish in a compact crown.
    const ridgeX = Math.max(0.15, (w-d)*0.44), ridgeZ = Math.max(0.15, (d-w)*0.44);
    const ring = (t: number) => {
      const xx=ridgeX*(1-t)+w/2*t, zz=ridgeZ*(1-t)+d/2*t, yy=height(t);
      return [[-xx,yy,-zz],[xx,yy,-zz],[xx,yy,zz],[-xx,yy,zz]];
    };
    for(let k=0;k<N;k++) {
      const a=ring(k/N), q=ring((k+1)/N);
      for(let j=0;j<4;j++) { const jj=(j+1)%4; quad(a[jj],a[j],q[j],q[jj]); }
    }
    const e=ring(1);
    for(let j=0;j<4;j++) { const jj=(j+1)%4; quad(e[j],e[jj],[e[jj][0],e[jj][1]-thick,e[jj][2]],[e[j][0],e[j][1]-thick,e[j][2]]); }
    quad(...ring(0) as [number[],number[],number[],number[]]);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.computeVertexNormals();
  roofCache.set(key,g); return g;
}

/** Slender kawara/cypress roof with curved slopes, ridge caps, fascia and individual eave rafters. */
export function addKyotoRoof(b: Batch, x: number, y: number, z: number, ry: number, w: number, d: number, rh: number, color: string, kind: 'hip' | 'gable' = 'hip', detail = true) {
  b.add(roofSurface(w,d,rh,kind),color,T(x,y,z,ry),false);
  const f=localCraft(b,x,z,ry), ridgeX=kind==='gable'?w:Math.max(0.4,(w-d)*0.88), ridgeZ=kind==='gable'?0:Math.max(0.4,(d-w)*0.88);
  const lift=Math.min(0.30,rh*0.16), capColor=shade(color,1.22);
  f.box(0,y+rh+0.12,0,ridgeX+0.34,0.22,Math.max(0.34,ridgeZ+0.18),capColor);
  for(const s of [-1,1]) {
    f.box(0,y+lift-0.12,s*d/2,w+0.05,0.15,0.14,'#504336');
    if(kind==='hip') f.box(s*w/2,y+lift-0.12,0,0.14,0.15,d,'#504336');
  }
  if(!detail) return;
  const spacing=w>12?1.0:1.15;
  for(let u=-w/2+0.4;u<w/2-0.25;u+=spacing) for(const s of [-1,1]) {
    // Short exposed rafters stay up at the roof, never protruding into a navigation lane.
    f.box(u,y+lift-0.25,s*(d/2-0.34),0.10,0.15,0.8,'#a17d54',-s*0.18);
  }
  if(kind==='hip') {
    for(let v=-d/2+0.5;v<d/2-0.4;v+=1.25) for(const s of [-1,1])
      f.box(s*(w/2-0.34),y+lift-0.24,v,0.8,0.14,0.10,'#8c6947');
    // Four raised diagonal hip seams emphasize the silhouette and curved construction.
    for(const sx of [-1,1]) for(const sz of [-1,1]) {
      const ax=sx*ridgeX/2,az=sz*ridgeZ/2;
      for(let k=0;k<4;k++) {
        const t0=k/4,t1=(k+1)/4;
        const pp=(t:number):[number,number,number]=>[ax*(1-t)+sx*w/2*t,y+rh*Math.pow(1-t,1.45)+lift*Math.pow(t,8)+0.05,az*(1-t)+sz*d/2*t];
        f.beam(pp(t0),pp(t1),0.12,0.12,'#67665d');
      }
    }
  }
  // At landmark scale, restrained courses make the material legible instead of a smooth plastic sheet.
  // Brown cypress roofs get horizontal shingle courses; slate gets both courses and sparse tile channels.
  if(Math.max(w,d)>=12 && Math.min(w,d)>=6) {
    const c=new THREE.Color(color),cypress=c.r>c.b*1.12;
    const courseColor=c.clone().multiplyScalar(cypress?.88:1.12).getStyle();
    const curve=(t:number)=>y+rh*Math.pow(1-t,1.45)+lift*Math.pow(t,8)+.025;
    const rx=kind==='gable'?w/2:Math.max(.15,(w-d)*.44), rz=kind==='gable'?0:Math.max(.15,(d-w)*.44);
    const courses=cypress?10:7;
    for(let k=1;k<courses;k++) {
      const t=k/courses,xx=rx*(1-t)+w/2*t,zz=rz*(1-t)+d/2*t;
      for(const sign of [-1,1]) f.box(0,curve(t),sign*zz,xx*2,.035,cypress?.055:.075,courseColor);
      if(kind==='hip') for(const sign of [-1,1]) f.box(sign*xx,curve(t),0,cypress?.055:.075,.035,zz*2,courseColor);
    }
    if(!cypress) {
      const tileColor=c.clone().multiplyScalar(.77).getStyle();
      for(let u=-w/2+.7;u<w/2-.5;u+=1.25) for(const sign of [-1,1]) {
        const t0=kind==='gable'?.04:Math.max(.08,(Math.abs(u)-rx)/(w/2-rx));
        for(let k=0;k<4;k++) {
          const ta=t0+(1-t0)*k/4,tb=t0+(1-t0)*(k+1)/4;
          f.beam([u,curve(ta),sign*(rz*(1-ta)+d/2*ta)],[u,curve(tb),sign*(rz*(1-tb)+d/2*tb)],.035,.055,tileColor);
        }
      }
      // Individual cap segments along the ridge catch light with a subtle repeating cadence.
      const length=Math.max(ridgeX,ridgeZ);
      for(let k=-length/2+.22;k<length/2;k+=.50) {
        if(ridgeX>=ridgeZ) f.box(k,y+rh+.25,0,.42,.06,.30,capColor);
        else f.box(0,y+rh+.25,k,.30,.06,.42,capColor);
      }
    }
  }
  // Rounded ridge-end onigawara silhouettes; small enough to read as craft, not extruded boxes.
  for(const s of [-1,1]) {
    const u=ridgeX>=ridgeZ?s*ridgeX/2:0,v=ridgeX>=ridgeZ?0:s*ridgeZ/2;
    b.add(CAP,capColor,T(...f.point(u,y+rh+0.22,v),ry,0.22,0.28,0.22),false);
  }
}

/** Recessed shoji/lattice bay with real mullions and sill, reusable on temples and shops. */
export function addLattice(b: Batch,x:number,y:number,z:number,ry:number,w:number,h:number,wood='#513b2d',paper='#d4c3a2',bars=5) {
  const f=localCraft(b,x,z,ry);
  f.box(0,y,0,w,h,0.05,paper);
  for(let k=0;k<=bars;k++) f.box(-w/2+w*k/bars,y,0.045,0.055,h+0.08,0.07,wood);
  for(const v of [-h/2,0,h/2]) f.box(0,y+v,0.055,w+0.12,0.055,0.08,wood);
}

/** Bracket capitals underneath temple eaves (tokyō), with stepped arms and keyed cross-blocks. */
export function addBracket(b: Batch,x:number,y:number,z:number,ry:number,scale=1,color='#835d3e') {
  const f=localCraft(b,x,z,ry);
  f.box(0,y,0,0.34*scale,0.34*scale,0.34*scale,color);
  f.box(0,y+0.22*scale,0,0.94*scale,0.18*scale,0.35*scale,color);
  f.box(0,y+0.40*scale,0.10*scale,0.35*scale,0.18*scale,1.12*scale,color);
  for(const s of [-1,1]) f.box(s*0.36*scale,y+0.40*scale,0,0.22*scale,0.20*scale,0.35*scale,'#b08758');
}

/** Distinct machiya trades: textile, tea, pottery, sake, rice, paper, metalwork and residence.
 * Seeded from coordinates, not the world RNG: upgrading art never moves existing city props.
 */
export function addMachiyaCraft(b: Batch,x:number,y:number,z:number,ry:number,w:number,d:number,h:number) {
  const hash=Math.abs(Math.round(x*29+z*71)), style=hash%8, f=localCraft(b,x,z,ry), front=d/2+0.08;
  const wood=['#684936','#77533b','#594132','#6e4430'][hash%4];
  const cloth=['#465e74','#6e3a42','#688064','#b29053','#766278','#ddd0b0'][hash%6];
  // Structural frame, tall corner posts, split shop/residential bays, and separate sill/plinth.
  f.box(0,y+0.18,0,w+0.05,0.36,d+0.04,'#817b6d');
  for(const u of [-w/2+0.08,w/2-0.08,style===5?0:-w*0.14]) f.box(u,y+h/2,front,0.16,h,0.18,wood);
  for(const yy of [0.42,2.75,h-0.16]) f.box(0,y+yy,front,w,0.15,0.20,wood);
  const bayW=w*0.55, bayX=w*0.18;
  addLattice(b,...f.point(bayX,y+1.58,front+0.05),ry,bayW,1.88,wood,style===2?'#5c5141':'#b8a98a',style===1?3:6);
  // Sliding door recess and rails differ from the adjacent shop display.
  const doorX=-w*0.30;
  f.box(doorX,y+1.48,front+0.02,w*0.22,2.10,0.08,'#342b28');
  for(let i=0;i<3;i++) f.box(doorX-w*0.09+i*w*0.09,y+1.48,front+0.10,0.045,2.05,0.06,wood);
  f.box(doorX+w*0.075,y+1.48,front+0.16,0.05,0.30,0.05,'#b79a66');
  // Mushiko windows: broad plaster surround in warehouse variants; split bays in homes.
  const upperY=y+(h+3.0)/2,upperH=Math.max(0.55,h-3.55);
  if(style===4 || style===5) {
    for(const u of [-w*0.23,w*0.23]) {
      f.box(u,upperY,front+0.01,w*0.31,upperH+0.24,0.10,'#ddd3b9');
      addLattice(b,...f.point(u,upperY,front+0.09),ry,w*0.23,upperH,wood,'#625e51',4);
    }
  } else {
    addLattice(b,...f.point(0,upperY,front+0.06),ry,w*0.72,upperH,wood,'#b9b79b',style===7?7:5);
  }
  // Hisashi is a sloping slate canopy with a light timber under-edge, not a floating slab.
  f.box(0,y+2.94,front+0.40,w+0.12,0.14,1.05,'#4e565a',0.16);
  f.box(0,y+2.79,front+0.90,w+0.15,0.10,0.11,wood);
  if(style!==7) {
    const n=style===0?4:3;
    for(let i=0;i<n;i++) f.box(doorX+(i-(n-1)/2)*0.31,y+2.22,front+0.24,0.29,0.65+(i%2)*0.08,0.035,cloth);
    // A spare circle crest on noren cloth, geometrically legible without pseudo-Japanese text.
    b.add(CYL8,'#d8cba8',T(...f.point(doorX,y+2.23,front+0.27),ry,0.12,0.016,0.12,Math.PI/2),false);
  }
  // All trade props occupy the shop's 0.9m frontage setback, not the 8m streets.
  const vx=w*0.25,vz=front+0.44;
  if(style===0) { // dyed fabric: three hanging bolts beneath a slim split sign
    for(let k=0;k<3;k++) f.box(vx+(k-1)*0.44,y+1.20,vz,0.36,1.60,0.10,['#526b85','#af735d','#9c9b6c'][k]);
    f.box(vx,y+2.10,vz,1.6,0.08,0.12,wood);
  } else if(style===1 || style===7) { // tea-house bench / domestic veranda
    f.box(0,y+0.49,front+0.57,w*0.75,0.12,0.62,wood);
    for(const u of [-w*0.27,w*0.27]) f.box(u,y+0.26,front+0.55,0.12,0.42,0.40,wood);
    if(style===1) for(const u of [0.0,0.45]) b.add(POT,'#5b796f',T(...f.point(u,y+0.70,front+0.56),0,0.15,0.15,0.15),false);
  } else if(style===2) { // ceramic merchant: two shelves of different vessel profiles
    for(const yy of [0.55,1.25]) {
      f.box(vx,y+yy,vz,w*0.43,0.09,0.55,wood);
      for(let k=0;k<3;k++) {
        const u=vx+(k-1)*0.46;
        b.add(POT,k===1?'#718c87':'#b68560',T(...f.point(u,y+yy+0.22,vz),0,0.17,0.24,0.17),false);
        f.cylinder(u,y+yy+0.42,vz,0.08,0.10,'#ba9870');
      }
    }
  } else if(style===3) { // sake barrels with separate hoops and stave rhythm
    for(let k=0;k<2;k++) {
      const u=vx+(k-0.5)*0.72;
      f.cylinder(u,y+0.50,vz,0.32,0.85,'#b8a47a');
      for(const yy of [0.21,0.73]) f.cylinder(u,y+yy,vz,0.335,0.065,'#5c5140');
    }
  } else if(style===4) { // rice bales / round woven basket
    for(let k=0;k<3;k++) {
      const u=vx+(k-1)*0.42;
      b.add(POT,'#b7a070',T(...f.point(u,y+0.30,vz),ry,0.24,0.22,0.34),false);
    }
  } else if(style===5) { // paper merchant: split hinged shutters and stacked reams
    f.box(vx,y+0.74,vz,1.45,0.10,0.60,wood);
    for(let k=0;k<3;k++) f.box(vx-0.44+k*0.44,y+0.88+k*0.05,vz,0.38,0.15+k*0.10,0.42,'#e0d5b9');
  } else { // metalworker: tongs, anvil and small shuttered smoke vent
    f.box(vx,y+0.35,vz,0.68,0.65,0.58,'#66503a');
    f.box(vx,y+0.74,vz,0.84,0.18,0.40,'#465052');
    f.box(vx,y+0.90,vz,0.52,0.14,0.35,'#566064');
  }
  // Eave sign shapes vary by trade; no generated/inauthentic lettering.
  if(style<6) {
    f.box(w/2-0.42,y+3.46,front+0.25,0.48,0.78,0.14,style===3?'#aa9570':wood);
    for(let k=0;k<3;k++) f.box(w/2-0.42,y+3.23+k*0.20,front+0.33,0.26-k*0.04,0.045,0.02,'#c4b487');
  }
  // Forecourt side wall has vertical timber siding, rather than a flat plaster box from oblique views.
  for(const side of [-1,1]) for(let k=0;k<4;k++) f.box(side*(w/2+0.015),y+1.32,-d/2+(k+0.5)*d/4,0.05,2.25,0.055,wood);
  return style;
}

/** A whole city block with deliberate negative space, rather than another ring of houses.
 * 0 = merchant courtyard, 1 = open market, 2 = small Buddhist hall, 3 = dye-yard/workshop.
 * Caller supplies the existing inset block rectangle; all construction stays inside it.
 */
export function addCityBlock(b:Batch,x:number,y:number,z:number,w:number,d:number,kind:number) {
  const f=localCraft(b,x,z,0), wood='#73523a', pale='#d3c7a8';
  const groundY=y+0.035;
  f.box(0,groundY,0,w-0.3,0.06,d-0.3,kind===2?'#b5b09c':'#b7a17c');
  const wall=(u:number,v:number,ww:number,dd:number)=>{
    f.box(u,y+0.72,v,ww,1.44,dd,pale);
    f.box(u,y+1.48,v,ww+0.16,0.12,dd+0.16,'#62625a');
  };
  if(kind===1) {
    // Four lean-to stalls enclose an open, walkable produce/fabric market.
    for(const [u,v,ry] of [[-w*.27,-d*.25,0],[w*.27,-d*.25,0],[-w*.27,d*.25,Math.PI],[w*.27,d*.25,Math.PI]]) {
      const q=localCraft(b,x+u,z+v,ry);
      for(const side of [-1,1]) q.box(side*2.1,y+1.45,0,0.13,2.9,0.13,wood);
      q.box(0,y+1.0,0,4.4,0.16,1.3,wood);
      q.box(0,y+2.9,0,4.9,0.10,2.3,v<0?'#718275':'#a3805e',0.15);
      for(let k=0;k<4;k++) {
        q.box(-1.55+k*1.02,y+1.16,0,0.85,0.19,0.85,'#8f704a');
        for(let n=0;n<2;n++) b.add(POT,k%2?'#b68e5f':'#7b8b5a',T(...q.point(-1.7+k*1.02+n*.27,y+1.40,0),0,.18,.18,.18),false);
      }
      // Cloth scallops are separated panels, not a solid billboard.
      for(let k=0;k<5;k++) q.box(-1.9+k*.95,y+2.62,1.12,.88,.45,.04,v<0?'#6c7b6a':'#9b6f56');
    }
    // A stone well and crossbar establish the market's centre, with room to pass both sides.
    f.cylinder(0,y+.4,0,.85,.8,'#929183');
    f.cylinder(0,y+.82,0,.65,.05,'#393c36');
    for(const u of [-1.12,1.12]) f.box(u,y+1.2,0,.12,2.4,.12,wood);
    f.box(0,y+2.4,0,2.6,.13,.13,wood);
    return;
  }
  const hallW=kind===2?11.8:w*.70, hallD=kind===3?5.2:6.2, hz=z-d*.28, hallH=kind===2?5.7:4.1;
  b.box(x,y,hz,hallW,hallH,hallD,kind===2?'#77523b':pale);
  addKyotoRoof(b,x,y+hallH,hz,0,hallW+2.6,hallD+2.8,kind===2?3.1:2.2,'#535b5e',kind===2?'hip':'gable');
  for(let i=0;i<4;i++) {
    const xx=x-hallW*.36+i*hallW*.24;
    addLattice(b,xx,y+2.0,hz+hallD/2+.04,0,hallW*.18,2.6,wood,'#b6af92',4);
    if(kind===2) addBracket(b,xx,y+hallH-.65,hz+hallD/2+.15,0,.9,wood);
  }
  f.box(0,y+.38,-d*.28+hallD/2+.65,hallW+1.0,.18,1.3,wood);
  // Low perimeter walls, with a broad south entrance: never obstruct an existing street.
  wall(-w/2+.25,0,.34,d-.4); wall(w/2-.25,0,.34,d-.4);
  wall(0,-d/2+.25,w-.4,.34);
  for(const side of [-1,1]) wall(side*(w/4+1.3),d/2-.25,w/2-3.0,.34);
  for(const side of [-1,1]) f.box(side*2.0,y+1.65,d/2-.3,.22,3.3,.24,wood);
  addKyotoRoof(b,x,y+3.3,z+d/2-.3,0,5.4,2.6,1.05,'#566062','gable');
  if(kind===0) {
    // Side wing and a garden bed form an L, unlike the surrounding row houses.
    b.box(x-w*.32,y,z+.8,3.3,3.4,7.0,wood);
    addKyotoRoof(b,x-w*.32,y+3.4,z+.8,Math.PI/2,7.6,4.2,1.4,'#68685f','gable');
    b.add(POT,'#72896a',T(x+w*.24,y+.20,z+1.7,0,1.8,.25,2.4),false);
    for(let k=0;k<4;k++) f.box(w*.24+Math.sin(k*2.2)*1.7,y+.18,1.7+Math.cos(k*2.2)*2.2,.7,.35,.6,'#8c8e7e');
  } else if(kind===2) {
    // Ceremonial forecourt with a short stone axis and bronze incense bowl.
    f.box(0,y+.09,d*.13,2.4,.16,d*.37,'#9d9e90');
    f.cylinder(0,y+.72,d*.13,.65,.7,'#73877d');
    f.cylinder(0,y+1.09,d*.13,.85,.10,'#657b72');
    for(const u of [-3.0,3.0]) { f.cylinder(u,y+.6,d*.22,.23,1.2,'#a4a48e'); f.box(u,y+1.3,d*.22,.8,.5,.8,'#b7b49d'); }
  } else {
    // Nishijin-style dye-yard: drying frames, stacked boards and cloth in staggered lengths.
    for(let k=0;k<3;k++) {
      const u=-w*.26+k*w*.26;
      for(const v of [.2,d*.29]) f.box(u,y+1.6,v,.11,3.2,.11,wood);
      f.box(u,y+3.18,d*.145,0.12,.12,d*.35,wood);
      f.box(u,y+1.93,d*.13,.04,2.35,d*.29,['#4b647c','#856278','#6f8274'][k]);
    }
  }
}
