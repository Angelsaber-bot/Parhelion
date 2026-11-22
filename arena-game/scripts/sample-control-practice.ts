// Random short camera trajectories in ordinary Arena geometry. Keep actions which
// subsequently acquired a target or landed a shot. Never compute a desired aim angle.
import { writeFileSync } from 'node:fs';
import { getMap } from '../shared/arenaMap.ts';
import { navFor } from '../shared/botLocomotion.ts';
import { SMOKE, WEAPONS } from '../shared/content.ts';
import { settleSmoke } from '../shared/grenade.ts';
import { addSmokeDepths, explorationScene, EXPLORATION_TICKS, visibleSmokeDepths } from '../shared/exploration.ts';
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
const withHistory = process.argv.includes('--with-history');
const rows: number[][] = [];
for (const name of ['aster','blackflag','sakura','homeward']) {
  const map = getMap(name), nav = navFor({map}), game = new Match(map,'1v1');
  game.addPlayer('a',{team:'A',name:'a',bot:true,skins:[],char:2});
  const me = game.player('a')!;
  for (let trial=0; trial<trials; trial++) {
    game.smokes.length = 0;
    const a = nav.nodes[Math.floor(draw()*nav.nodes.length)], bearing = draw()*2*Math.PI;
    // Sample short, medium and long sightlines; actual map visibility decides which are usable.
    const band = trial % 3;
    const r = band === 0 ? 2.2 + 15 * draw() : band === 1 ? 17 + 18 * draw() : 35 + 50 * draw();
    const b = nav.nearest(a.x+Math.cos(bearing)*r,a.y,a.z+Math.sin(bearing)*r);
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
    const lane = Math.atan2(a.x-b.x,a.z-b.z), level = Math.atan2(b.y-a.y,Math.hypot(a.x-b.x,a.z-b.z));
    const nearCenter = draw()<.35;
    const spread = trial % 3 === 2 && nearCenter ? .025 : .13;
    me.yaw = lane + signed() * (nearCenter ? spread : draw()<.6 ? .95 : Math.PI);
    me.pitch = Math.max(-1.45,Math.min(1.45,level+signed()*(nearCenter ? spread : draw()<.5 ? .32 : 1.4)));
    const see = (turn: [number, number] = [0, 0]) => humanObservation(map, me, [target],
      (from, to) => game.heroes.visible(from, to), turn, undefined, undefined,
      (from, to) => game.heroes.visible(from, to, true));
    const yaw = me.yaw, pitch = me.pitch;
    // Sample the preceding pose before any future action proposals. Every
    // alternative at this pose must receive the same observation and memory.
    const previousYaw = yaw - .9 * signed();
    const previousPitch = Math.max(-1.45, Math.min(1.45, pitch - .55 * signed()));
    me.yaw = previousYaw;
    me.pitch = previousPitch;
    const previous = see();
    const history: number[] = [];
    if (withHistory) {
      const pastScene = explorationScene(map, me, previous[0] ? [previousYaw + previous[1], 0] : undefined);
      addSmokeDepths(pastScene, visibleSmokeDepths(map, me, game.smokes, game.shields));
      history.push(...previous, ...pastScene);
    }
    me.yaw = yaw;
    me.pitch = pitch;
    const obs = see([(yaw - previousYaw) / EXPLORATION_TICKS, (pitch - previousPitch) / EXPLORATION_TICKS]);
    const scene = explorationScene(map, me, withHistory && obs[0] ? [yaw + obs[1], 0] : previous[0] ? [previousYaw + previous[1], EXPLORATION_TICKS] : undefined);
    addSmokeDepths(scene, visibleSmokeDepths(map, me, game.smokes, game.shields));
    const direction = aimDir(me.yaw,me.pitch);
    const hit = rayPlayer(eye,direction,b.x,b.y,b.z,target.crouched);
    // Match.resolveFire tests projectiles against solid geometry. Smoke limits
    // what the model observes, but it is not a bullet collider.
    const lands = (h: ReturnType<typeof rayPlayer>, d: Vec3) =>
      h !== null && h.t <= WEAPONS[me.weapon].range && h.t < raycastMap(map, eye, d, h.t + .001);
    // Log both outcomes of probe shots, including misses. The weapon decision is
    // fit to the observed utility of spending ammunition at this camera pose.
    rows.push([0, ...history, ...obs, ...scene, Number(!!lands(hit,direction)),0]);
    for (let probe=0;probe<(obs[0] ? 48 : 8);probe++) {
      const scale = obs[0] && probe % 2 === 0 ? .06 : 1;
      const mx=scale*signed(), my=scale*signed(), horizon=obs[0] ? 1 : 1+Math.floor(draw()*5);
      me.yaw = yaw+.9*mx*horizon;
      me.pitch = Math.max(-1.45,Math.min(1.45,pitch+.55*my*horizon));
      const ray = aimDir(me.yaw,me.pitch);
      const success = obs[0] ? lands(rayPlayer(eye,ray,...feet,target.crouched),ray) : see()[0] === 1;
      if (success) rows.push([obs[0] ? 1 : 2, ...history, ...obs, ...scene, mx, my]);
    }
  }
}
writeFileSync(output, JSON.stringify(rows));
console.log(rows.reduce((counts,r)=>(counts[r[0]]++,counts),[0,0,0]), 'shot outcomes, hits after camera actions, recovered contacts');
