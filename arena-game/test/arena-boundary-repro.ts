import { getMap } from '../shared/arenaMap.ts';
import { groundAt } from '../shared/map.ts';
import { applyInput, BTN, newPlayer } from '../shared/sim.ts';
for (const [id, x, z, yaw] of [['camlann', 28, 0, -Math.PI / 2], ['blackflag', -29, 12, Math.PI]] as const) {
  for (const mode of ['walk', 'jump-dash', 'crouch'] as const) {
    const m = getMap(id), p = newPlayer('repro', 'A', 1);
    Object.assign(p, { x, z, y: groundAt(m, x, z, 3), alive: true });
    let escaped = false, minY = p.y;
    for (let seq = 1; seq <= 600; seq++) {
      const buttons = mode === 'crouch' ? BTN.CROUCH : mode === 'jump-dash' ? ((seq % 70 === 1 ? BTN.JUMP : 0) | (seq % 211 === 1 ? BTN.DASH : 0)) : 0;
      applyInput(m, p, {seq, mx: 0, mz: 1, yaw, pitch: 0, buttons, weapon: 0, view: 0});
      escaped ||= p.x < m.data.bounds.min[0] || p.x > m.data.bounds.max[0] || p.z < m.data.bounds.min[2] || p.z > m.data.bounds.max[2];
      minY = Math.min(minY, p.y);
    }
    console.log(JSON.stringify({id, mode, escaped, minY, final: [p.x, p.y, p.z]}));
  }
}
