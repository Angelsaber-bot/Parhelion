/** Landmark-specific architectural details. Original authored geometry, not downloaded assets.
 * These details deliberately do not participate in collision or quest state.
 */
import * as THREE from 'three';
import { Batch, BOX, T } from '../geo.js';
import { addBeam, addBracket, addLattice, addKyotoRoof, localCraft } from './architecture.js';
const CYL8=new THREE.CylinderGeometry(1,1,1,8);
const CYL12=new THREE.CylinderGeometry(1,1,1,12);
const STONE=new THREE.IcosahedronGeometry(1,1);
const CONE=new THREE.ConeGeometry(1,1,5);

export function addOpenRail(b:Batch,x:number,y:number,z:number,ry:number,length:number,color='#9a7851',height=1.05) {
  const f=localCraft(b,x,z,ry);
  for(const yy of [.28,height]) f.box(0,y+yy,0,length,.10,.13,color);
  const n=Math.ceil(length/1.4);
  for(let k=0;k<=n;k++) {
    const u=-length/2+k*length/n;
    f.box(u,y+height/2,0,.12,height+.14,.14,color);
    if(k%3===0) f.box(u,y+height+.13,0,.20,.08,.22,'#c2a16a');
  }
}

/** Rōmon gate: bracket clusters, an open upper balcony, recessed guardian bays and central plaque. */
export function addGateCraft(b:Batch,x:number,y:number,z:number,ry:number,w:number,d:number,top:number) {
  const f=localCraft(b,x,z,ry);
  for(const side of [-1,1]) {
    const v=side*(d/2+.08);
    for(const u of [-w*.38,-w*.25,w*.25,w*.38]) {
      f.box(u,y+top*.46,v,.22,top*.90,.20,'#ac4e37');
      addBracket(b,...f.point(u,y+top-.75,v),ry,1.0,'#8d3928');
    }
    f.box(0,y+top-.30,v,w*.94,.20,.25,'#a54330');
    f.box(0,y+top-2.35,v,w*.94,.16,.28,'#e2ca9c');
    // Dark, low-poly kugikakushi nail covers sit on the beam/post joints. They
    // articulate existing joinery rather than adding ornaments in the opening.
    for(const u of [-w*.38,-w*.25,w*.25,w*.38]){
      const at=f.point(u,y+top-2.35,v+side*.16);
      b.add(CYL8,'#4b4034',T(...at,ry,.105,.035,.105,Math.PI/2),false);
      b.add(CYL8,'#b19357',T(...f.point(u,y+top-2.35,v+side*.183),ry,.032,.016,.032,Math.PI/2),false);
    }
    // High gallery: deep shadow behind the open balustrade, pale plaster upper register.
    f.box(0,y+top-1.40,v-.04*side,w*.85,1.4,.06,'#79422f');
    for(let k=0;k<7;k++) f.box(-w*.37+k*w*.123,y+top-1.3,v+.06*side,.11,1.60,.11,'#d6ad77');
    addOpenRail(b,...f.point(0,y+top-2.15,v+side*.28),ry,w*.91,'#b54c34',.75);
  }
  // Front calligraphy plaque is deliberately blank: gold framed lacquer, no invented glyphs.
  f.box(0,y+top-1.10,d/2+.51,1.02,1.48,.16,'#433a31');
  f.box(0,y+top-.37,d/2+.62,1.08,.07,.12,'#b19357');
  f.box(0,y+top-1.83,d/2+.62,1.08,.07,.12,'#b19357');
  for(const side of [-1,1]) f.box(side*.51,y+top-1.1,d/2+.62,.06,1.49,.12,'#b19357');
  for(const side of [-1,1]) {
    const u=side*w*.37;
    f.box(u,y+2.5,d/2+.05,w*.17,3.1,.10,'#512f28');
    for(let k=0;k<5;k++) f.box(u-w*.067+k*w*.0335,y+2.5,d/2+.15,.08,3.05,.10,'#b96546');
    f.box(u,y+.57,d/2+.18,w*.19,.22,.32,'#d2c1a0');
  }
}

