// Actual decoded production accessor hashes, not source-string assertions.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
export async function snapshot(directory, region) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  const bytes = await readFile(resolve(directory,`world_${region}.glb`));
  const doc = await io.readBinary(bytes), root = doc.getRoot();
  const nodes = {};
  let artTriangles = 0, artPrimitives = 0;
  for(const node of root.listNodes()){
    const mesh = node.getMesh();
    const primitives = mesh?.listPrimitives().map(p=>{
      const attrs = {};
      for(const semantic of p.listSemantics()){
        const a=p.getAttribute(semantic),array=a.getArray();
        attrs[semantic]={type:a.getType(),componentType:a.getComponentType(),normalized:a.getNormalized(),count:a.getCount(),sha256:hash(Buffer.from(array.buffer,array.byteOffset,array.byteLength))};
      }
      const a=p.getIndices(),array=a?.getArray();
      const indices = a?{count:a.getCount(),sha256:hash(Buffer.from(array.buffer,array.byteOffset,array.byteLength))}:null;
      const triangles=(a?.getCount()??p.getAttribute('POSITION').getCount())/3;
      if(!node.getName().startsWith('COL_')){artTriangles+=triangles;artPrimitives++;}
      return {material:p.getMaterial()?.getName(),mode:p.getMode(),attributes:attrs,indices,triangles};
    });
    if(nodes[node.getName()])throw new Error(`duplicate node: ${node.getName()}`);
    nodes[node.getName()]={translation:node.getTranslation(),rotation:node.getRotation(),scale:node.getScale(),extras:node.getExtras(),children:node.listChildren().map(n=>n.getName()),...(primitives?{primitives}: {})};
  }
  const materials=root.listMaterials().map(m=>({name:m.getName(),color:m.getBaseColorFactor(),roughness:m.getRoughnessFactor(),metalness:m.getMetallicFactor(),alpha:m.getAlphaMode(),side:m.getDoubleSided(),extras:m.getExtras()}));
  return {sha256:hash(bytes),bytes:bytes.byteLength,layoutSha256:hash(await readFile(resolve(directory,`world_${region}.layout.json`))),artTriangles,artPrimitives,materials,nodes};
}
