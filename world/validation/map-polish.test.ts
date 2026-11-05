import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {snapshot} from './map-polish/snapshot.mjs';
import {countPreparedArt} from './map-polish/chunk-budget.ts';

const before=JSON.parse(readFileSync(new URL('./map-polish/baseline.json',import.meta.url),'utf8'));
const assets=fileURLToPath(new URL('../public/assets/',import.meta.url));
const chunkBaseline=JSON.parse(readFileSync(new URL('./map-polish/chunk-baseline.json',import.meta.url),'utf8'));
// Explicitly bounded authoring permission, NOT an updated expected-output hash.
// Every other exported node/accessor/transform must equal the untouched a309625
// baseline. A later explicit user request aligns four Alpha seam blockers; only
// their named COLLISION nodes plus four matching visible dynamic fields are exempt.
const seamNames = ['west','north','east','south'].map(id => `Seam_${id}_Gate`);
// Approved tavern-only append (43c0f6e), not a replacement baseline or open-ended
// detail allowance. tavern-underside.test.ts independently verifies decoded
// inward-face dimensions, original collision/layout, and upward FrontSide rays.
const tavernLining = 'Nassau_Tavern_Timber_Underside';
const liningAttribute = (sha256:string) => ({type:'VEC3',componentType:5126,normalized:false,count:18,sha256});
const approvedTavernNode = {translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],
  extras:{outline:false,dynamic:false},children:[],primitives:[{material:'M_BlackSailTimber',mode:4,
    attributes:{POSITION:liningAttribute('7e44d810baff25cebddd0dc60c1d8f3e9e201a6f78e8a1152a767e966491aa85'),
      NORMAL:liningAttribute('320e8ff58ffe3362e068da8491839d8c319b287ff2fc772547b32959b9571c3d'),
      COLOR_0:liningAttribute('af573593472bbb7973531523b61fe7a1611c0cc5960e3facdfdd9b9de340a456')},indices:null,triangles:6}]};
