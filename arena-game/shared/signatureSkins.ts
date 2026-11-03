import type {WeaponId} from './content.ts';

/** One authored identity per weapon. IDs and catalog positions are persistent. */
export const SIGNATURE_SKINS = [
  {weapon:'lumen',id:'tidal-engine',zh:'潮汐引擎',en:'Tidal Engine',body:0x123f50,accent:0x6ff3d0,trim:0xd5b878,metal:.68,rough:.28,iris:.12,description:['深海搪瓷、涡轮银环与贯穿机匣的潮汐导流槽。','Ocean enamel, turbine rings and flowing receiver channels.']},
  {weapon:'firefly',id:'night-courier',zh:'夜行快递',en:'Night Courier',body:0x592b8a,accent:0xd8fa45,trim:0xf4ab6b,metal:.26,rough:.32,iris:.38,description:['紫色竞速车漆、荧黄切片与只属于流萤的 07 号速度标。','Violet racing lacquer, acid-yellow cuts and Firefly’s 07 speed mark.']},
  {weapon:'corona',id:'dune-falcon',zh:'赤砂猎隼',en:'Dune Falcon',body:0x9b452e,accent:0xffc677,trim:0xd8a568,metal:.36,rough:.48,iris:0,description:['赤砂陶甲、黄铜隼翼与顺着护木展开的叠羽纹。','Red-dune ceramic, brass falcon wings and layered fore-end feathers.']},
  {weapon:'halo',id:'celadon-atlas',zh:'青瓷山海',en:'Celadon Atlas',body:0xd9eee2,accent:0x55c2b0,trim:0xc9ab67,metal:.12,rough:.24,iris:.18,description:['青瓷开片釉、翠色山峦与沿枪脊延伸的金线海潮。','Crackled celadon glaze, jade mountain ridges and a gilt sea along the spine.']},
  {weapon:'longnight',id:'abyssal-requiem',zh:'鲸落深蓝',en:'Abyssal Requiem',body:0x142d51,accent:0x8adefa,trim:0xa9c9d9,metal:.74,rough:.3,iris:.24,description:['深蓝钛金属、鲸骨银脊与低亮度生物荧光。','Abyss-blue titanium, a silver whale-bone spine and restrained bioluminescence.']},
  {weapon:'blade',id:'moonbite',zh:'蚀月',en:'Moonbite',body:0x322e49,accent:0xc2b5ff,trim:0xd8ddec,metal:.88,rough:.25,iris:.32,description:['黑曜叠锻钢、银色月牙护印与沿刃口弯行的蚀光。','Obsidian damascene steel, a silver crescent seal and an eclipsed cutting edge.']},
  {weapon:'polearm',id:'vermilion-plume',zh:'朱雀翎',en:'Vermilion Plume',body:0xb72d33,accent:0xffa762,trim:0xe4ba70,metal:.48,rough:.26,iris:.08,description:['朱漆长柄、鎏金羽脉与依枪尖走势展开的朱雀翎。','Vermilion lacquer, gilt feather veins and a phoenix plume shaped to the spearhead.']},
  {weapon:'hammer',id:'foundry-bell',zh:'熔城钟鸣',en:'Foundry Bell',body:0x46505b,accent:0xff913e,trim:0xbd8b51,metal:.82,rough:.46,iris:0,description:['铸铁钟壳、旧铜齿圈与藏进锤面的熔炉裂隙。','Cast-iron bell housing, aged bronze gearwork and recessed furnace seams.']},
] as const satisfies readonly {weapon:WeaponId;id:string;zh:string;en:string;body:number;accent:number;trim:number;metal:number;rough:number;iris:number;description:readonly[string,string]}[];
export type SignatureId=typeof SIGNATURE_SKINS[number]['id'];
export const signatureOf=(id?:string,weapon?:string)=>SIGNATURE_SKINS.find(s=>s.id===id&&(!weapon||s.weapon===weapon));
export const signatureFor=(weapon:string)=>SIGNATURE_SKINS.find(s=>s.weapon===weapon)!;
