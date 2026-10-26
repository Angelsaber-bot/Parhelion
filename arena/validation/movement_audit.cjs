const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),m=require('../runtime/map.json'),P=require('../runtime/physics.js'),fixture=require('./baseline_ramp_fixture.json'),old=require('./baseline_physics_0_1_0.cjs');
const results=[];function check(name,pass,detail){results.push({name,passed:!!pass,detail});assert(pass,name+': '+JSON.stringify(detail));}
let before={x:-11.1,y:0,z:-9.1,vy:0};for(let i=0;i<120;i++)old.step(fixture,before,0,.035,1/120);
check('old solver reproduces screenshot immobilization',before.x===-11.1&&before.z===-9.1,before);
let after={x:-11.1,y:0,z:-9.1,vy:0};for(let i=0;i<120;i++)P.step(fixture,after,-.035,0,1/120);
check('fixed solver escapes the SAME old geometry',after.x< -14&&!P.blocked(fixture,after.x,after.z,after.y),after);
let edgeCases=0,invalidFrames=0;
for(const o of m.objects.filter(o=>o.type==='ramp'))for(const u of [.15,.35,.5,.65,.85])for(const sign of [-1,1]){
 const along=o.axis==='x'?'x':'z',perp=along==='x'?'z':'x',axis=along==='x'?0:2,other=axis===0?2:0;
 let s={x:o.position[0],y:0,z:o.position[2],vy:0};s[along]=o.position[axis]+(u-.5)*o.size[axis];s[perp]=o.position[other]+sign*(o.size[other]/2-.4);s.y=P.top(o,s.x,s.z);
 if(P.blocked(m,s.x,s.z,s.y))continue;
 const start={...s};
 for(let i=0;i<150;i++){P.step(m,s,perp==='x'?sign*.035:0,perp==='z'?sign*.035:0,1/120);if(P.blocked(m,s.x,s.z,s.y))invalidFrames++;}
 for(let i=0;i<120;i++){P.step(m,s,0,0,1/120);if(P.blocked(m,s.x,s.z,s.y))invalidFrames++;}
 check('ramp side fall/recovery '+o.id+' '+u+' '+sign,s.y>=-.001&&!P.blocked(m,s.x,s.z,s.y),{start,end:{...s}});edgeCases++;
 // Reverse and diagonal motion must remain legal even if the outward direction met a wall.
 for(let i=0;i<60;i++)P.step(m,s,perp==='x'?-sign*.025:.025,perp==='z'?-sign*.025:.025,1/120);
 check('ramp reverse diagonal remains valid '+o.id+' '+u+' '+sign,!P.blocked(m,s.x,s.z,s.y),s);
}
check('no invalid post-step ramp frames',invalidFrames===0,{edgeCases,invalidFrames});
let corners=0;
for(const o of m.objects.filter(o=>o.collision&&o.type==='box'&&!['floor'].includes(o.role))){
 for(const sx of [-1,1])for(const sz of [-1,1]){
  let s={x:o.position[0]+sx*(o.size[0]/2+.32),y:0,z:o.position[2]+sz*(o.size[2]/2+.32),vy:0};if(P.blocked(m,s.x,s.z,0)||Math.abs(s.x)>35.4||Math.abs(s.z)>27.4)continue;
  for(let i=0;i<40;i++){P.step(m,s,-sx*.025,-sz*.025,1/120);assert(!P.blocked(m,s.x,s.z,s.y),'Invalid corner entry '+o.id);}
  const contact={...s};for(let i=0;i<40;i++)P.step(m,s,sx*.025,sz*.025,1/120);
  check('corner reverse/diagonal '+o.id+' '+sx+' '+sz,Math.hypot(s.x-contact.x,s.z-contact.z)>.4&&!P.blocked(m,s.x,s.z,s.y),{contact,end:{...s}});corners++;
 }
}
// Coverage is independent of authored route waypoints. Four-neighbour raster over floor,
// all three ramps and gallery. Cover tops are excluded from ordinary walk supports.
const spacing=.5,nx=143,nz=111,nodes=new Map(),supports=m.objects.filter(o=>o.role==='floor'||o.type==='ramp');
for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
 const x=-35.5+ix*spacing,z=-27.5+iz*spacing;let y=0;
 for(const o of supports)if(Math.abs(x-o.position[0])<=o.size[0]/2&&Math.abs(z-o.position[2])<=o.size[2]/2)y=Math.max(y,P.top(o,x,z));
 if(!P.blocked(m,x,z,y))nodes.set(ix+','+iz,{ix,iz,x,y,z});
}
let components=[];const seen=new Set();for(const [key,node] of nodes){if(seen.has(key))continue;let queue=[node],head=0;seen.add(key);
 while(head<queue.length){const a=queue[head++];for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){const k=(a.ix+dx)+','+(a.iz+dz),b=nodes.get(k);if(!b||seen.has(k)||Math.abs(b.y-a.y)>.28)continue;const midY=(a.y+b.y)/2;if(P.blocked(m,(a.x+b.x)/2,(a.z+b.z)/2,midY))continue;seen.add(k);queue.push(b);}}
 components.push(queue.length);
}
check('entire sampled walkable floor/ramp/deck graph connected',components.length===1,{spacing,nodes:nodes.size,components});
const widths={before:{bounds:[48,36],area:1728,rampSideSlot:.975,spawnTurn:3.2,courtEntry:4,labFront:2.175,labRear:3.25,reactorCoverBypass:2.6,sideRampWidth:5.6,centralRampWidth:4},after:{bounds:[72,56],area:4032,rampSideSlot:4.775,spawnTurn:5.2,courtEntry:6,labFront:4.275,labRear:7.25,reactorCoverBypass:5.2,sideRampWidth:8,centralRampWidth:6},playerUnchanged:m.player};
const ob=id=>m.objects.find(o=>o.id===id),edge=(o,axis,sign)=>o.position[axis]+sign*o.size[axis]/2;
const measured={rampSideSlot:edge(ob('court_wall_-15.5_-9'),2,-1)-edge(ob('ramp_gallery_west'),2,1),spawnTurn:Math.abs(ob('west_pocket_-1').position[0])-ob('west_pocket_-1').size[0]/2-(Math.abs(ob('west_spawn_screen').position[0])+ob('west_spawn_screen').size[0]/2),courtEntry:edge(ob('north_court_wing_-5'),0,-1)-edge(ob('court_wall_-15.5_-9'),0,1),labFront:edge(ob('lab_pod_0'),2,-1)-edge(ob('south_court_screen'),2,1),labRear:edge(ob('wall_south'),2,-1)-edge(ob('lab_pod_10'),2,1),reactorCoverBypass:edge(ob('court_cover_9_4'),0,-1)-edge(ob('reactor_plinth'),0,1),sideRampWidth:ob('ramp_gallery_west').size[2],centralRampWidth:ob('ramp_gallery_central').size[0]};
for(const [k,value] of Object.entries(measured))check('measured clearance '+k,Math.abs(value-widths.after[k])<1e-6,{metres:value,centreTravelWidth:value-m.player.radius*2});
const report={mapId:m.mapId,version:m.version,checks:results.length,edgeCases,cornerCases:corners,grid:{spacing,nodes:nodes.size,components},widths,results,limitations:['0.5 m raster connectivity and finite movement samples are broader coverage, not proof of every continuous state.','Box/ramp cylinder-footprint solver remains a local inspection prototype.']};
fs.writeFileSync(path.join(root,'validation/movement_audit_report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:results.length,edgeCases,corners,grid:report.grid,widths}));
