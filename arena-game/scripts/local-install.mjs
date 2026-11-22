import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function sourceFingerprint(arena){
  const sum=createHash('sha256');
  async function walk(dir,label){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name,'en'))){const name=label+'/'+entry.name,file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file,name);else if(entry.isFile())sum.update(name+'\0'+hash(await fs.readFile(file))+'\n');}
  }
  for(const dir of ['src','shared','server','scripts'])await walk(path.join(arena,dir),dir);
  for(const id of ['aster','homeward','camlann','blackflag','frostcourt','sakura','lishan','suntemple','orleans','range']){
    await walk(path.join(arena,'../arena-maps',id,'runtime'),'maps/'+id+'/runtime');
    const assets=path.join(arena,'../arena-maps',id,'assets');
    let entries=[];try{entries=await fs.readdir(assets);}catch(e){if(e.code!=='ENOENT')throw e;}
    for(const file of entries.filter(f=>f.endsWith('.glb')).sort())sum.update('maps/'+id+'/'+file+'\0'+hash(await fs.readFile(path.join(assets,file)))+'\n');
  }
  for(const file of ['../arena/runtime/map.json','../arena/assets/station_visual.glb','index.html','package.json','vite.config.ts','../site/scripts/server.ts','../site/scripts/http.mjs','../site/scripts/game-build.mjs','../arena-maps/homeward/runtime/map.json','../arena-maps/homeward/assets/homeward_visual.glb']){try{sum.update(file+'\0'+hash(await fs.readFile(path.join(arena,file)))+'\n');}catch(e){if(e.code!=='ENOENT')throw e;}}
  return sum.digest('hex');
}
export async function localInstallCurrent(arena,site){
  try{
    const root=path.join(site,'dist'),build=JSON.parse(await fs.readFile(path.join(root,'build.json'),'utf8')),version=JSON.parse(await fs.readFile(path.join(root,'public/arena/arena-version.json'),'utf8'));
    if(version.sourceFingerprint!==await sourceFingerprint(arena)||version.rulesVersion!==build.arenaLocal?.rulesVersion)return false;
    const files=Object.entries(build.files??{}).filter(([name])=>name.startsWith('public/arena/')||name==='server.cjs');
    if(!files.some(([name])=>name==='public/arena/index.html')||!files.some(([name])=>name==='server.cjs'))return false;
    for(const [name,digest] of files)if(hash(await fs.readFile(path.join(root,name)))!==digest)return false;
    return true;
  }catch{return false;}
}
export async function ensureLocalArena(site){
  const arena=path.join(site,'..','arena-game');
  // Portable distributions without editable source retain the prebuilt-only launcher.
  try{await fs.access(path.join(arena,'src/main.ts'));await fs.access(path.join(arena,'node_modules'));}catch{return;}
  if(await localInstallCurrent(arena,site))return;
  console.log('Arena 安装包缺失、过期或被覆盖，正在从本机源码恢复；保留 World 构建。');
  const result=spawnSync(process.execPath,[path.join(arena,'scripts/build-local.mjs')],{cwd:arena,stdio:'inherit'});
  if(result.error||result.status!==0||!await localInstallCurrent(arena,site))throw Error('Arena 本地恢复失败；没有启动旧版。');
}
