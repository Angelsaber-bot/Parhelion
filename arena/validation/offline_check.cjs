const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),m=require('../runtime/map.json'),P=require('../runtime/physics.js');
const checks=[],check=(name,condition,details)=>{checks.push({name,passed:!!condition,details});assert(condition,name+': '+JSON.stringify(details));};
check('identity and metre scale',m.mapId==='aster_research_station'&&m.units==='metres'&&m.mode==='arena',m.version);
check('unique object and anchor IDs',new Set([...m.objects,...m.anchors].map(o=>o.id)).size===m.objects.length+m.anchors.length);
const sp=m.anchors.filter(a=>a.kind==='spawn');
for(const a of m.anchors){if(!['spawn','cover','objective'].includes(a.kind))continue;
 check('clear anchor '+a.id,!P.blocked(m,a.position[0],a.position[2],a.position[1]),a.position);
 check('supported anchor '+a.id,Math.abs(P.ground(m,a.position[0],a.position[2],a.position[1])-a.position[1])<.02,a.position);
}
let spawnPairs=[];
for(const a of sp)for(const b of sp){if(a.team===b.team)continue;const visible=P.lineOfSight(m,[a.position[0],1.65,a.position[2]],[b.position[0],1.65,b.position[2]]);spawnPairs.push({from:a.id,to:b.id,visible});}
check('opposing spawn sightlines blocked',spawnPairs.every(r=>!r.visible),spawnPairs);
for(const team of ['west','east']){const a=sp.filter(a=>a.team===team);const d=Math.hypot(a[0].position[0]-a[1].position[0],a[0].position[2]-a[1].position[2]);check('two non-overlapping spawns '+team,d>m.player.radius*2,{distance:d});}
let highSamples=0,visibleSpawnRays=0;
for(let x=-11.5;x<=11.5;x+=.25)for(let z=-21.5;z<=-14.5;z+=.25){if(P.blocked(m,x,z,3))continue;highSamples++;
 for(const a of sp)if(P.lineOfSight(m,[x,4.65,z],[a.position[0],1.65,a.position[2]]))visibleSpawnRays++;
}
check('sampled gallery cannot see spawn anchors',visibleSpawnRays===0,{highSamples,rayCount:highSamples*sp.length,visibleSpawnRays,spacing:.25,eyeHeight:1.65});
let routes=[];
for(const r of m.routes)for(const reverse of [false,true]){
 const pts=reverse?[...r.points].reverse():r.points,s={x:pts[0][0],y:pts[0][1],z:pts[0][2],vy:0};let stuck=false,minY=s.y,maxY=s.y,steps=0,distance=0;
 for(const t of pts.slice(1)){let n=0;while(Math.hypot(s.x-t[0],s.z-t[2])>.07&&n++<1600){const d=Math.hypot(t[0]-s.x,t[2]-s.z);const before=[s.x,s.y,s.z];P.step(m,s,(t[0]-s.x)/d*.035,(t[2]-s.z)/d*.035,1/120);distance+=Math.hypot(s.x-before[0],s.y-before[1],s.z-before[2]);steps++;minY=Math.min(minY,s.y);maxY=Math.max(maxY,s.y);}if(n>=1600){stuck=true;break;}}
 const last=pts[pts.length-1],endError=Math.hypot(s.x-last[0],s.z-last[2]),heightError=Math.abs(s.y-last[1]);
 const result={id:r.id,reverse,steps,distance:+distance.toFixed(2),walkSeconds:+(distance/m.player.walkSpeed).toFixed(2),minY,maxY,endError,heightError,stuck};routes.push(result);
 check('continuous route '+r.id+(reverse?' reverse':''),!stuck&&endError<.071&&heightError<.02&&minY>=-.001,result);
}
// Long movement requests are subdivided by the shared physics to prevent tunnelling.
let wall={x:-32,y:0,z:0,vy:0};P.step(m,wall,12,0,.05);check('spawn screen stops long movement',wall.x< -26.6&&wall.x> -26.8,wall);
let outer={x:34,y:0,z:11,vy:0};P.step(m,outer,10,0,.05);check('outer boundary stops movement',outer.x<35.45,outer);
let floor={x:9,y:3,z:0,vy:0};for(let i=0;i<360;i++)P.step(m,floor,0,0,1/120);check('gravity lands on station floor',Math.abs(floor.y)<.001,floor);
// Deck edge landing is intentionally permitted; this does not implement jumping/dash.
let drop={x:4,y:3,z:-14.1,vy:0};for(let i=0;i<240;i++)P.step(m,drop,0,.04,1/120);check('gallery descent does not fall through',drop.y>=0&&!P.blocked(m,drop.x,drop.z,drop.y),drop);
const report={mapId:m.mapId,version:m.version,player:m.player,objectCount:m.objects.length,collisionCount:m.objects.filter(o=>o.collision).length,anchorCount:m.anchors.length,checks,routes,limitations:['Static geometry tests; no live enemies, occupancy-aware respawn selection or match balance test.','LOS uses solid box occluders; ramps are omitted, making visible-ray counts conservative.']};
fs.writeFileSync(path.join(root,'validation/offline_report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:checks.length,routes:routes.length,highSamples,visibleSpawnRays}));