/** Alert stone fox silhouette: haunches, chest, pointed muzzle, ears, and an ascending tail. */
export function addKitsune(b:Batch,x:number,y:number,z:number,ry:number,scale=1) {
  const f=localCraft(b,x,z,ry), gray='#c3c4b0';
  const shape=(g:THREE.BufferGeometry,u:number,yy:number,v:number,sx:number,sy:number,sz:number,color=gray,rx=0)=>b.add(g,color,T(...f.point(u,y+yy*scale,v*scale),ry,sx*scale,sy*scale,sz*scale,rx),false);
  shape(STONE,0,.62,-.08,.44,.62,.55);
  shape(STONE,0,1.11,.15,.32,.73,.34);
  for(const side of [-1,1]) shape(CYL8,side*.18*scale,.55,.31,.10,.92,.12);
  shape(STONE,0,1.88,.22,.36,.42,.32);
  shape(CONE,0,1.83,.55,.19,.50,.19,gray,Math.PI/2);
  for(const side of [-1,1]) shape(CONE,side*.23*scale,2.27,.18,.16,.43,.12);
  shape(STONE,0,.82,-.60,.21,.73,.22,'#b2b6a4',-.6);
  f.box(0,y+1.34*scale,.46*scale,.61*scale,.35*scale,.07,'#b9543d');
  for(const side of [-1,1]) shape(STONE,side*.19*scale,1.98,.47,.045,.045,.025,'#5c5748');
}

/** Timber pagoda levels: plaster inset panels, bracket capitals, corner columns and gallery rails. */
export function addPagodaLevelCraft(b:Batch,x:number,y:number,z:number,s:number,h:number,vermilion=false) {
  const wood=vermilion?'#a7553d':'#70533b';
  for(let side=0;side<4;side++) {
    const ry=side*Math.PI/2,f=localCraft(b,x,z,ry),v=s/2+.035;
    for(const u of [-s*.36,0,s*.36]) {
      f.box(u,y+h*.45,v,.16,h*.90,.18,wood);
      addBracket(b,...f.point(u,y+h-.70,v),ry,.75,wood);
    }
    for(const u of [-s*.19,s*.19]) addLattice(b,...f.point(u,y+h*.48,v+.035),ry,s*.27,h*.40,wood,'#a89c7d',3);
    f.box(0,y+h-.22,v,s+.16,.17,.28,'#ad8857');
    addOpenRail(b,...f.point(0,y+.14,v+.28),ry,s+.5,wood,.72);
  }
}

