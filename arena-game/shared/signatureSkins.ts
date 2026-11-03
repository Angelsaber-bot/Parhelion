import type {WeaponId} from './content.ts';

export interface SignatureStyle {weapon:WeaponId;id:string;zh:string;en:string;body:number;accent:number;trim:number;metal:number;rough:number;iris:number;shadow?:number;inlay?:number;model?:'maw'|'butterfly'|'bamboo'|'confection';description:readonly[string,string]}
/** Curated, weapon-exclusive identities. Persistence uses stable IDs, never catalog positions. */
export const SIGNATURE_SKINS = [
  {weapon:'lumen',id:'tidal-engine',zh:'潮汐引擎',en:'Tidal Engine',body:0x123f50,accent:0x6ff3d0,trim:0xd5b878,metal:.68,rough:.28,iris:.12,description:['深海搪瓷、涡轮银环与贯穿机匣的潮汐导流槽。','Ocean enamel, turbine rings and flowing receiver channels.']},
  {weapon:'halo',id:'celadon-atlas',zh:'青瓷山海',en:'Celadon Atlas',body:0xd9eee2,accent:0x55c2b0,trim:0xc9ab67,metal:.12,rough:.24,iris:.18,description:['青瓷开片釉、翠色山峦与沿枪脊延伸的金线海潮。','Crackled celadon glaze, jade mountain ridges and a gilt sea along the spine.']},
  {weapon:'longnight',id:'abyssal-requiem',zh:'鲸落深蓝',en:'Abyssal Requiem',body:0x142d51,accent:0x8adefa,trim:0xa9c9d9,metal:.74,rough:.3,iris:.24,description:['深蓝钛金属、鲸骨银脊与低亮度生物荧光。','Abyss-blue titanium, a silver whale-bone spine and restrained bioluminescence.']},
  {weapon:'polearm',id:'vermilion-plume',zh:'朱雀翎',en:'Vermilion Plume',body:0xb72d33,accent:0xffa762,trim:0xe4ba70,metal:.48,rough:.26,iris:.08,description:['朱漆长柄、鎏金羽脉与依枪尖走势展开的朱雀翎。','Vermilion lacquer, gilt feather veins and a phoenix plume shaped to the spearhead.']},
  {weapon:'hammer',id:'foundry-bell',zh:'熔城钟鸣',en:'Foundry Bell',body:0x46505b,accent:0xff913e,trim:0xbd8b51,metal:.82,rough:.46,iris:0,description:['铸铁钟壳、旧铜齿圈与藏进锤面的熔炉裂隙。','Cast-iron bell housing, aged bronze gearwork and recessed furnace seams.']},
  {weapon:'lumen',id:'amber-apiary',zh:'琥珀蜂巢',en:'Amber Apiary',body:0xe6bd56,accent:0xffe5a2,trim:0x8b6539,metal:.42,rough:.34,iris:.08,inlay:0x443a29,description:['琥珀树脂、蜂巢护甲与沿散热窗排列的六边金网。','Amber resin, honeycomb armor and hexagonal brasswork around the cooling slots.']},
  {weapon:'firefly',id:'mint-arcade',zh:'薄荷街机',en:'Mint Arcade',body:0x83dac5,accent:0xff8fc4,trim:0xe8e8d8,metal:.12,rough:.34,iris:.2,shadow:0x486b73,inlay:0x794b83,description:['薄荷塑脂、奶油白边框与像素爱心、方向键图案。','Mint polymer, cream framing, pixel hearts and arcade direction keys.']},
  {weapon:'corona',id:'abyssal-maw',zh:'深渊巨口',en:'Abyssal Maw',body:0x204e45,accent:0xa8ed8a,trim:0xd9d3b9,metal:.32,rough:.47,iris:.08,inlay:0x142a30,model:'maw',description:['仿生双颚机匣、象牙齿列与分节泵动护木。','A biomorphic twin-jaw receiver, ivory teeth and a segmented pump-action fore-end.']},
  {weapon:'longnight',id:'velvet-thorn',zh:'绯夜蔷薇',en:'Velvet Thorn',body:0x632d43,accent:0xec88aa,trim:0xc79688,metal:.48,rough:.27,iris:.15,inlay:0x242638,description:['绯红丝绒漆、玫瑰金蔷薇与绕着长机匣攀行的刺枝。','Burgundy velvet lacquer, a rose-gold bloom and thorned branches climbing the long chassis.']},
  {weapon:'blade',id:'prismwing',zh:'琉光蝶刃',en:'Prismwing',body:0xbdb5e9,accent:0x82e2da,trim:0xcbdfea,metal:.46,rough:.25,iris:.68,shadow:0x39436b,inlay:0x5a598b,model:'butterfly',description:['细长晶刃、蝶翼护手与紫晶握柄。','A slender crystal blade, sculpted butterfly guard and an amethyst grip.']},
  {weapon:'polearm',id:'ink-bamboo',zh:'玄竹',en:'Ink Bamboo',body:0x244d44,accent:0x9bd0a0,trim:0xb5a374,metal:.23,rough:.43,iris:.05,shadow:0x172f2d,inlay:0x142c2b,model:'bamboo',description:['竹节长柄、双刃叶形枪尖与古铜束箍。','A segmented bamboo shaft, twin-edged leaf spearhead and antique-bronze collars.']},
  {weapon:'hammer',id:'sugar-crash',zh:'糖霜重击',en:'Sugar Crash',body:0xefc5d9,accent:0x8fdbc8,trim:0xe9dfc6,metal:.08,rough:.38,iris:.12,shadow:0x876b82,inlay:0xc27895,model:'confection',description:['圆筒糖霜锤头、奶油旋纹与糖纸束结。','A round icing mallet, sculpted cream spirals and a wrapped-candy collar.']},
] as const satisfies readonly SignatureStyle[];
export type SignatureId=typeof SIGNATURE_SKINS[number]['id'];
export const signatureOf=(id?:string,weapon?:string)=>SIGNATURE_SKINS.find(s=>s.id===id&&(!weapon||s.weapon===weapon));
export const signatureFor=(weapon:string)=>SIGNATURE_SKINS.find(s=>s.weapon===weapon)!;
export const signaturesFor=(weapon:string)=>SIGNATURE_SKINS.filter(s=>s.weapon===weapon);
export const signatureModelOf=(id?:string,weapon?:string)=>(signatureOf(id,weapon) as SignatureStyle|undefined)?.model;
