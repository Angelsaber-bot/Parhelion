import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';

/** Meshopt may rotate (a,b,c) to (b,c,a). Preserve ordered triangles and winding,
 * while ignoring only that semantically identical starting corner. */
export async function triangleIndexProof(bytes:Uint8Array){
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 const doc=await io.readBinary(bytes),result:Record<string,(string|null)[]>={};
 for(const node of doc.getRoot().listNodes())if(node.getMesh())result[node.getName()]=node.getMesh()!.listPrimitives().map(p=>{
  const index=p.getIndices();if(!index)return null;
  const values=Uint32Array.from(index.getArray()!);
  if(p.getMode()===4)for(let i=0;i<values.length;i+=3){
   const a=values[i],b=values[i+1],c=values[i+2];
   let x=a,y=b,z=c;
   if(b<x||(b===x&&(c<y||(c===y&&a<z)))){x=b;y=c;z=a;}
   if(c<x||(c===x&&(a<y||(a===y&&b<z)))){x=c;y=a;z=b;}
   values[i]=x;values[i+1]=y;values[i+2]=z;
  }
  return createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex');
 });
 return result;
}
