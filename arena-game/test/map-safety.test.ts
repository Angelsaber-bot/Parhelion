// Design safeguards independent of the authored route list: a new shortcut must not create
// a one-way navigation trap, and a neutral perch must not watch every respawn alternative.
import {describe,expect,it} from 'vitest';
import {MAPS,getMap} from '../shared/arenaMap.ts';
import {NavGrid} from '../shared/nav.ts';
import {groundAt,lineOfSight,type Vec3} from '../shared/map.ts';
import {applyInput,newPlayer,type Input} from '../shared/sim.ts';

function flood(links:number[][],starts:number[]):Set<number>{
  const seen=new Set(starts),queue=starts.slice();
  for(let i=0;i<queue.length;i++)for(const id of links[queue[i]])if(!seen.has(id)){seen.add(id);queue.push(id);}
  return seen;
}
for(const info of MAPS)describe(`${info.id} respawn circulation`,()=>{
  const map=getMap(info.id),nav=new NavGrid(map);
  const spawns=map.data.anchors.filter(a=>a.kind==='spawn');
  const starts=spawns.map(s=>nav.nearest(...s.position)!.id);
  const links=nav.nodes.map(n=>n.links),reachable=flood(links,starts);
  it('every reachable navigation surface has a walking/drop route back to circulation',()=>{
    const reverse=nav.nodes.map(()=>[] as number[]);
    for(const n of nav.nodes)for(const id of n.links)reverse[id].push(n.id);
    const returns=flood(reverse,starts);
    const trapped=[...reachable].filter(id=>!returns.has(id)).map(id=>{const n=nav.nodes[id];return [n.x,n.y,n.z];});
    expect(trapped).toEqual([]);
  });
  it('no distant perch in the central half watches all of either team’s spawn alternatives',()=>{
    for(const team of ['west','east'])expect(spawns.filter(s=>s.team===team).length,`${team} must have genuine respawn alternatives`).toBeGreaterThanOrEqual(2);
    const midpoint=(map.data.bounds.min[0]+map.data.bounds.max[0])/2;
    const halfSpan=(map.data.bounds.max[0]-map.data.bounds.min[0])/4;
    const unsafe:{from:Vec3;team:string}[]=[];
    for(const id of reachable){
      const n=nav.nodes[id];
      if(Math.abs(n.x-midpoint)>=halfSpan)continue;
      for(const team of ['west','east']){
        const targets=spawns.filter(s=>s.team===team);
        if(targets.some(s=>Math.hypot(n.x-s.position[0],n.z-s.position[2])<12))continue;
        // A standing jump has a 1.07m apex (6.2 m/s impulse, 18 m/s² gravity).
        for(const lift of [0,1.07]){
          const from:Vec3=[n.x,n.y+map.eye+lift,n.z];
          if(targets.every(s=>lineOfSight(map,from,[s.position[0],s.position[1]+map.eye,s.position[2]]))){unsafe.push({from,team});break;}
        }
      }
    }
    expect(unsafe.slice(0,12)).toEqual([]);
  });
});

// The new ASTER windbreaks must shelter the pocket without turning it into a
// narrow nav-only slit: traverse both exits using the actual capsule solver.
for(const side of [-1,1])for(const exit of [-1,1])it(`ASTER ${side<0?'west':'east'} ${exit<0?'north':'south'} exit fits the moving player both ways`,()=>{
  const map=getMap('aster');
  const route:Vec3[]=[[side*32,0,exit*1.5],[side*32,0,exit*6.1],[side*28,0,exit*6.1],[side*28,0,exit*10],[side*21,0,exit*10]];
  for(const points of [route,[...route].reverse()]){
    const p=newPlayer('clearance','A',2);Object.assign(p,{x:points[0][0],y:points[0][1],z:points[0][2],alive:true});
    let waypoint=1;
    for(let tick=1;tick<=1200&&waypoint<points.length;tick++){
      const target=points[waypoint],dx=target[0]-p.x,dz=target[2]-p.z;
      if(Math.hypot(dx,dz)<.22){waypoint++;continue;}
      const input:Input={seq:tick,mx:0,mz:1,yaw:Math.atan2(-dx,-dz),pitch:0,buttons:0,weapon:0,view:0};applyInput(map,p,input);
    }
    expect(waypoint,`stuck at ${p.x},${p.y},${p.z}`).toBe(points.length);
    expect(p.y).toBeCloseTo(0);
  }
});

it('FROSTCOURT arcade and back terraces cannot shoot into either spawn pocket, even at jump apex',()=>{
  const map=getMap('frostcourt'),spawns=map.data.anchors.filter(a=>a.kind==='spawn');
  // These reachable positions exposed the near or far pocket before the staggered
  // wings and middle divider were added; include the most central arcade angle.
  const west:Vec3[]=[[-23.25,2.4,18.25],[-23.25,2.4,22.25],[-16.25,2.4,22.75],[-8.75,1.3,-20.25],[-14.75,1.3,-20.75],[-16.25,1.3,-21.25]];
  for(const side of [-1,1])for(const [x,y,z] of west){
    const px=x*side;
    expect(groundAt(map,px,z,y+.05),`sample ${px},${y},${z} must be on the authored terrace`).toBeCloseTo(y);
    for(const lift of [0,1.07])for(const spawn of spawns){
      const from:Vec3=[px,y+map.eye+lift,z],to:Vec3=[spawn.position[0],spawn.position[1]+map.eye,spawn.position[2]];
      expect(lineOfSight(map,from,to),`${from} -> ${spawn.id}`).toBe(false);
    }
  }
});

it('HOMEWARD service cover interrupts the formerly uninterrupted north/south cross-map streets',()=>{
  const map=getMap('homeward');
  for(const [a,b] of [
    [[28.75,1.62,7.75],[-29,1.62,7.75]],
    [[-28.25,1.62,-15.25],[29,1.62,-15.25]],
  ] as [Vec3,Vec3][])expect(lineOfSight(map,a,b),`${a} -> ${b}`).toBe(false);
});
