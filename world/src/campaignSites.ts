/** Authored working spaces inside the five existing safe settlements.
 * Geometry is created once, material/colour-batched and never rebuilt for story progress.
 * Mutable consequence props are visual only: choices never move a collider or gate.
 */
import * as THREE from 'three';
import { mergeParts } from './settlements/merge';
import type { RegionId, SettlementPlacement, PlacedNpcSocket, Localized } from './settlements/types';
import type { Marker } from './types';
import { CAMPAIGN_EPISODES } from './campaignEpisodes';

type V3 = [number, number, number];
export interface CampaignSiteState { readonly stage: 0 | 1 | 2 | 3; readonly choice?: string; }
export type CampaignSiteStates = Readonly<Partial<Record<RegionId, CampaignSiteState>>>;
export const CAMPAIGN_SITE_LIMITS = Object.freeze({ visible: 150, triangles: 5000, meshes: 12, materials: 4 });
export const CAMPAIGN_SITE_LOCAL: Readonly<Record<RegionId, V3>> = Object.freeze({
  alpha: [-7, 0, 5.2], britain: [-10.5, 0, 11.6], blacksail: [6.8, 0, 8],
  winter: [-9.2, 0, 11.4], kyoto: [10.5, 0, 10.2],
});
const META: Record<RegionId, { name: Localized; role: Localized; npc: string; work: Localized; decision: Localized; choices: [string, string] }> = {
  alpha: { name: ['归航讯号亭', 'Homeward Signal Kiosk'], role: ['信号守望员', 'Signal Keeper'], npc: 'alpha_signal_keeper', work: ['校准收讯台', 'Tune the receiver'], decision: ['查阅派遣板', 'Read the dispatch board'], choices: ['broadcast', 'listen'] },
  britain: { name: ['誓言见证棚', 'Oath Witness Shelter'], role: ['誓言见证人', 'Oath Witness'], npc: 'britain_oath_witness', work: ['整理见证册', 'Arrange the witness record'], decision: ['查看归人席位', 'Review the returning seats'], choices: ['names', 'seats'] },
  blacksail: { name: ['潮汐值守台', 'Tide Watch Station'], role: ['港灯守望员', 'Harbor Lamplighter'], npc: 'blacksail_lamplighter', work: ['核对潮汐清单', 'Check the tide manifest'], decision: ['调整港灯遮板', 'Set the harbor shutters'], choices: ['families', 'supplies'] },
  winter: { name: ['暖路担架棚', 'Warmroad Stretcher Shelter'], role: ['雪路担架员', 'Snowroad Stretcher Bearer'], npc: 'winter_stretcher_bearer', work: ['整理救护担架', 'Prepare the casualty stretcher'], decision: ['检查暖路图', 'Inspect the warm-route board'], choices: ['shelter', 'convoy'] },
  kyoto: { name: ['纸灯避难廊', 'Paperlight Refuge'], role: ['护卷人', 'Paper Keeper'], npc: 'kyoto_paper_keeper', work: ['晾护浸水书册', 'Dry the soaked ledger'], decision: ['检查避难窗板', 'Inspect the shelter shutters'], choices: ['records', 'refuge'] },
};
type Layer = 'ground' | 'body' | 'metal' | 'glow' | 'briefed' | 'choiceA' | 'choiceB' | 'resolved';
const cube = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
/** Colours are per vertex, allowing richly differentiated props without a material per colour. */
export class SiteArt {
  readonly root = new THREE.Group();
  readonly solids: THREE.BufferGeometry[] = [];
  readonly layers = new Map<Layer, THREE.Mesh>();
  readonly materials = {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .48, metalness: .55 }),
    glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, emissive: '#ffe0ab', emissiveIntensity: .45 }),
  };
  private bins = new Map<Layer, THREE.BufferGeometry[]>();
  add(g: THREE.BufferGeometry, color: string, p: V3, size: V3 = [1, 1, 1], solid = false, layer: Layer = 'body', rotation: V3 = [0, 0, 0]) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...size));
    const part = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(matrix);
    const c = new THREE.Color(color), colors = new Float32Array(part.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!part.attributes.normal) part.computeVertexNormals();
    if (!part.attributes.uv) part.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(part.attributes.position.count * 2), 2));
    const bin = this.bins.get(layer) ?? []; bin.push(part); this.bins.set(layer, bin);
    if (solid) this.solids.push(new THREE.BufferGeometry().setAttribute('position', part.attributes.position.clone()));
  }
  box(p: V3, size: V3, color: string, solid = false, layer: Layer = 'body', rotation: V3 = [0, 0, 0]) { this.add(cube, color, p, size, solid, layer, rotation); }
  cyl(p: V3, r: number, h: number, color: string, solid = false, layer: Layer = 'body', rotation: V3 = [0, 0, 0]) { this.add(cylinder, color, p, [r, h, r], solid, layer, rotation); }
  beam(a: V3, b: V3, w: number, color: string, solid = false, layer: Layer = 'body') {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    this.box(from.add(to).multiplyScalar(.5).toArray() as V3, [w, d.length(), w], color, solid, layer, [e.x, e.y, e.z]);
  }
  ring(p: V3, radius: number, tube: number, color: string, layer: Layer = 'metal', rotation: V3 = [0, 0, 0]) {
    const g = new THREE.TorusGeometry(radius, tube, 5, 16); this.add(g, color, p, [1, 1, 1], false, layer, rotation); g.dispose();
  }
  paper(x: number, y: number, z: number, w = .65, d = .48, layer: Layer = 'body') {
    this.box([x,y,z],[w,.025,d],'#ead9b4',false,layer);
    for(let i=0;i<3;i++) this.box([x-.04,y+.015,z-d*.28+i*d*.23],[w*.68,.008,.018],'#6d7573',false,layer);
  }
  lantern(x: number, y: number, z: number, metal = '#6b675b') {
    this.box([x,y,z],[.32,.42,.28],'#efce90',false,'glow');
    for(const dy of[-.25,.25])this.box([x,y+dy,z],[.45,.09,.4],metal,false,'metal');
    for(const dx of[-.19,.19])this.box([x+dx,y,z],[.035,.48,.33],metal,false,'metal');
    this.ring([x,y+.36,z],.075,.018,metal);
  }
  board(x:number,z:number,wood:string,accent:string) {
    for(const sx of[-.65,.65])this.box([x+sx,1,z],[.09,2,.12],wood,true);
    this.box([x,1.48,z],[1.5,1.05,.13],wood,true);
    this.box([x,1.5,z+.075],[1.31,.86,.025],'#e6d4ad');
    for(let i=0;i<4;i++)this.box([x,1.77-i*.18,z+.095],[.95-(i%2)*.2,.025,.015],accent);
    for(const sx of[-.57,.57])this.cyl([x+sx,1.8,z+.105],.035,.03,'#a68c5e',false,'metal',[Math.PI/2,0,0]);
  }
  finish(region: RegionId) {
    this.root.name = `CampaignSite_${region}`;
    for(const [layer,parts] of this.bins){
      const geometry=mergeParts(parts);for(const part of parts)part.dispose();
      const material=layer==='metal'?this.materials.metal:layer==='glow'?this.materials.glow:this.materials.body;
      const mesh=new THREE.Mesh(geometry,material);mesh.name=`Campaign_${region}_${layer}`;
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.campaignLayer=layer;this.root.add(mesh);this.layers.set(layer,mesh);
    }
  }
}