/** Kiyomizu's open west-facing front and the theatrical interlocking stage understructure. */
export function addKiyomizuCraft(b:Batch,roof:Batch,heightAt:(x:number,z:number)=>number) {
  const x=298,z=50,y=34,wood='#8d6947';
  const f=localCraft(b,x,z,-Math.PI/2);
  // Main west facade, with deep shutters behind a colonnaded veranda.
  for(let k=0;k<6;k++) {
    const u=-7.5+k*3;
    addLattice(b,...f.point(u,y+3.30,12.07),-Math.PI/2,2.35,4.45,'#5d412f','#b4a488',5);
    f.box(u,y+3.4,13.25,.28,6.8,.28,wood);
    addBracket(b,...f.point(u,y+6.2,13.25),-Math.PI/2,1.25,wood);
  }
  f.box(0,y+.30,12.7,20,.3,2.3,wood);
  f.box(0,y+6.8,13.3,20.3,.25,.32,'#a27b50');
  for(const ry of [0,Math.PI/2,Math.PI]) {
    const wall=localCraft(b,x,z,ry),width=ry===Math.PI/2?18:24,depth=ry===Math.PI/2?24:18;
    for(let k=0;k<7;k++) {
      const u=-width*.44+k*width*.88/6;
      wall.box(u,y+3.40,depth/2+.045,.18,6.8,.14,'#8b6745');
      if(k<6) addLattice(b,...wall.point(u+width*.073,y+3.5,depth/2+.075),ry,width*.11,3.8,'#63472f','#8c8067',4);
      addBracket(b,...wall.point(u,y+6.22,depth/2+.20),ry,.85,'#896340');
    }
    for(const yy of [.55,1.0,5.6,6.7]) wall.box(0,y+yy,depth/2+.08,width,.12,.16,'#ad8553');
    // Overlapping lower weatherboards with a small shadow gap.
    for(let k=0;k<5;k++) wall.box(0,y+.18+k*.16,depth/2+.10,width,.13,.08,k%2?'#745338':'#806044');
  }
  // Irimoya upper gable gives the broad cypress skirt a distinctive silhouette.
  addKyotoRoof(roof,x,y+10.0,z,0,19,15.5,4.2,'#65513e','gable');
  for(const side of [-1,1]) {
    const xx=x+side*9.55;
    const panel = new THREE.Shape();
    panel.moveTo(-7.75,8.05);
    for(let k=0;k<=10;k++) {
      const zz=-7.75+k*1.55,t=Math.abs(zz)/7.75;
      panel.lineTo(zz,10+4.2*Math.pow(1-t,1.45)+.3*Math.pow(t,8));
    }
    panel.lineTo(7.75,8.05); panel.closePath();
    const infill = new THREE.ShapeGeometry(panel);
    b.add(infill,'#725136',T(xx,y,z,side*Math.PI/2),false);
    b.add(infill,'#725136',T(xx,y,z,-side*Math.PI/2),false);
    const roofEdge=(zz:number):[number,number,number]=>{ const t=Math.abs(zz)/7.75; return [xx,y+9.90+4.2*Math.pow(1-t,1.45)+.3*Math.pow(t,8),z+zz]; };
    for(let k=0;k<10;k++) addBeam(b,roofEdge(-7.75+k*1.55),roofEdge(-7.75+(k+1)*1.55),.16,.18,'#ba965f');
    b.add(BOX,'#8e6a47',T(xx,y+10.15,z,0,.14,.17,15.2),false);
    for(let k=-3;k<=3;k++) { const top=roofEdge(k*1.8)[1],bottom=y+8.3; b.add(BOX,'#a07b4b',T(xx,(top+bottom)/2,z+k*1.8,0,.16,top-bottom,.13),false); }
  }
  // Alternating deck boards and open rails replace the appearance of three solid parapet walls.
  for(let k=0;k<32;k++) b.add(BOX,k%3===0?'#9a7854':'#8d6949',T(255.35+k*.68,y+.012,64,0,.64,.025,13.8),false);
  addOpenRail(b,266,y,57.12,0,21.7,wood);
  addOpenRail(b,266,y,70.88,0,21.7,wood);
  addOpenRail(b,255.12,y,64,Math.PI/2,13.7,wood);
  // Long cross braces are the visual signature of the hillside stage, clear of walkable deck.
  for(const zz of [58.2,64.6,69.4]) {
    for(let k=0;k<5;k++) {
      const xa=256.2+k*3.4,xb=xa+3.4,ga=Math.max(heightAt(xa,zz),heightAt(xb,zz));
      if(ga>y-5) continue;
      const lo=Math.max(ga+1.1,y-12),hi=y-1.1;
      addBeam(b,[xa,lo,zz],[xb,hi,zz],.18,.23,'#85613e');
      addBeam(b,[xa,hi,zz],[xb,lo,zz],.18,.23,'#765133');
    }
  }
  // Cypress roof-edge beams and mortise blocks tie the stage to the hall.
  for(const zz of [58.2,61.4,64.6,67.8]) b.add(BOX,'#a07b50',T(266,y-.52,zz,0,23,.25,.28),false);
}

