import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
test('NON-GPU production world differentiates peaceful sentinels and hides untargetable HP overlays',async()=>{
  const harness=await bootWorldWithoutGpu({deterministic:true});
  try {
    const {world,window}=harness,combat=world.combat as any;
    const e=combat.state.enemies.find((e:any)=>e.id==='wild_48');assert.ok(e);
    world.done.add('relay_b');combat.state.syncWorldFlags(world.done);
    combat.simulate(.05,e.p,true);combat.present(.05,e.p,true);
    const visual=combat.visuals.get(e.id);assert.equal(visual.root.visible,true);assert.equal(visual.bar.visible,false);
    assert.equal(visual.peaceMarker.visible,true);assert.equal(visual.peaceMarker.name,'Standing_Down_Not_Attackable');
    assert.match(window.document.querySelector('#world-vitals small')!.textContent!,/休眠|dormant/);
    assert.equal(combat.damageEnemy(e.id,20),false);
    for(const part of visual.bar.children) assert.equal(part.material.depthTest,true,'wall/terrain depth must occlude HP');
    world.done.delete('relay_b');combat.state.syncWorldFlags(world.done);combat.simulate(.05,e.p,true);combat.present(.05,e.p,true);
    assert.equal(visual.peaceMarker.visible,false);assert.equal(combat.damageEnemy(e.id,5),true);
    combat.present(0,e.p,true);assert.equal(visual.bar.visible,true);
    combat.present(0,e.p,false);assert.equal(visual.bar.visible,false,'scouting retains body, not a false combat target');assert.equal(visual.root.visible,true);
    let count=0;visual.fallback.traverseVisible((o:THREE.Object3D)=>{if(o instanceof THREE.Mesh && o.geometry.attributes.position.count>0)count++;});assert.ok(count>0);
  } finally {await harness.close();}
});