function alpha(a: SiteArt) {
  const blue='#3e5d75',ivory='#e2e5d9',brass='#baa16c',ink='#465b63';
  // Open-sided observatory instrument kiosk: a curved roof and receiver rack, not a house clone.
  for(const x of[-2.35,2.35]){a.box([x,1.55,-.95],[.15,3.1,.15],blue,true);a.box([x,.15,-.95],[.3,.3,.3],ivory,true);}
  for(let i=0;i<6;i++){const z=-1.35+i*.47;const y=3.2+.28*Math.sin(i*Math.PI/5);a.box([0,y,z],[5.15,.12,.49],ivory,true,'body',[-.13*Math.cos(i*Math.PI/5),0,0]);}
  for(const x of[-2.5,2.5])a.beam([x,3.2,-1.5],[x,3.2,1.3],.08,brass);
  a.box([-1, .91,-.65],[2.1,.18,1.15],blue,true);
  for(const x of[-1.8,-.2])a.box([x,.42,-.65],[.13,.84,.8],ivory,true);
  a.box([-1,1.28,-.85],[1.62,.56,.54],blue,true);
  a.box([-1.35,1.32,-.565],[.58,.24,.025],'#83c8c5',false,'glow');
  for(let i=0;i<5;i++)a.box([-1.57+i*.11,1.33,-.545],[.025,.06+(i%3)*.045,.015],ivory);
  for(const x of[-.65,-.35]){a.cyl([x,1.29,-.55],.085,.045,brass,false,'metal',[Math.PI/2,0,0]);a.box([x,1.3,-.517],[.018,.07,.018],ink);}
  a.ring([-.1,1.64,-.86],.31,.04,brass);
  a.beam([-.1,1.65,-.86],[.12,2.24,-.86],.035,brass);
  a.paper(-1,.0+1.02,-.12,.75,.3);
  a.board(1.35,-.85,blue,ink);
  a.lantern(2.05,2.5,-.9,brass);
  a.cyl([-2.2,2.35,-1],.055,4.7,brass,true,'metal');
  a.ring([-2.2,4.45,-1],.55,.045,ivory,'body',[0,Math.PI/2,0]);
  a.ring([-2.2,4.45,-1],.31,.028,brass,'metal');
  // The selected radio channel changes large, recognizable aerial pennants.
  a.box([-2.2,3.75,-1],[.65,.11,.13],'#8fc5be',false,'briefed');
  for(const x of[-2.65,-1.75])a.box([x,4.5,-1],[.15,.65,.1],'#c8dfaf',false,'choiceA');
  a.box([-2.2,4.52,-.63],[.12,.65,.68],'#86b9d4',false,'choiceB');
  a.box([1.35,1.95,-.755],[.85,.06,.025],'#8bcdb2',false,'resolved');
}
function britain(a: SiteArt) {
  const wood='#70523c',dark='#4f4436',linen='#d9c29a',blue='#647d99',stone='#b8ab91';
  // A witness shelter framed by carved oak, with an open front and a hand-laid oath desk.
  for(const x of[-2.2,2.2]){a.box([x,1.45,-1.2],[.2,2.9,.2],wood,true);a.box([x,.22,-1.2],[.42,.44,.42],stone,true);}
  for(const side of[-1,1]){a.box([side*1.15,3.15,-.25],[2.43,.12,3.5],blue,true,'body',[0,0,-side*.23]);a.beam([0,3.43,1.45],[side*2.35,2.88,1.45],.1,linen);}
  a.box([0,3.48,-.25],[.16,.18,3.7],dark,true);
  for(const x of[-2.2,2.2])a.beam([x,2.1,-1.2],[x*.65,2.92,-1.2],.12,wood);
  a.box([-1.05,.85,-.55],[1.85,.19,1.05],wood,true);
  for(const x of[-1.7,-.4])a.box([x,.4,-.55],[.16,.8,.8],dark,true);
  a.paper(-1.05,.96,-.5,1.15,.65);
  for(let i=0;i<3;i++){a.cyl([-1.5+i*.44,1.01,-.35],.065,.03,'#a44f42');a.box([-1.5+i*.44,.99,-.21],[.08,.025,.25],linen);}
  a.beam([-1.7,.99,-.77],[-1.2,1.05,-.65],.025,dark);
  a.board(1.25,-.95,wood,blue);
  a.lantern(2.05,2.35,-1.15,dark);
  // A broad sword-and-leaf sign, without additional triangle-dense ornament.
  a.box([0,2.6,-1.18],[.8,.9,.1],blue);
  a.box([0,2.61,-1.11],[.045,.62,.02],linen);a.box([0,2.45,-1.1],[.32,.04,.025],linen);
  for(const x of[-.2,.2])a.beam([x,2.36,-1.1],[x*.4,2.8,-1.1],.035,linen);
  a.paper(-1.05,.995,-.5,1.05,.55,'briefed');
  for(let i=0;i<4;i++)a.box([1.25,1.77-i*.18,-.84],[.88,.04,.02],'#ab6346',false,'choiceA');
  // Fold-out seats remain decorative and do not create a progress-dependent obstacle.
  for(const x of[-1.7,1.7]){a.box([x,.47,.5],[.65,.1,.65],linen,false,'choiceB');for(const s of[-1,1])a.beam([x+s*.24,.04,.25],[x-s*.24,.45,.75],.06,wood,false,'choiceB');}
  a.ring([0,2.6,-1.07],.28,.04,'#cab378','resolved');
}
function blacksail(a: SiteArt) {
  const oak='#6f5542',teal='#377c7d',linen='#e6d2aa',iron='#45525b',brass='#bda170';
  // Small tide-watch awning with a distinct sloped canvas and a two-shutter signal mast.
  for(const x of[-2.2,2.2])a.cyl([x,1.6,-1.2],.09,3.2,oak,true);
  a.box([0,3.03,-.15],[5,.07,3.1],linen,false,'body',[.12,0,0]);
  for(let x=-2;x<=2;x+=1)a.box([x,3.075,-.15],[.16,.025,3.1],teal,false,'body',[.12,0,0]);
  a.beam([-2.45,2.84,1.37],[2.45,2.84,1.37],.08,oak);
  a.box([-1.1,.83,-.6],[1.9,.16,1.1],oak,true);
  for(const x of[-1.8,-.4])a.box([x,.38,-.6],[.13,.76,.85],iron,true);
  a.paper(-1.1,.93,-.6,1.25,.65);
  a.cyl([-1.7,1.04,-.75],.13,.22,brass,false,'metal');a.cyl([-.55,.97,-.65],.15,.04,'#a1493f');
  a.board(.9,-1.15,teal,iron);
  a.cyl([2.13,2,-1.1],.095,4,oak,true);
  a.beam([1.55,3.7,-1.1],[2.7,3.7,-1.1],.08,oak);
  a.lantern(2.13,3.18,-1.1,iron);
  for(const x of[1.75,2.5])a.box([x,3.2,-1.15],[.3,.6,.05],teal);
  a.ring([2.12,1.4,-.99],.28,.04,brass);
  a.beam([2.12,1.12,-1],[2.12,.6,-1],.025,linen);
  a.box([-1.1,.955,-.6],[.1,.025,.65],'#ad5f4e',false,'briefed');
  for(const x of[1.72,2.54])a.box([x,3.2,-1.05],[.25,.48,.04],'#d4ba7e',false,'choiceA');
  for(const x of[1.72,2.54])a.box([x,3.2,-1.05],[.25,.48,.04],'#77b4b0',false,'choiceB');
  a.box([2.13,3.88,-1.08],[.75,.13,.06],linen,false,'resolved');
}
function winter(a: SiteArt) {
  const log='#7d6956',dark='#514a42',linen='#e2d4b8',blue='#597895',snow='#e9eef0';
  // Low windbreak canopy faces the main gate; its stretcher is sheltered, never in the road.
  for(const x of[-1.95,1.95])a.box([x,1.35,-1.3],[.15,2.7,.15],log,true);
  a.box([0,2.82,-.3],[4.35,.09,3.25],linen,false,'body',[-.09,0,0]);
  a.box([0,2.94,-1.45],[4.4,.1,.85],snow,false,'body',[-.09,0,0]);
  for(const x of[-1.95,1.95])a.beam([x,2.68,-1.9],[x,2.98,1.3],.08,dark);
  for(let i=0;i<5;i++)a.box([0,.3+i*.28,-1.32],[4,.23,.12],log,true);
  // Canvas stretcher, carry poles, leather buckles, folded blanket and hot-water flask.
  a.box([-.9,.58,-.3],[1.35,.08,1.8],linen,true);
  for(const x of[-1.65,-.15])a.beam([x,.6,-1.45],[x,.6,.85],.065,log);
  for(const z of[-1,.4])for(const x of[-1.45,-.35])a.box([x,.27,z],[.1,.54,.12],dark,true);
  a.box([-.9,.7,-.92],[1.1,.17,.4],linen);
  a.box([-.9,.68,-.1],[1.32,.1,1.15],blue);
  for(const x of[-1.25,-.55])a.box([x,.75,-.1],[.065,.035,1.13],linen);
  a.board(1.05,-.9,log,blue);
  a.cyl([1.65,.22,.45],.27,.44,dark,true);a.cyl([1.65,.46,.45],.16,.08,'#c2a36f',false,'metal');
  a.lantern(1.8,2.1,-1.25,dark);
  a.box([-.9,.755,-.1],[.24,.025,.9],'#b69868',false,'briefed');
  a.box([-.9,.82,-.1],[1.3,.13,1.15],'#b29b78',false,'choiceA');
  for(const x of[-1.65,-.15])a.box([x,.69,.6],[.17,.09,.38],blue,false,'choiceB');
  a.box([1.05,1.95,-.8],[.82,.055,.025],'#8d9d75',false,'resolved');
}
function kyoto(a: SiteArt) {
  const timber='#855d40',dark='#554239',paper='#f0dfbb',indigo='#525e82',tile='#647483';
  // A narrow paper-preservation veranda; slatted side screen and a folded tile eave.
  for(const x of[-2.2,2.2])a.box([x,1.4,-1.2],[.14,2.8,.14],timber,true);
  for(const side of[-1,1]){a.box([0,2.95,-.3+side*.85],[5,.12,1.85],tile,true,'body',[side*.17,0,0]);a.box([0,2.84,-.3+side*1.75],[5.1,.13,.3],tile,true,'body',[-side*.12,0,0]);}
  a.box([0,3.17,-.3],[5.15,.16,.23],dark,true);
  for(let x=-2;x<=2;x+=.5)a.box([x,3.29,-.3],[.4,.14,.3],'#89939a');
  for(let x=-2;x<=2;x+=.4)a.box([x,1.8,-1.2],[.055,1.6,.06],timber);
  a.box([0,1.78,-1.24],[4.2,1.45,.035],paper);
  for(const y of[1.1,1.8,2.5])a.box([0,y,-1.17],[4.3,.055,.06],dark);
  a.box([-1.1,.78,-.4],[1.9,.13,1.1],timber,true);
  for(const x of[-1.8,-.4])a.box([x,.36,-.4],[.1,.72,.9],dark,true);
  for(let i=0;i<4;i++){a.paper(-1.75+i*.43,.86,-.4,.36,.75);a.cyl([-1.75+i*.43,.89,-.02],.035,.32,dark,false,'body',[0,0,Math.PI/2]);}
  a.board(1.15,-.75,timber,indigo);
  for(const x of[.55,1.75])a.box([x,1.5,-.65],[.3,.9,.045],indigo);
  a.lantern(2.03,2.15,-1.1,dark);
  a.box([-.2,2.45,-1.1],[.48,.52,.025],indigo);
  a.box([-.2,2.45,-1.08],[.05,.32,.018],paper);
  a.paper(-1.05,.895,-.4,.36,.75,'briefed');
  // Dry archival cases or rolled refuge mats make the choice visible from the gate.
  for(let i=0;i<2;i++){a.box([-1.65+i*.55,.24,.7],[.45,.48,.45],indigo,false,'choiceA');a.box([-1.65+i*.55,.26,.94],[.09,.28,.02],paper,false,'choiceA');}
  for(let i=0;i<2;i++){a.cyl([-.95+i*.7,.2,.7],.2,.55,'#b7ad80',false,'choiceB',[0,0,Math.PI/2]);a.box([-.95+i*.7,.39,.7],[.06,.025,.25],indigo,false,'choiceB');}
  a.box([-.2,2.46,-1.05],[.23,.04,.02],'#d7ae67',false,'resolved');
}
const BUILDERS = { alpha, britain, blacksail, winter, kyoto };

