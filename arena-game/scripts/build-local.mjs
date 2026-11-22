import { addHomeNavigation, bundleLocalServer } from '../../site/scripts/game-build.mjs';
import {sourceFingerprint} from './local-install.mjs';
// Update only the local Arena client and its shared-rules server. Never runs Git or a deployment.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build} from '../node_modules/esbuild/lib/main.js';
const arena=path.dirname(path.dirname(fileURLToPath(import.meta.url))),repo=path.dirname(arena),site=path.join(repo,'site'),dist=path.join(site,'dist');
async function list(dir,prefix=''){const out=[];for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){if(e.isSymbolicLink())throw Error('Refusing symbolic build input');const n=prefix+e.name;if(e.isDirectory())out.push(...await list(path.join(dir,e.name),n+'/'));else out.push(n);}return out;}
const digest=b=>createHash('sha256').update(b).digest('hex');
async function hashes(dir){const out={};for(const f of await list(dir))out[f]=digest(await fs.readFile(path.join(dir,f)));return out;}
async function main(){
 await fs.access(path.join(dist,'public/world/index.html'));
 const worldBefore=await hashes(path.join(dist,'public/world'));
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:arena,stdio:'inherit'});if(result.error||result.status!==0)throw Error('Arena build failed');
 await fs.mkdir(path.join(arena,'.scratch'),{recursive:true});
 const stage=await fs.mkdtemp(path.join(arena,'.scratch/local-build-'));
 await build({stdin:{contents:"export {RULES_VERSION} from './shared/protocol.ts';export {CONTENT_MANIFEST} from './shared/manifest.ts';export {CHARACTERS,PLAYABLE_HERO_INDICES} from './shared/content.ts';",resolveDir:arena,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:path.join(stage,'version.mjs'),logLevel:'silent'});
 const {RULES_VERSION,CONTENT_MANIFEST,CHARACTERS,PLAYABLE_HERO_INDICES}=await import(pathToFileURL(path.join(stage,'version.mjs')).href);
 const version={sourceFingerprint:await sourceFingerprint(arena),rulesVersion:RULES_VERSION,contentManifest:CONTENT_MANIFEST,heroes:PLAYABLE_HERO_INDICES.map(i=>CHARACTERS[i].id),localOnly:true};
 await fs.writeFile(path.join(arena,'dist/arena-version.json'),JSON.stringify(version,null,2)+'\n');
 await fs.cp(path.join(arena,'dist'),path.join(stage,'arena'),{recursive:true});
 await addHomeNavigation(path.join(stage, 'arena', 'index.html'));
 await bundleLocalServer(stage);
 if(JSON.stringify(worldBefore)!==JSON.stringify(await hashes(path.join(dist,'public/world'))))throw Error('World output changed during preparation; run again after that build finishes.');
 const target=path.join(dist,'public/arena');await fs.cp(target,path.join(stage,'previous-arena'),{recursive:true});
 const previous=await fs.readFile(path.join(dist,'build.json'));for(const name of ['server.cjs','server.cjs.LEGAL.txt'])await fs.copyFile(path.join(dist,name),path.join(stage,'previous-'+name));
 try{
  await fs.rm(target,{recursive:true,force:true});await fs.rename(path.join(stage,'arena'),target);
  for(const name of ['server.cjs','server.cjs.LEGAL.txt'])await fs.copyFile(path.join(stage,name),path.join(dist,name));
  const files=await hashes(dist);delete files['build.json'];const combined=createHash('sha256');for(const name of Object.keys(files).sort())combined.update(name+'\0'+files[name]+'\n');
  const old=JSON.parse(previous);const manifest={...old,buildId:combined.digest('hex'),files,arenaLocal:version};await fs.writeFile(path.join(dist,'build.json'),JSON.stringify(manifest,null,2)+'\n');
  if(JSON.stringify(worldBefore)!==JSON.stringify(await hashes(path.join(dist,'public/world'))))throw Error('Concurrent World output change; Arena install rolled back.');
  console.log(JSON.stringify({installed:target,buildId:manifest.buildId,...version,worldFilesPreserved:Object.keys(worldBefore).length,backup:stage},null,2));
 }catch(error){await fs.rm(target,{recursive:true,force:true});await fs.cp(path.join(stage,'previous-arena'),target,{recursive:true});for(const name of ['server.cjs','server.cjs.LEGAL.txt'])await fs.copyFile(path.join(stage,'previous-'+name),path.join(dist,name));await fs.writeFile(path.join(dist,'build.json'),previous);throw error;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
