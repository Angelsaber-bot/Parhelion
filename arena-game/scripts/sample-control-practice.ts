// Random short camera trajectories in ordinary Arena geometry. Keep actions which
// subsequently acquired a target or landed a shot. Never compute a desired aim angle.
import { writeFileSync } from 'node:fs';
import { getMap } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { SMOKE } from '../shared/content.ts';
import { settleSmoke } from '../shared/grenade.ts';
import { addSmokeDepths, explorationScene, visibleSmokeDepths } from '../shared/exploration.ts';
import { rayPlayer } from '../shared/hit.ts';
import { humanObservation } from '../shared/humanCombat.ts';
import { Match } from '../shared/match.ts';
import { aimDir, playerEye } from '../shared/sim.ts';
import { raycastMap, type Vec3 } from '../shared/map.ts';

const output = process.argv[2];
if (!output) throw Error('Supply an output path');
let state = Number(process.argv[3] ?? 1321) >>> 0;
const draw = () => ((state = (Math.imul(state,1664525)+1013904223) >>> 0) + .5) / 2**32;
const signed = () => draw()*2-1;
const trials = Number(process.argv[4] ?? 22000);
if (!Number.isInteger(trials) || trials < 1 || trials > 100000) throw Error('Invalid practice trial count');
const rows: number[][] = [];
for (const name of ['aster','blackflag','sakura','homeward']) {
  const map = getMap(name), nav = navFor({map}), game = new Match(map,'1v1');
  game.addPlayer('a',{team:'A',name:'a',bot:true,skins:[],char:2});
  const me = game.player('a')!;
  for (let trial=0; trial<trials; trial++) {
    game.smokes.length = 0;
    const a = nav.nodes[Math.floor(draw()*nav.nodes.length)], bearing = draw()*2*Math.PI;
    const r = 2.2+21*draw(), b = nav.nearest(a.x+Math.cos(bearing)*r,a.y,a.z+Math.sin(bearing)*r);
    if (!b || Math.hypot(a.x-b.x,a.z-b.z)<2) continue;
    Object.assign(me,{x:a.x,y:a.y,z:a.z,grounded:true,crouched:draw()<.18});
    const eye:Vec3 = [me.x,me.y+playerEye(map,me),me.z], feet:Vec3 = [b.x,b.y,b.z];
    const target = {team:'B' as const,crouched:draw()<.22,feet};
    if (!game.heroes.visible(eye,[b.x,b.y+1,b.z])) continue;
    if (draw() < .40) {
      const angle = draw() * Math.PI * 2, offset = (.7 + .65 * draw()) * SMOKE.radius;
      const depth = draw() < .6 ? 1 : draw();
      const node = nav.nearest(a.x + (b.x-a.x)*depth + Math.sin(angle)*offset, a.y,
        a.z + (b.z-a.z)*depth + Math.cos(angle)*offset);
      if (node) game.smokes.push(settleSmoke(map, { id: trial, owner: 'b', x: node.x, y: node.y, z: node.z,
        life: Math.floor(40 + draw() * (SMOKE.life - 40)) }));
    }
    // Condition the starting difficulty, independently of all action proposals.
    const lane = Math.atan2(a.x-b.x,a.z-b.z), level = Math.atan2(b.y-a.y,r);
    const nearCenter = draw()<.35;
    me.yaw = lane + signed() * (nearCenter ? .13 : draw()<.6 ? .95 : Math.PI);
    me.pitch = Math.max(-1.45,Math.min(1.45,level+signed()*(nearCenter ? .12 : draw()<.5 ? .32 : 1.4)));
    const see = () => humanObservation(map,me,[target],(o,t)=>game.heroes.visible(o,t),[0,0], undefined, undefined, (o,t)=>game.heroes.visible(o,t,true));
    const obs = see(), scene = explorationScene(map,me);
    addSmokeDepths(scene, visibleSmokeDepths(map, me, game.smokes, game.shields));
    const direction = aimDir(me.yaw,me.pitch);
    const hit = rayPlayer(eye,direction,b.x,b.y,b.z,target.crouched);
    // Match.resolveFire tests projectiles against solid geometry. Smoke limits
    // what the model observes, but it is not a bullet collider.
    const lands = (h: ReturnType<typeof rayPlayer>, d: Vec3) =>
      h !== null && h.t < raycastMap(map, eye, d, h.t + .001);
    // Log both outcomes of probe shots, including misses. The weapon decision is
    // fit to the observed utility of spending ammunition at this camera pose.
    rows.push([0, ...obs,...scene, Number(!!lands(hit,direction)),0]);
    const yaw = me.yaw, pitch = me.pitch;
    for (let probe=0;probe<(obs[0] ? 48 : 8);probe++) {
      const mx=signed(), my=signed(), horizon=obs[0] ? 1 : 1+Math.floor(draw()*5);
      me.yaw = yaw+.9*mx*horizon;
      me.pitch = Math.max(-1.45,Math.min(1.45,pitch+.55*my*horizon));
      const ray = aimDir(me.yaw,me.pitch);
      const success = obs[0] ? lands(rayPlayer(eye,ray,...feet,target.crouched),ray) : see()[0] === 1;
      if (!success) continue;
      if (obs[0]) {
        rows.push([1,...obs,...scene,mx,my]);
        continue;
      }
      // Recreate an earlier glance and an actual preceding turn for a subset of
      // search trials. Only a confirmed sighting can populate bearing memory.
      me.yaw = yaw - .9 * mx;
      me.pitch = Math.max(-1.45, Math.min(1.45, pitch - .55 * my));
      const previous = see(), previousYaw = me.yaw;
      me.yaw = yaw;
      me.pitch = pitch;
      const searchObs = [...obs];
      if (draw() < .7) {
        searchObs[16] = .9 * mx / (12 * .4);
        searchObs[17] = (pitch - Math.max(-1.45, Math.min(1.45, pitch - .55 * my))) / (12 * .4);
      }
      const lastBearing = previousYaw + previous[1];
      const searchScene = previous[0]
        ? explorationScene(map, me, [lastBearing, 12])
        : scene;
      if (previous[0]) addSmokeDepths(searchScene, visibleSmokeDepths(map, me, game.smokes, game.shields));
      rows.push([2,...searchObs,...searchScene,mx,my]);
    }
  }
}
writeFileSync(output, JSON.stringify(rows));
console.log(rows.reduce((counts,r)=>(counts[r[0]]++,counts),[0,0,0]), 'shot outcomes, hits after camera actions, recovered contacts');
