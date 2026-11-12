import type { Localized } from '../settlements/types';
import { VALLEY_PROLOGUE } from './valleyPrologue';

export const KYOTO_WITNESS = {
  reel: 'adventure_kyoto_witness_reel',
  stop: 'adventure_kyoto_witness_stop',
  cut: 'adventure_kyoto_witness_cut',
  winch: 'adventure_kyoto_witness_winch',
  pin: 'adventure_kyoto_witness_pin',
  testimony: 'adventure_kyoto_witness_testimony',
  public: 'adventure_kyoto_witness_public',
  private: 'adventure_kyoto_witness_private',
  gate: 'adventure_kyoto_witness_gate',
} as const;
export type KyotoWitnessAction = typeof KYOTO_WITNESS[keyof typeof KYOTO_WITNESS];
const Y = KYOTO_WITNESS;

export const kyotoWitnessActive = (done: ReadonlySet<string>) => done.has(Y.reel) ||
  (done.has(VALLEY_PROLOGUE.room) && !done.has('fire_core') && !done.has('musashi_contract'));
export const kyotoRollStopped = (done: ReadonlySet<string>) => done.has(Y.stop) || done.has(Y.cut);
export const kyotoHoistLowered = (done: ReadonlySet<string>) => done.has(Y.winch) || done.has(Y.pin);
export const kyotoOrdersDelivered = (done: ReadonlySet<string>) => done.has(Y.public) || done.has(Y.private);
export const kyotoWitnessReady = (done: ReadonlySet<string>) => !kyotoWitnessActive(done) || kyotoOrdersDelivered(done);
export const kyotoWitnessGateReady = (done: ReadonlySet<string>) => !kyotoWitnessActive(done) || done.has(Y.gate);

export const KYOTO_WITNESS_LABELS: Record<KyotoWitnessAction, Localized> = {
  [Y.reel]: ['传令台 · 对照原令和重写后的战报', 'Dispatch table · Compare the original order and the rewritten report'],
  [Y.stop]: ['送料轮 · 卡住印兵卷轴', 'Feed wheel · Jam the print-soldier scroll'],
  [Y.cut]: ['射断送料皮带', 'Shoot the feed belt'],
  [Y.winch]: ['运纸台 · 手轮降下证人', 'Paper lift · Lower the witness by hand'],
  [Y.pin]: ['射断吊台保险销', 'Shoot the platform safety pin'],
  [Y.testimony]: ['阿纪 · 对照证词与誊令簿', 'Aki · Compare testimony and the copied register'],
  [Y.public]: ['街钟台 · 公开原令和撤令', 'Street bell · Publish the orders and correction'],
  [Y.private]: ['交接台 · 交给双方副官', 'Handover table · Give the order to both officers'],
  [Y.gate]: ['本能寺外院 · 拉开防火屏', 'Honnō-ji outer court · Raise the fire screen'],
};
export const KYOTO_WITNESS_LINES: Record<KyotoWitnessAction, Localized> = {
  [Y.reel]: ['卷上已写好寺毁人亡，落款是幻日谷观测站。附近仍有人活着。先停掉继续印出这条命令的送料轮。','The report declares the temple destroyed and its witnesses dead. It bears the Valley Observatory stamp. People are still alive here. Stop the wheel printing the order.'],
  [Y.stop]: ['送料轮停住了，原令副本已保留。去旁边运纸台接回还活着的抄写人。','The feed wheel stops. The original copy is safe. Reach the lift and get the living copyist down.'],
  [Y.cut]: ['皮带断了，卷轴停止送料。先前读到的副本还在。','The belt snaps and the press stops. The copy you read is safe.'],
  [Y.winch]: ['平台降到河岸。等阿纪脚下站稳，再核对誊令簿。','The platform lowers to the riverbank. Let Aki reach the ground, then compare the register.'],
  [Y.pin]: ['保险销断开，平台沿导架回落到河岸。','The safety pin breaks and the platform lowers along its guides.'],
  [Y.testimony]: ['阿纪指出鸦印改过的行。公开更正会让街坊立即看到，也会暴露证人的姓名。定向交接保护姓名，只有双方副官先收到撤令。','Aki points to the lines the Crow Seal amended. Publishing the correction informs the street and reveals the witness names. A direct handover protects the names and reaches the two officers first.'],
  [Y.public]: ['街钟响了。印出的更正和原令留在公开阅示架上，双方副官收到同一份撤令。','The street bell rings. The correction and original are on the public stand. Both officers receive the same ceasefire order.'],
  [Y.private]: ['双方副官在同一张桌上签收撤令。证人姓名封存，水门侧路交给你使用。','Both officers receive the order at the same table. Witness names are sealed and the water-gate route is opened for you.'],
  [Y.gate]: ['防火屏升起。屏后的人仍然活着，而接收器仍在报本能寺已毁。带走这两份互相矛盾的记录。','The fire screen rises. People behind it are alive while the receiver still reports the temple destroyed. Take both accounts.'],
};

export function kyotoWitnessActionReady(id: KyotoWitnessAction, done: ReadonlySet<string>) {
  if (!kyotoWitnessActive(done) || done.has(id) || !done.has('musashi_meet')) return false;
  if (id === Y.gate) return kyotoOrdersDelivered(done) && done.has('fire_core');
  if (done.has('fire_core') || done.has('musashi_contract')) return false;
  if (id === Y.reel) return [1, 2, 3].every(n => done.has('kikyo_banner_' + n));
  if (!done.has(Y.reel)) return false;
  if (id === Y.stop || id === Y.cut) return !kyotoRollStopped(done);
  if (id === Y.winch || id === Y.pin) return kyotoRollStopped(done) && !kyotoHoistLowered(done);
  if (id === Y.testimony) return kyotoHoistLowered(done);
  return done.has(Y.testimony) && !kyotoOrdersDelivered(done);
}
