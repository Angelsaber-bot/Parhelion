import * as THREE from 'three';
import type { WorldRegionId } from '../core/regionIdentity';
import { SiteArt } from '../story/campaignSites';
import { ECHO_DESTINATIONS } from '../story/echoDestinations';

/** The lantern marks shelter. The bronze ring and tapered arm point towards the local Echo station (+Z). */
export function buildEchoWaypost(region: WorldRegionId) {
  const art = new SiteArt();
  const { stone, trim } = ECHO_DESTINATIONS[region];
  const bronze = '#b29260';
  art.cyl([0,.18,0],.43,.46,stone,true);
  art.cyl([0,.43,0],.32,.12,trim);
  art.box([0,1.37,0],[.21,1.88,.21],stone,true);
  for (const y of [.66,1.8,2.27]) art.box([0,y,0],[.27,.08,.27],bronze,false,'metal');
  art.box([0,2.24,.42],[.18,.13,1.38],trim);
  art.beam([0,1.81,0],[0,2.21,.59],.055,bronze);
  const tip = new THREE.ConeGeometry(.22,.48,4);
  art.add(tip,bronze,[0,2.24,1.25],[1,1,1],false,'metal',[Math.PI/2,Math.PI/4,0]);
  tip.dispose();
  art.ring([0,2.53,.24],.28,.047,bronze,'metal',[0,Math.PI/2,0]);
  art.lantern(0,1.82,.79,stone);
  art.finish(region);
  art.root.name = 'EchoWaypost_'+region;
  return art;
}