/** Gold leaf upper storeys with negative window bays, fine balcony rail and phoenix silhouette. */
export function addKinkakuCraft(b:Batch,gold:Batch,x:number,z:number) {
  const f1=2.4,f2=6.6,f3=10.6;
  for(let side=0;side<4;side++) {
    const ry=side*Math.PI/2,f=localCraft(b,x,z,ry),gf=localCraft(gold,x,z,ry);
    const width=side%2===0?13.4:10.4, depth=side%2===0?10.4:13.4;
    const v=depth/2+.055;
    for(let k=0;k<4;k++) {
      const u=-width*.34+k*width*.2267;
      addLattice(b,...f.point(u,f2+2.05,v),ry,width*.17,2.20,'#a88242','#383b32',3);
      gf.box(u,f2+3.29,v+.10,width*.20,.09,.10,'#cfad58');
    }
    gf.box(0,f2+.18,v+.45,width+1.9,.16,.95,'#c2a05a');
    addOpenRail(gold,...f.point(0,f2+.3,v+.85),ry,width+1.9,'#d8b55e',.72);
    for(const u of [-width*.4,0,width*.4]) {
      gf.beam([u,f2-.55,v-.05],[u,f2+.08,v+.72],.13,.14,'#a88844');
      gf.box(u,f2-.02,v+.37,.14,.16,.95,'#ae8b45');
    }
    // The third storey is a smaller Zen-style pavilion with arched-looking stepped window heads.
    const w3=side%2===0?9:7,v3=(side%2===0?7:9)/2+.055;
    for(const u of [-w3*.25,w3*.25]) {
      // Katōmado: cusped Zen window, with a genuine shaped dark opening and gold outline.
      const hw=w3*.145, sh=new THREE.Shape();
      sh.moveTo(-hw,-.95);sh.lineTo(hw,-.95);sh.lineTo(hw,.30);
      sh.bezierCurveTo(hw,.68,hw*.68,.74,hw*.48,.76);
      sh.quadraticCurveTo(hw*.20,.80,0,1.20);
      sh.quadraticCurveTo(-hw*.20,.80,-hw*.48,.76);
      sh.bezierCurveTo(-hw*.68,.74,-hw,.68,-hw,.30);sh.closePath();
      b.add(new THREE.ShapeGeometry(sh),'#353b32',T(...f.point(u,f3+1.6,v3+.065),ry),false);
      const outline=sh.getPoints(6);
      for(let j=0;j<outline.length-1;j++) gf.beam([u+outline[j].x,f3+1.6+outline[j].y,v3+.10],[u+outline[j+1].x,f3+1.6+outline[j+1].y,v3+.10],.085,.075,'#d2ae57');
      f.box(u,f3+1.57,v3+.11,.055,1.82,.07,'#a88e50');
    }
    gf.box(0,f3+.18,v3,w3+.18,.15,.15,'#ab853e');
    gf.box(0,f3+3.20,v3,w3+.18,.15,.15,'#e1bf64');
  }
  // Light timber first storey, with shoji screens inset behind the open veranda posts.
  for(let k=0;k<4;k++) addLattice(b,x-4.5+k*3,f1+1.9,z+3.55,0,2.4,2.9,'#6d583e','#c9c4a2',4);
  for(const side of [-1,1]) {
    for(let k=0;k<5;k++) {
      const zz=z-4.8+k*2.4;
      b.add(BOX,'#96774d',T(x+side*6.7,f1+1.9,zz,0,.16,3.8,.16),false);
      addBracket(b,x+side*6.7,f1+3.35,zz,side*Math.PI/2,.65,'#8c704b');
    }
    addOpenRail(b,x+side*7.15,f1+.2,z,Math.PI/2,10.8,'#96774d',.72);
  }
  // Phoenix: a small bird with raised swept wings, not a floating crystal.
  const yy=f3+6.92;
  gold.add(STONE,'#ddba60',T(x,yy,z,0,.28,.48,.38),false);
  gold.add(STONE,'#edcb73',T(x,yy+.48,z+.12,0,.18,.21,.19),false);
  gold.add(CONE,'#d2aa4a',T(x,yy+.47,z+.36,0,.07,.30,.07,Math.PI/2),false);
  for(const side of [-1,1]) {
    for(let k=0;k<4;k++) addBeam(gold,[x+side*.15,yy+.05,z],[x+side*(.65+k*.18),yy+.45+k*.18,z-.22-k*.10],.14,.07,'#e4bd59');
    addBeam(gold,[x,yy-.1,z-.1],[x+side*.35,yy-.40,z-.9],.13,.08,'#b9923d');
  }
}

