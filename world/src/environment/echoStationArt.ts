import * as THREE from 'three';
import type { WorldRegionId } from '../core/regionIdentity';
import { SiteArt } from '../story/campaignSites';
import { ECHO_DESTINATIONS } from '../story/echoDestinations';

/** Tiny architectural models sit on a waist-high survey table. The bronze meridian
 * behind each model is the recurring Echo Hall sign, readable above the road. */
export function buildEchoStationArt(region: Exclude<WorldRegionId, 'home'>) {
  const art = new SiteArt();
  const { stone, trim } = ECHO_DESTINATIONS[region];
  const brass = '#b59868', slate = '#354c53', light = '#e6daba';
  art.cyl([0, .08, 0], 1.26, .40, stone, true);
  art.cyl([0, .59, 0], .74, .68, stone, true);
  art.cyl([0, .95, 0], 1.13, .16, trim, true);
  art.cyl([0, 1.055, 0], 1.08, .06, slate);
  for (const x of [-.86,.86]) art.beam([x*.78, .79, -.28], [x, 2.0, -.28], .065, brass);
  art.ring([0, 2.0, -.28], .86, .055, brass);
  art.ring([0, 2.0, -.28], .78, .022, '#b6d9cd', 'glow');
  for (let i = 0; i < 12; i++) {
    const angle = Math.PI*i/6;
    art.box([.86*Math.sin(angle),2+.86*Math.cos(angle),-.28],[.05,i%3===0?.20:.1,.10],brass,false,'metal',[0,0,-angle]);
  }
  // Coordinates below use the tabletop as their datum.
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,c:string,roll=0) =>
    art.box([x,1.09+y,z],[w,h,d],c,false,'body',[0,0,roll]);
  const tower = (x:number,z:number,r:number,h:number,c:string) => art.cyl([x,1.09+h/2,z],r,h,c);
  if (region === 'alpha') {
    box(0,.13,.05,1.25,.26,.60,light);
    tower(-.32,.02,.23,.52,stone);
    art.ring([-.32,1.79,.02],.24,.04,trim,'metal',[-.48,0,0]);
    art.beam([-.32,1.61,.02],[-.15,1.97,-.04],.042,brass);
    for (const x of [.24,.42,.60]) box(x,.33,.05,.13,.17,.46,trim);
  } else if (region === 'britain') {
    for (const x of [-.53,.46]) {
      tower(x,0,.23,x<0?.61:.4,stone);
      for(const dx of [-.13,.13]) box(x+dx,x<0?.66:.45,0,.12,.12,.27,light);
    }
    box(-.1,.13,.02,.64,.26,.20,stone);
    art.beam([-.14,1.17,.25],[.02,1.88,.25],.06,light);
    box(-.02,.62,.25,.29,.055,.08,brass,.22);
  } else if (region === 'blacksail') {
    box(0,.13,.05,1.26,.19,.33,stone);
    for(const side of [-1,1]) box(side*.64,.18,.05,.23,.14,.26,stone,side*.28);
    for(const x of [-.32,.26]) {
      const h=x<0?.76:.60;
      tower(x,.04,.03,h,brass);
      box(x+.13,h-.14,.05,.29,.24,.05,'#43474d',-.08);
      art.beam([x,1.09+h,.05],[x-.29,1.29,.05],.018,light);
    }
  } else if (region === 'winter') {
    for(const x of [-.60,-.20,.20,.60]) box(x,.21,0,.10,.42,.32,stone);
    box(0,.46,0,1.4,.10,.4,light);
    for(const x of [-.48,.48]) {
      box(x,.55,0,.32,.16,.33,trim);
      box(x,.67,0,.35,.10,.38,'#eff1e6');
    }
  } else if (region === 'kyoto') {
    for(const x of [-.43,.43]) { tower(x,.08,.068,.68,trim); tower(x,.08,.092,.13,slate); }
    box(0,.49,.08,1.16,.07,.12,trim);
    box(0,.72,.08,1.28,.1,.19,trim);
    box(0,.79,.08,1.17,.06,.20,slate);
    for(const s of [-1,1]) box(s*.63,.81,.08,.18,.06,.20,slate,s*.18);
  } else if (region === 'egypt') {
    for(const s of [-1,1]) {
      box(s*.39,.22,-.12,.43,.44,.34,stone);
      box(s*.39,.46,-.12,.48,.07,.38,light);
      const tip = new THREE.ConeGeometry(.10,.30,4);
      art.add(tip,brass,[s*.63,1.61,.27]); tip.dispose();
      box(s*.63,.19,.27,.14,.38,.14,stone);
    }
    box(0,.33,-.12,.37,.10,.20,trim);
  } else if (region === 'qin') {
    for(const x of [-.56,.56]) {
      box(x,.25,-.10,.25,.50,.32,stone);
      box(x,.53,-.10,.36,.07,.43,slate);
      box(x,.62,-.10,.19,.12,.20,trim);
      box(x,.70,-.10,.30,.065,.31,slate);
    }
    for(const x of [-.21,0,.21]) for(const z of [.02,.24,.46]) { tower(x,z,.052,.16,'#b88c68'); tower(x,z,.037,.22,'#a27756'); }
  } else {
    for(const x of [-.54,0,.54]) box(x,.14,0,.15,.28,.32,stone);
    box(0,.31,0,1.36,.09,.42,light);
    for(const x of [-.50,.50]) {
      box(x,.50,-.04,.22,.30,.25,stone);
      const roof=new THREE.ConeGeometry(.21,.24,4);
      art.add(roof,trim,[x,1.86,-.04],[1,1,1],false,'body',[0,Math.PI/4,0]); roof.dispose();
    }
  }
  art.finish(region);
  art.root.name = `EchoStation_${region}`;
  return art;
}