/** Local form is exported for independent physics tests and actual-runtime mesh renders. */
export function buildCampaignSite(region: RegionId) {
  const a=new SiteArt();BUILDERS[region](a);a.finish(region);
  const metadata=META[region];
  const local=CAMPAIGN_SITE_LOCAL[region];
  const half = region==='winter'?1.15:1.35;
  const interactions:[V3,V3]=[[-half,.9,1.65],[half,.9,1.65]];
  const npc:PlacedNpcSocket={id:metadata.npc,region,role:CAMPAIGN_EPISODES[region].speaker,position:[0,.02,1.2],yaw:0,lines:[CAMPAIGN_EPISODES[region].brief]};
  let stateKey='',disposed=false;
  function applyState(state:CampaignSiteState){
    if(disposed)return;const key=`${state.stage}:${state.choice??''}`;if(key===stateKey)return;stateKey=key;
    for(const layer of['briefed','choiceA','choiceB','resolved']as const){const mesh=a.layers.get(layer);if(mesh)mesh.visible=layer==='briefed'?state.stage>=1:layer==='resolved'?state.stage===3:state.stage>=2&&state.choice===metadata.choices[layer==='choiceA'?0:1];}
    a.root.userData.campaignState={stage:state.stage,choice:state.choice};
  }
  applyState({stage:0});
  return{region,root:a.root,local,interactions,npc,collisionGeometries:a.solids,applyState,
    dispose(){if(disposed)return;disposed=true;a.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});for(const g of a.solids)g.dispose();Object.values(a.materials).forEach(m=>m.dispose());a.root.removeFromParent();a.root.clear();},
  };
}
export function createCampaignSites(placements:readonly SettlementPlacement[]) {
  const root=new THREE.Group();root.name='Campaign_Working_Spaces';
  const sites=placements.map(p=>{
    const site=buildCampaignSite(p.id),origin=p.position.map((v,i)=>v+site.local[i]) as V3;
    site.root.position.set(...origin);root.add(site.root);
    for(const g of site.collisionGeometries)g.translate(...origin);
    const npc={...site.npc,position:site.npc.position.map((v,i)=>v+origin[i]) as V3};
    const markers=site.interactions.map((socket,i):Marker=>({id:`campaign_${p.id}_${i===0?'work':'decision'}`,type:'interact',label:CAMPAIGN_EPISODES[p.id][i===0?'workLabel':'decisionLabel'][0],p:socket.map((v,j)=>v+origin[j]) as V3,radius:1.65}));
    return{...site,origin,npc,markers};
  });
  let disposed=false;
  return{root,sites,markers:sites.flatMap(s=>s.markers),npcs:sites.map(s=>s.npc),collisionGeometries:sites.flatMap(s=>s.collisionGeometries),
    update(player:Pick<THREE.Vector3,'x'|'z'>,states?:CampaignSiteStates){if(disposed)return;for(const s of sites){const dx=player.x-s.origin[0],dz=player.z-s.origin[2];s.root.visible=dx*dx+dz*dz<CAMPAIGN_SITE_LIMITS.visible**2;if(states?.[s.region])s.applyState(states[s.region]!);}},
    applyState(region:RegionId,state:CampaignSiteState){if(!disposed)sites.find(s=>s.region===region)?.applyState(state);},
    dispose(){if(disposed)return;disposed=true;for(const s of sites)s.dispose();root.removeFromParent();root.clear();},
  };
}