// Current map-repair request also closes Nassau hip roofs in the three named
// Timber/Terracotta/Shingle batches below, preserving the tavern exact lining.
// Current map-repair request: only these shared Kyoto roof consumers may change.
// Closed-shell topology and FrontSide visibility are verified in roof-integrity.test.ts.
const repairedRoofs = ['Kyoto_RoofCraft','Rakuchu','Rakuchu_B','Arashiyama_Roofs','Arashiyama_GardenStone'];
const edits:Record<string,{nodes:string[];triangles:number;bytes:number}>={
  alpha:{nodes:['Valley_Landing_Fieldkit_Ceramic','Valley_Landing_Fieldkit_Metal'],triangles:700,bytes:23000},
  britain:{nodes:['Britain_Physical_Wool','Britain_Physical_Bronze','Britain_Physical_Iron'],triangles:500,bytes:5000},
  blacksail:{nodes:['Nassau_Craft_Iron','Nassau_Craft_Rope','Nassau_Craft_Timber','Nassau_Craft_Terracotta','Nassau_Craft_Shingle'],triangles:1800,bytes:25000},
  winter:{nodes:['Bivouac_WinterCanvas'],triangles:2500,bytes:45000},
  kyoto:{nodes:['Inari','Higashiyama'],triangles:90000,bytes:900000},
};
for(const [region,allowed] of Object.entries(edits))test(`${region}: bounded detail whitelist preserves exact gameplay and all unrelated GLB content`,async()=>{
  const old=before.regions[region],now=await snapshot(assets,region);
  assert.equal(before.baselineCommit,'a3096254ef0fff455a29932bc5fef2e57fa49f44');
  if (region === 'alpha') {
    // Approved copy-only corrections: Relay B needs no kill gate; the tower
    // describes its proven original west-side staged climb, not a new ramp.
    // Reverse exactly these three strings, then require the untouched historical
    // byte hash. Coordinates, conditions, formatting and all other text stay exact.
    const raw=readFileSync(`${assets}/world_alpha.layout.json`,'utf8');
    assert.equal(raw.split('进入废弃前哨站并启动中继器 B').length-1,1);
    assert.equal(raw.split('进入据点后启动').length-1,1);
    assert.equal(raw.split('从西侧跑跳，空中再按跳跃展翼；外缘落稳后跳上平台，绕柱启动控制台。').length-1,1);
    const historical=raw.replace('进入废弃前哨站并启动中继器 B','清除废弃前哨站并启动中继器 B').replace('进入据点后启动','清除据点后启动').replace('从西侧跑跳，空中再按跳跃展翼；外缘落稳后跳上平台，绕柱启动控制台。','前往幻日塔，启动控制台');
    assert.equal(createHash('sha256').update(historical).digest('hex'),old.layoutSha256,'only three approved copy strings differ from complete historical layout bytes');
  } else assert.equal(now.layoutSha256,old.layoutSha256,'complete layout bytes: quests, gates, navigation, spawns and lighting');
  assert.deepEqual([...now.materials].sort((a,b)=>a.name.localeCompare(b.name)),[...old.materials].sort((a,b)=>a.name.localeCompare(b.name)),'existing surface/alpha/material identities (material table order is storage only)');
  const foundation=region==='kyoto'?'Kyoto_Hillside_Foundations':region==='winter'?'Winter_House_Foundations':null;
  const added = region === 'alpha' ? seamNames : region === 'blacksail' ? [tavernLining,'Fort_Tower_Drums'] : foundation?[foundation]:[];
  const extraCollision=region==='blacksail'?['COL_Fort_Tower_Drums']:foundation?[`COL_${foundation}`]:[];
  const appendTriangles = region === 'blacksail' ? 6 : 0, appendBytes = region === 'blacksail' ? 1412 : 0;
  assert.deepEqual(Object.keys(now.nodes).filter(n=>!added.includes(n) && !extraCollision.includes(n)),Object.keys(old.nodes),'only explicitly named seam, lining and structural repair nodes may be added; no removal/reorder');
  for(const [name,node] of Object.entries(now.nodes)){
    if(region==='blacksail' && name===tavernLining) {
      assert.deepEqual(node.extras,approvedTavernNode.extras);
      assert.deepEqual(node.children,[]);
      assert.equal(node.primitives.length,1);
      assert.equal(node.primitives[0].triangles,6);
      assert.equal(node.primitives[0].material,'M_BlackSailTimber');
      // Rebuilding the newly repaired Nassau roofs quantizes the old lining too.
      // tavern-underside.test.ts verifies its decoded original shape, not storage layout.
    } else if(foundation && [foundation,`COL_${foundation}`].includes(name)) {
      assert.equal(node.primitives.length,1);assert.ok(node.primitives[0].triangles>0&&node.primitives[0].triangles<=768);assert.equal(node.primitives[0].triangles%12,0);
      assert.deepEqual(node.children,[]);
      assert.deepEqual(node.extras,name.startsWith('COL_')?{dynamic:true,art:foundation,groundFooting:true}:{groundFooting:true,outline:false,dynamic:true});
      assert.equal(node.primitives[0].material,name.startsWith('COL_')?'M_Collision':region==='kyoto'?'M_KyotoArchitecture':'M_WinterStone');
    } else if(region==='blacksail' && ['Fort_Tower_Drums','COL_Fort_Tower_Drums'].includes(name)) {
      assert.equal(node.primitives.length,1);assert.equal(node.primitives[0].triangles,320);
      assert.deepEqual(node.children,[]);
      assert.deepEqual(node.extras,name.startsWith('COL_')?{dynamic:true,art:'Fort_Tower_Drums'}:{outline:false,dynamic:true});
      assert.equal(node.primitives[0].material,name.startsWith('COL_')?'M_Collision':'M_BlackSailStone');
    } else if(name==='COLLISION' && extraCollision.length) {
      assert.deepEqual({...node,children:node.children.filter(n=>!extraCollision.includes(n))},old.nodes[name]);
} else if(added.includes(name)) {
      assert.deepEqual(node.extras,{opensWhen:['summon_circle'],outline:false,dynamic:true});
      assert.equal(node.primitives.length,1); assert.equal(node.primitives[0].material,'M_Beam');
      assert.equal(node.primitives[0].triangles,60,'three complete visible/physical panels');
    } else if(region==='alpha' && seamNames.some(n=>name===`COL_${n}`)) {
      assert.deepEqual(node.extras,old.nodes[name].extras,'original unlock contract');
      assert.deepEqual(node.children,old.nodes[name].children);
      assert.equal(node.primitives.length,1); assert.equal(node.primitives[0].material,'M_Collision');
      assert.equal(node.primitives[0].triangles,60);
      // Exact exported pylon alignment and all triangle positions vs ART are
      // checked independently in seam-barrier.test.ts, not accepted by a hash refresh.
    } else if(name==='ART' && added.length) {
      assert.deepEqual({...node,children:node.children.filter(n=>!added.includes(n))},old.nodes[name]);
    } else if(region==='kyoto' && repairedRoofs.includes(name)) {
      assert.deepEqual(node.extras,old.nodes[name].extras);
      assert.deepEqual(node.children,old.nodes[name].children);
      assert.deepEqual(node.primitives.map(p=>p.material),old.nodes[name].primitives.map(p=>p.material));
      assert.ok(node.primitives[0].triangles<=old.nodes[name].primitives[0].triangles+45000,'bounded attic infill; duplicated roof side skins removed');
      for(const key of ['translation','rotation','scale']) {
        if(name!=='Arashiyama_Roofs') assert.deepEqual(node[key],old.nodes[name][key]);
        else node[key].forEach((v:number,i:number)=> {
          if(key==='translation' && i===1) assert.ok(Math.abs(v-old.nodes[name][key][i])<0.02,'soffit repair shifts only the quantization Y center by under 2 cm');
          else assert.equal(v,old.nodes[name][key][i]);
        });
      }
    } else if(!allowed.nodes.includes(name))assert.deepEqual(node,old.nodes[name],`${name}: exact decoded accessor hashes and scene metadata`);
    else {
      assert.notDeepEqual(node.primitives,old.nodes[name].primitives,`${name}: intended visual detail actually exported`);
      assert.deepEqual(node.extras,old.nodes[name].extras,`${name}: no new dynamic/quest behavior`);
      for(const key of ['translation','rotation','scale'])assert.deepEqual(node[key],old.nodes[name][key],`${name}: unchanged quantized transform/bounds`);
      assert.deepEqual(node.children,old.nodes[name].children,`${name}: hierarchy`);
      assert.deepEqual(node.primitives.map(p=>p.material),old.nodes[name].primitives.map(p=>p.material),`${name}: material batches`);
    }
  }
  assert.equal(now.artPrimitives,old.artPrimitives+added.length,'only explicitly approved single ART primitives added');
  assert.ok((region==='kyoto' ? now.artTriangles>old.artTriangles-15000 : now.artTriangles>old.artTriangles)&&now.artTriangles-old.artTriangles-appendTriangles<=allowed.triangles,'bounded triangle budget including removal of duplicate roof skins');
  assert.ok(now.bytes-old.bytes-appendBytes<=allowed.bytes,'small compressed asset delta budget');
  assert.ok(now.bytes<25*1024*1024,'existing individual-file delivery ceiling');
  const prepared=await countPreparedArt(assets,region),original=chunkBaseline[region];
  if(region!=='kyoto') assert.equal(prepared.chunks,original.chunks+added.length,'only explicitly approved single prepared meshes added');
  else assert.ok(prepared.chunks<=original.chunks+64,'bounded prepared meshes for complete attic infills');
  if(region!=='kyoto') assert.equal(prepared.outlineChunks,original.outlineChunks,'no additional outline meshes');
  else assert.ok(prepared.outlineChunks<=original.outlineChunks+64,'bounded outline meshes for complete attic infills');
  const unchangedMesh = (name:string) => !added.includes(name) && !(region==='kyoto' && repairedRoofs.includes(name));
  assert.deepEqual(Object.fromEntries(Object.entries(prepared.byMesh).filter(([name])=>unchangedMesh(name))),Object.fromEntries(Object.entries(original.byMesh).filter(([name])=>unchangedMesh(name))),'exact unrelated per-source chunk distribution, including 4k threshold');
  for(const name of added)assert.equal(prepared.byMesh[name],1);
});
