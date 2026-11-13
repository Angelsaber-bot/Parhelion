import type { AdventureAction } from './adventureSites';
import type { Localized } from '../settlements/types';
import { VALLEY_PROLOGUE } from './valleyPrologue';

export const kyotoStreetPoint = (x: number, y: number, z: number): [number, number, number] => [720 - x, y, -1440 - z];
const P = kyotoStreetPoint;
export const KYOTO_STREET = {
  cargo: 'adventure_kyoto_street_cargo', pin: 'adventure_kyoto_street_pin',
  envelope: 'adventure_kyoto_street_envelope', letter: 'adventure_kyoto_street_letter',
  dry: 'adventure_kyoto_street_dry', meal: 'adventure_kyoto_street_meal',
  templePermit: 'adventure_kyoto_street_temple_permit', campPermit: 'adventure_kyoto_street_camp_permit',
  templeRecord: 'adventure_kyoto_street_temple_record', campRecord: 'adventure_kyoto_street_camp_record',
  templeAlert: 'adventure_kyoto_street_temple_alert', campAlert: 'adventure_kyoto_street_camp_alert',
} as const;
const K = KYOTO_STREET;
export const KYOTO_STREET_IDS = new Set<string>(Object.values(K));
export const kyotoCargoDown = (done: ReadonlySet<string>) => done.has(K.cargo) || done.has(K.pin);
export const kyotoStreetActive = (done: ReadonlySet<string>) => done.has(K.envelope) || (done.has(VALLEY_PROLOGUE.room) && !done.has('fire_core') && !done.has('musashi_contract') && !done.has('adventure_kyoto_witness_reel'));
export const kyotoStreetReady = (done: ReadonlySet<string>) => !kyotoStreetActive(done) || (done.has(K.templeRecord) && done.has(K.campRecord));
export function kyotoStreetBlock(id: string, done: ReadonlySet<string>): Localized | null {
  if (id === K.letter && !done.has(K.envelope)) return ['先从三条桥东端的防水函匣取回原函；吊货和战斗都不会损坏它。', 'Collect the original letter from the waterproof case at the east end of Sanjō Bridge. Neither cargo nor combat can destroy it.'];
  if (([K.templePermit, K.campPermit, K.templeRecord, K.campRecord] as readonly string[]).includes(id) && !done.has(K.letter)) return ['先把原函带到河街纸铺，对照装订孔和货运编号。', 'Take the letter to the riverside paper shop and compare its binding holes and shipment number first.'];
  return null;
}
export const KYOTO_STREET_LINES: Record<string, Localized> = {
  [K.cargo]: ['吊货开始下降，落稳后会成为桥上的掩体。桥下装卸道一直开放，原函留在东端防水匣中。', 'The cargo lowers into cover on the bridge. The wharf bypass stays open, and the letter remains safe in the eastern case.'],
  [K.pin]: ['吊索保险销断开，缓降轮接住货物。退开落点，让吊货落成掩体。', 'The pin breaks and the lowering drum takes the load. Clear the landing zone so the cargo can settle into cover.'],
  [K.envelope]: ['原函已收好。去河街纸铺，请阿纪从装订孔与运单编号查它的来路。', 'The original letter is safe. Bring it to the riverside paper shop to trace its binding holes and shipment number with Aki.'],
  [K.letter]: ['装订孔早于战报上的墨迹，运单却把同一批纸送往本能寺和明智军阵。两处都要核对，先去哪边由你决定。正门可出示原函；侧路能提前绕入，但未获放行会留下警戒记录。', 'The binding holes predate the report’s ink. The shipment register sends the same paper batch to Honnō-ji and Akechi’s camp. Check both in either order. Show the letter at the front gates, or use the side paths; entering without clearance leaves an alert on record.'],
  [K.dry]: ['浸水纸页已经挂稳，外廊留出通道。晾纸是帮忙，不是验函的前置条件。', 'The wet pages are secured on the drying frame and the porch remains clear. Helping here is optional; it does not gate the letter inspection.'],
  [K.meal]: ['你在纸铺吃了一碗热食。阿纪把原函留在灯下，等你继续查验。', 'You eat a warm meal at the paper shop. Aki leaves the original under the light for your inspection.'],
  [K.templePermit]: ['寺方收验原函，外院正门放行。先前的闯入记录不会被抹去；内殿不在这份许可内。', 'The temple accepts the letter and opens the outer-court gate. Any earlier intrusion remains on record; this clearance does not include the inner hall.'],
  [K.campPermit]: ['军阵核对货号，正门放行。先前的闯入记录仍保留，许可只到辎重院。', 'The camp checks the cargo number and opens its gate. Earlier intrusion remains on record; clearance covers the supply court only.'],
  [K.templeRecord]: ['寺方收货簿仍有原始装订孔，战报宣称烧毁的这一页实际还在。副本已保存，可以继续去军阵核对。', 'The temple’s receipt retains its original binding holes. The page declared burned in the report still exists. Its copy is saved; the camp can be checked next.'],
  [K.campRecord]: ['军阵发货簿的编号与寺方同批，但撤令晚于“已毁”的战报。副本已保存，两处记录不会因访问顺序丢失。', 'The camp’s dispatch book names the same batch, but its recall follows the report of destruction. The copy is saved; visiting in either order preserves both records.'],
};
export const KYOTO_STREET_ACTIONS: readonly AdventureAction[] = [
  { id: K.cargo, region: 'kyoto', label: ['三条桥 · 缓降吊货作掩体', 'Sanjō Bridge · Lower cargo into cover'], p: P(134, 5.2, -75), seconds: 2, flag: K.cargo },
  { id: K.envelope, region: 'kyoto', label: ['桥东防水匣 · 取回原函', 'Eastern waterproof case · Recover the letter'], p: P(174, 5.2, -75), flag: K.envelope },
  { id: K.letter, region: 'kyoto', label: ['纸铺灯桌 · 核对装订孔与货号', 'Paper-shop light table · Compare binding and cargo number'], p: P(181.8, 6.25, 53), seconds: 2, flag: K.letter },
  { id: K.dry, region: 'kyoto', label: ['纸铺外廊 · 晾好浸水纸页', 'Drying porch · Hang the wet pages'], p: P(177, 6.25, 55), seconds: 2, flag: K.dry },
  { id: K.meal, region: 'kyoto', label: ['纸铺热食 · 坐下休息', 'Paper-shop meal · Take a rest'], p: P(181.9, 6.25, 58), flag: K.meal },
  { id: K.templePermit, region: 'kyoto', label: ['本能寺东门 · 出示原函', 'Honnō-ji east gate · Present the letter'], p: P(-43, 4.6, 48), flag: K.templePermit },
  { id: K.campPermit, region: 'kyoto', label: ['明智本阵 · 出示运单', 'Akechi camp · Present the cargo letter'], p: P(-213, 14, 163.8), flag: K.campPermit },
  { id: K.templeRecord, region: 'kyoto', label: ['本能寺外院 · 核对收货簿', 'Temple outer court · Read the receipt book'], p: P(-93, 4.6, 81), seconds: 2, flag: K.templeRecord },
  { id: K.campRecord, region: 'kyoto', label: ['明智辎重院 · 核对发货簿', 'Akechi supply court · Read the dispatch book'], p: P(-233, 14, 168), seconds: 2, flag: K.campRecord },
];
