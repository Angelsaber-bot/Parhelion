// Local-only authoring inspection: uses the actual shipped Arena renderer, geometry and lighting.
import {ArenaScene} from '../src/rendering/scene.ts';
import {MAPS,getMap} from '../shared/arenaMap.ts';
const canvas=document.querySelector<HTMLCanvasElement>('#review')!,scene=new ArenaScene(canvas,'low');
const status=document.querySelector<HTMLElement>('#status')!,capture=document.querySelector<HTMLAnchorElement>('#capture')!;
let id='homeward',generation=0;
const angles:Record<string,[number[],number[]]>={homeward:[[34,32,39],[0,1,-3]],aster:[[35,36,45],[0,1,0]],sakura:[[33,30,38],[0,1,0]],blackflag:[[39,30,45],[0,4,0]],camlann:[[39,34,45],[0,1,0]],frostcourt:[[39,34,42],[0,2,0]],lishan:[[18,4.5,14],[-4,-.3,-6]],suntemple:[[37,32,43],[0,1,0]],orleans:[[40,36,42],[0,2,0]]};
function view(kind:string){
 const m=getMap(id),[overview,target]=angles[id];let at=overview,to=target;
 if(kind==='west'||kind==='east'){const spawns=m.data.anchors.filter(a=>a.kind==='spawn'),team=kind==='west'?'west':'east';const a=spawns.find(a=>a.team===team||a.team===(kind==='west'?'A':'B'))??spawns[kind==='west'?0:spawns.length-1];at=[a.position[0],a.position[1]+m.eye,a.position[2]];const yaw=a.facingYaw;to=typeof yaw==='number'&&Number.isFinite(yaw)?[at[0]-Math.sin(yaw)*8,at[1],at[2]-Math.cos(yaw)*8]:[0,at[1],0];}
 if(kind==='center'){const radius=Math.max(m.data.bounds.max[0]-m.data.bounds.min[0],m.data.bounds.max[2]-m.data.bounds.min[2]);at=[radius*.22,Math.max(7,radius*.15),radius*.26];to=[0,1,0];}
 scene.renderer.setPixelRatio(1);scene.renderer.setSize(1280,720,false);scene.camera.aspect=1280/720;scene.camera.fov=kind==='west'||kind==='east'?78:id==='lishan'?62:50;scene.camera.position.set(at[0],at[1],at[2]);scene.camera.lookAt(to[0],to[1],to[2]);scene.camera.updateProjectionMatrix();scene.renderer.shadowMap.needsUpdate=true;scene.render(false);
 capture.href=canvas.toDataURL('image/jpeg',.94);capture.download=`${id}-${kind}.jpg`;status.textContent=`${id} / ${kind} · ${m.solids.length} 碰撞体 · ${m.data.anchors.filter(a=>a.kind==='spawn').length} 出生点 · 当前实景已就绪`;
}
async function choose(next:string){const token=++generation;id=next;status.textContent='正在加载 '+next;for(const b of document.querySelectorAll<HTMLButtonElement>('[data-map]'))b.setAttribute('aria-pressed',String(b.dataset.map===id));const m=MAPS.find(m=>m.id===id)!;await scene.loadMap(id,m.data.presentation?.preset??m.preset,m.data.presentation);if(token!==generation)return;await scene.renderer.compileAsync(scene.scene,scene.camera);view('overview');}
for(const m of MAPS){const button=document.createElement('button');button.dataset.map=m.id;button.textContent=m.id;button.onclick=()=>void choose(m.id).catch(e=>{status.textContent=String(e);console.error(e);});document.querySelector('#maps')!.append(button);}
for(const kind of ['overview','west','east','center'])document.getElementById(kind)!.onclick=()=>view(kind);
void choose(id).catch(e=>{status.textContent=String(e);console.error(e);});
