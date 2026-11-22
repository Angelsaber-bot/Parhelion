import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import { homeWorld } from '../map/homePlan';
import type { Localized } from '../settlements/types';
import type { HomeActivityHost } from './homeActivities';

type Crop = 'mint' | 'carrot';
type Choice = { id: string; label: Localized };
type Ask = (id: string, line: Localized, options: Choice[], pick: (value: string) => void) => void;
const crops: readonly Crop[] = ['mint', 'carrot'];
const planted = (c: Crop) => 'home_planted_' + c;
const ingredient = (c: Crop) => 'home_pantry_' + c;
const packed = (c: Crop) => 'home_packed_' + c;
const served = (c: Crop) => 'home_served_' + c;
export const sharedRecipe = (c: Crop) => 'home_shared_' + c;
const deadlinePrefix = 'home_crop_ripe_at_';
const cookLabel: Record<Crop, Localized> = {
  mint: ['揉开薄荷叶，泡一壶茶', 'Bruise the mint leaves and steep a pot of tea'],
  carrot: ['把胡萝卜擦成丝，烤一盘咸面包卷', 'Grate the carrots and bake savoury rolls'],
};

/** The two servings share one harvest. One stays on the kitchen table and one can travel. */
export function createKitchenGarden(h: HomeActivityHost, root: THREE.Group, ask: Ask) {
  const soil = new THREE.Group(), supper = new THREE.Group();
  soil.name = 'HomeKitchenGarden'; supper.name = 'HomeKitchenTable';
  soil.position.fromArray(homeWorld([-101, 16.10, 116]));
  supper.position.fromArray(homeWorld([-174, 16.97, 142]));
  root.add(soil, supper);
  const bedBounds = new THREE.BoxGeometry(3.44,.31,1.74);
  bedBounds.translate(soil.position.x,soil.position.y+.155,soil.position.z);
  const collider = {name:soil.name, enabled:true, bvh:new MeshBVH(bedBounds)};
  const wood = new THREE.BoxGeometry(1, 1, 1);
  const round = new THREE.SphereGeometry(1, 10, 8);
  const cylinder = new THREE.CylinderGeometry(1, .86, 1, 14);
  const handle = new THREE.TorusGeometry(1, .22, 6, 14);
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, size: [number,number,number], x: number, y: number, z: number) {
    let material = materials.get(color);
    if (!material) { material = new THREE.MeshStandardMaterial({color, roughness:.85}); materials.set(color, material); }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x,y,z); mesh.scale.set(...size); mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  part(soil, wood, 0x604630, [3.2,.24,1.5], 0,.12,0);
  for (const side of [-1,1]) {
    part(soil, wood, 0xa37d55, [3.44,.31,.12], 0,.155,side*.81);
    part(soil, wood, 0x866347, [.12,.31,1.5], side*1.66,.155,0);
  }
  // The irrigation pipe runs under the planting beds and resurfaces at their edge.
  const spout = part(soil,cylinder,0x627a74,[.065,.42,.065],-1.55,.43,0);
  part(soil,cylinder,0x627a74,[.065,.25,.065],spout.position.x+.08,.61,0).rotation.z=Math.PI/2;
  function plants(c: Crop) {
    const group = new THREE.Group(); group.name = 'HomeCrop_' + c; group.position.y = .24; soil.add(group);
    for (const x of [-1,0,1]) for (const z of [-.36,.36]) {
      if (c === 'carrot') part(group, round, 0xe48c44, [.13,.12,.13], x,.015,z);
      for (const side of [-1,1]) {
        const leaf = part(group, round, c==='mint'?0x579779:0x708e4e, c==='mint'?[.13,.23,.09]:[.065,.29,.06], x+side*.08,.18,z);
        leaf.rotation.z = -side*.48;
      }
    }
    return group;
  }
  const growing = {mint:plants('mint'),carrot:plants('carrot')};
  const crockery = (name: string) => {const g = new THREE.Group(); g.name=name; supper.add(g); return g;};
  const tea = crockery('HomeMintTea'), rolls = crockery('HomeCarrotRolls');
  part(tea, cylinder, 0xc19a73, [.57,.035,.33], 0,.018,0);
  part(tea, round, 0x65958c, [.20,.18,.18], -.19,.20,0);
  part(tea, cylinder, 0x456c67, [.12,.04,.12], -.19,.37,0);
  part(tea, cylinder, 0x65958c, [.055,.19,.055], -.006,.23,0).rotation.z=-.75;
  part(tea, handle, 0x65958c, [.12,.11,.10], -.37,.21,0);
  for (const z of [-.13,.14]) {
    part(tea, cylinder, 0xe6d7b6, [.095,.12,.095], .25,.096,z);
    part(tea, cylinder, 0xa09c58, [.083,.008,.083], .25,.158,z);
  }
  part(rolls, cylinder, 0xd6c4a7, [.43,.05,.3], 0,.025,0);
  for (const x of [-.21,0,.21]) {
    part(rolls, round, 0xc98745, [.109,.092,.17], x,.121,0);
    part(rolls, round, 0xe4b574, [.017,.009,.086], x,.211,0).rotation.y=.38;
  }

  const shelf = new THREE.Group();
  shelf.position.fromArray(homeWorld([-165, 18.86, 127])); root.add(shelf);
  const coaster = part(shelf,cylinder,0x86b09a,[.18,.024,.18],-.48,.012,0);
  const card = part(shelf,wood,0xedd5a1,[.38,.015,.24],.38,.008,0);
  card.rotation.y = -.18;
  let crop: Crop | undefined, ripeAt = 0, ripe = false;
  const clock = h.now ?? (() => Date.now());
  function refreshGrowth() {
    ripe = !!ripeAt && clock() >= ripeAt;
    for (const c of crops) {
      growing[c].visible = crop === c;
      growing[c].scale.y = ripe ? 1 : ripeAt ? .63 : .32;
    }
  }
  function apply() {
    crop = crops.find(c => h.done.has(planted(c)));
    ripeAt = Number([...h.done].find(f => f.startsWith(deadlinePrefix))?.slice(deadlinePrefix.length)) || 0;
    refreshGrowth();
    coaster.visible = h.done.has(sharedRecipe('mint')); card.visible = h.done.has(sharedRecipe('carrot'));
    tea.visible = h.done.has(served('mint')); rolls.visible = h.done.has(served('carrot'));
  }
  function save() { apply(); h.save(); h.changed(); }
  function water() {
    if (!crop || ripeAt) return false;
    h.done.add(deadlinePrefix + (clock()+45000));
    apply(); // The pump commits this and its civic completion together.
    return true;
  }
  function tend(id: string) {
    refreshGrowth();
    if (!crop) {
      ask(id,['叶把两包种子夹在木框上。种好以后，去旁边的手压泵给菜畦放水。','Ye tucked two seed packets into the frame. Sow one, then water it at the nearby hand pump.'],
        [{id:'mint',label:['撒下薄荷种子','Sow mint']},{id:'carrot',label:['点播胡萝卜','Sow carrots']}], value=>{
          if (crop || !crops.includes(value as Crop)) return;
          h.done.add(planted(value as Crop)); save();
          h.toast(['种好了。到花圃旁的手压泵放水。','Seeds sown. Work the pump beside the flower bed.']);
        });
    } else if (!ripeAt) h.toast(['土还是干的。到花圃旁的手压泵放水。','The soil is dry. Use the pump beside the flower bed.']);
    else if (!ripe) h.toast([`再过 ${Math.ceil((ripeAt-clock())/1000)} 秒就能采了。可以先去镇上转转。`,`Ready in ${Math.ceil((ripeAt-clock())/1000)} seconds. There is time for a walk.`]);
    else {
      const harvest=crop;
      if (h.done.has(ingredient(harvest))) {h.toast(['厨房还存着上次的收成。先用掉那份，这茬可以留在地里。','The kitchen still has the last harvest. Cook it first. This crop will keep in the bed.']);return;}
      ask(id,harvest==='mint'?['掐一片叶子，手指上全是薄荷香。','One pinched leaf leaves mint on your fingertips.']:['橘色的根肩已经顶出了土。','Orange carrot shoulders show above the soil.'],
        [{id:'harvest',label:harvest==='mint'?['剪薄荷，留到自家厨房泡茶','Cut mint for your kitchen']:['拔胡萝卜，留到自家厨房烤面包','Pull carrots for your kitchen']}],value=>{
          if (value!=='harvest'||crop!==harvest||!ripe||h.done.has(ingredient(harvest))) return;
          h.done.delete(planted(harvest)); h.done.delete(deadlinePrefix+ripeAt); h.done.add(ingredient(harvest));
          h.done.add('home_first_harvest'); save();
          h.toast(['收成已收好。回主角的家，在一楼炉台边做菜。','Harvest stored. Use the downstairs stove in your home.']);
        });
    }
  }
  function cook(id: string) {
    const available=crops.filter(c=>h.done.has(ingredient(c))&&!h.done.has(packed(c)));
    if (!available.length) {
      h.toast(crops.some(c=>h.done.has(ingredient(c))&&h.done.has(packed(c)))?
        ['上回打包的那份还在。薄荷茶送咖啡馆，胡萝卜面包卷送面包房，再来做下一炉。','Deliver the last packed serving first. Take tea to the cafe or rolls to the bakery.']:
        ['篮子里还没有食材。南岸花园的木框菜畦可以种薄荷和胡萝卜。','The basket is empty. Sow mint or carrots in the raised bed at South Garden.']);return;
    }
    ask(id,['炉火温着。桌上留一份，再给街坊包一份。','The stove is warm. Set one serving on the table and wrap another for a neighbour.'],
      available.map(c=>({id:c,label:cookLabel[c]})),value=>{
        const c=available.find(item=>item===value);
        if (!c||!h.done.has(ingredient(c))||h.done.has(packed(c))) return;
        h.done.delete(ingredient(c)); for (const other of crops) h.done.delete(served(other));
        h.done.add(served(c)); h.done.add(packed(c)); h.done.add('home_first_cooking'); save();
        h.toast(c==='mint'?['茶壶摆上桌了。带上另一壶，去海风咖啡馆找夏。','Tea is on the table. Bring the second pot to Xia at Sea Breeze Cafe.']:['面包卷出炉了。包好的那份送到麦香面包房给安禾尝尝。','The rolls are out of the oven. Take the wrapped ones to Anhe at Morning Loaf.']);
      });
  }
  function give(id: string, c: Crop, other: Choice, useService: () => void) {
    if (!h.done.has(packed(c))) return false;
    ask(id,c==='mint'?['夏把两只杯子推过来。“我闻到薄荷了。是你种的？”','Xia slides two cups over. “Is that mint from your garden?”']:['安禾把烤盘挪开，腾出一小块柜台。“给我尝一个？”','Anhe clears a space on the counter. “May I try one?”'],
      [{id:'share',label:c==='mint'?['给夏倒杯薄荷茶','Pour Xia some mint tea']:['把面包卷分给安禾','Share the rolls with Anhe']},other],value=>{
        if (value===other.id) {useService();return;}
        if (value!=='share'||!h.done.delete(packed(c))) return;
        h.done.add(sharedRecipe(c)); save();
        h.toast(c==='mint'?['夏喝了一口，把泡茶时间写在杯垫背面送给你。','Xia takes a sip and writes her steeping time on a coaster for you.']:['安禾掰开一只，点了点头，把自己的烤温写给你。','Anhe breaks open a roll, nods, and writes down his oven temperature for you.']);
      });
    return true;
  }
  return {apply, water, collider, get thirsty(){return !!crop&&!ripeAt;}, tend, cook, give,
    update(){if (ripeAt&&!ripe&&clock()>=ripeAt) refreshGrowth();},
    dispose(){[bedBounds,wood,round,cylinder,handle].forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());}
  };
}
