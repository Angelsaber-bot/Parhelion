import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {SIGNATURE_SKINS,signatureModelOf} from '../shared/signatureSkins.ts';
import {combatArt,disposeTree} from '../src/weapons/weaponArt.ts';
import {buildSignatureModel} from '../src/cosmetics/signatureModels.ts';
(globalThis as any).FileReader??=class{result:unknown;onloadend?:()=>void;readAsArrayBuffer(blob:Blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}};
const out=resolve(import.meta.dirname,'../../assets/weapons/structural_v1');await mkdir(out,{recursive:true});const models=[];
for(const skin of SIGNATURE_SKINS.filter(s=>signatureModelOf(s.id))){const def=combatArt(skin.weapon)!,instance=buildSignatureModel(def,skin.id,false)!;let triangles=0,meshes=0;instance.root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});const data=await new GLTFExporter().parseAsync(instance.root,{binary:true});if(!(data instanceof ArrayBuffer))throw Error('Expected binary GLB');const bytes=Buffer.from(data),file=skin.id+'.glb';await writeFile(resolve(out,file),bytes);const box=new THREE.Box3().setFromObject(instance.root);models.push({id:skin.id,weapon:skin.weapon,name:skin.zh,file,triangles,meshes,bounds:{min:box.min.toArray(),max:box.max.toArray()},sockets:{grip:def.grip,support:def.support,muzzle:def.muzzle,sight:def.sight},bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')});disposeTree(instance.root);}
await writeFile(resolve(out,'manifest.json'),JSON.stringify({schema:1,source:'arena-game/src/cosmetics/signatureModels.ts',coordinates:'+X forward, +Y up; same raw socket coordinates as the original weapon registry',runtime:'Constructed on demand by the same native builders; these editable exports are not extra runtime downloads.',models},null,2)+'\n');console.log(JSON.stringify(models.map(({id,triangles,meshes,bytes})=>({id,triangles,meshes,bytes}))));
