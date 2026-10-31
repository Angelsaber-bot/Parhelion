/** Geometry-only reproduction from captured actual-main stuck positions.
 * Does not mutate production actors or claim a playable encounter. */
import * as THREE from 'three';import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {CompanionNavigationCandidate} from './companion-navigation-candidate';
import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';import {CompanionNavigation} from '../fixtures/companion-navigation-pre-detour';
const candidate=process.argv.includes('--candidate');
const h=await bootWorldWithoutGpu({deterministic:true});
try{
 const j=JSON.parse(await readFile('../artifacts/companion-engagement/winter-diagnostic-wide-reposition.json','utf8')),s=j.samples.at(-1),from=new THREE.Vector3().fromArray(s.companion.position),enemy=s.enemies[0].p,target=new THREE.Vector3(enemy.x,enemy.y,enemy.z),probe=new CompanionNavigation(h.world.colliders),paths:any[]=[];
 for(const reach of [.05,.15,.3,.5,1,2,3,4])for(let i=0;i<32;i++){const angle=i*Math.PI/16,to=from.clone().add(new THREE.Vector3(Math.cos(angle)*reach,0,Math.sin(angle)*reach));paths.push({reach,angle,clear:probe.path(from,to),to:to.toArray(),floor:probe.floor(to.x,to.z,from.y)});}
 const root=new THREE.Group();root.position.copy(from);const nav=candidate?new CompanionNavigationCandidate(h.world.colliders):new CompanionNavigation(h.world.colliders),simulation=[],queries:any[]=[];let stepIndex=0;const originalPath=nav.path.bind(nav);nav.path=(a,b)=>{const clear=originalPath(a,b);if(stepIndex<30)queries.push({step:stepIndex,length:a.distanceTo(b),from:a.toArray(),to:b.toArray(),clear});return clear;};
 for(let i=0;i<1200;i++){stepIndex=i;nav.step(root,target,1/120,5.9949);if(i%12===0)simulation.push({time:i/120,position:root.position.toArray(),stuck:nav.stuckSeconds});}
 const clear=paths.filter(p=>p.clear),report={evidence:'Geometry-only captured stuck-root replay against actual production BVHs, not live input or encounter completion.',candidate,detour:candidate?(nav as CompanionNavigationCandidate).detourDiagnostics:null,from:from.toArray(),target:target.toArray(),queries,paths,clearCount:clear.length,clearByReach:Object.fromEntries([.05,.15,.3,.5,1,2,3,4].map(r=>[r,clear.filter(p=>p.reach===r).length])),simulation};
 await mkdir('../artifacts/companion-engagement',{recursive:true});await writeFile(`../artifacts/companion-engagement/winter-stuck-paths${candidate?'-candidate':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,queries:queries.length,paths:paths.length,simulation:simulation.at(-1)}));
}finally{await h.close();}