/** Ruined machiya retain a coherent mass of rubble; the tested solid collision is not opened up. */
export function addBurntCraft(b:Batch,x:number,y:number,z:number,ry:number,w:number,d:number,h:number) {
  const f=localCraft(b,x,z,ry),hash=Math.abs(Math.round(x*7+z*13));
  for(const side of [-1,1]) {
    f.box(side*(w/2-.12),y+h*.51,d/2+.08,.16,h*.98,.18,'#151d1c');
    // Surviving lime plaster panels, chipped into stepped smaller rectangles.
    const u=side*w*.27;
    for(let k=0;k<3;k++) f.box(u+(k-1)*.15,y+1.7+k*.6,d/2+.07,w*(.18-k*.035),.42,.04,k%2?'#817a65':'#aaa18a');
  }
  f.box(0,y+h*.55,d/2+.08,w,.15,.16,'#171e1d');
  for(let k=0;k<4;k++) {
    const u=-w*.35+k*w*.23, hh=.5+((hash+k*7)%9)*.12;
    f.box(u,y+h+hh/2,-d*.34,.13,hh,.20,'#342d26');
  }
  // Ragged roof ribs and a fallen ridge establish a damaged silhouette, not a flat black cube.
  f.beam([-w*.43,y+h+.15,-d*.35],[w*.40,y+h+1.65,-d*.35],.16,.18,'#39332c');
  f.beam([-w*.43,y+h+.15,d*.35],[w*.25,y+h+.92,d*.20],.18,.21,'#282c27');
  f.beam([-w*.25,y+h+.12,-d*.30],[w*.28,y+h+.26,d*.38],.24,.23,'#74634b');
  for(let k=0;k<3;k++) f.box(-w*.30+k*w*.3,y+h+.025,-d*.15+(k%2)*d*.3,w*.22,.05,d*.25,'#5f5749');
}

/** Honnō-ji timber facade and broken ridge, a place of crisis rather than a recoloured pagoda. */
export function addHonnojiCraft(b:Batch,x:number,y:number,z:number,w:number,d:number) {
  const f=localCraft(b,x,z,Math.PI/2);
  for(let k=0;k<7;k++) {
    const u=-d/2+1+k*(d-2)/6;
    // Shadow bays on the east-facing hall, interrupted by charred but recognizable brackets.
    addLattice(b,...f.point(u,y+4.5,w/2+.07),Math.PI/2,3.2,4.8,'#44372a','#252d28',3);
    addBracket(b,...f.point(u,y+7.4,w/2+.40),Math.PI/2,1.1,'#4a3b2d');
  }
  f.box(0,y+1.2,w/2+.8,d+2,.3,2.0,'#665037');
  // Jagged structural frames protruding through the fire, built as skewed broken timbers.
  for(let k=0;k<5;k++) {
    const zz=z-d*.35+k*d*.175;
    addBeam(b,[x-w*.40,y+8.1,zz],[x+1.3,y+17.6-(k%3)*.9,zz],.28,.30,'#342b24');
    if(k%2===0) addBeam(b,[x+1.3,y+17.6,zz],[x+w*.37,y+10.1,zz+.6],.23,.26,'#493b2a');
  }
  addBeam(b,[x+.9,y+17.5,z-d*.4],[x+1.8,y+16.1,z+d*.35],.34,.40,'#403123');
}
