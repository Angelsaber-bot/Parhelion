// Reversible record of the continental join-band prop seating (tools/reground-scatter.ts).
// Only the Y component of listed vertices changes, by whole int16 steps per vertex range.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {Node} from '@gltf-transform/core';
export type SeatingEdits={reason:string;band:number;regions:Record<string,Record<string,[number,[number,number][]][]>>;appliedHashes?:Record<string,string>};
export const seating:SeatingEdits=JSON.parse(readFileSync(new URL('./join-band-seating.edits.json',import.meta.url),'utf8'));
/** Shift the listed Y values of int16 POSITION arrays (sign -1 restores the reviewed bytes). */
export function shiftPositions(edits:[number,[number,number][]][],array:Int16Array,sign:1|-1) {
  for(const [dq,ranges] of edits)for(const [a,b] of ranges)for(let v=a;v<=b;v++)array[v*3+1]+=sign*dq;
}
export function applySeating(region:Record<string,[number,[number,number][]][]>,nodes:Node[],sign:1|-1) {
  for(const node of nodes){const edits=region[node.getName()];if(!edits)continue;
    const acc=node.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!,array=(acc.getArray() as Int16Array).slice();
    shiftPositions(edits,array,sign);acc.setArray(array);}
}
/** sha256 of a node's POSITION bytes with the seating reversed: equals the reviewed accessor hash. */
export function unseatedHash(region:string,name:string,array:Int16Array):string {
  const copy=array.slice();shiftPositions(seating.regions[region]?.[name]??[],copy,-1);
  return createHash('sha256').update(Buffer.from(copy.buffer,copy.byteOffset,copy.byteLength)).digest('hex');
}
/** Path of a temporary copy of a tile GLB with the seating reversed (for decoded-geometry baselines). */
export async function unseatedGlbPath(path:string,region:string):Promise<string> {
  const [{NodeIO},{ALL_EXTENSIONS,EXTMeshoptCompression},{MeshoptEncoder,MeshoptDecoder},{tmpdir},{join},{writeFileSync}]=await Promise.all([
    import('@gltf-transform/core'),import('@gltf-transform/extensions'),import('meshoptimizer'),import('node:os'),import('node:path'),import('node:fs')]);
  await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const doc=await io.read(path);applySeating(seating.regions[region]??{},doc.getRoot().listNodes(),-1);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const out=join(tmpdir(),`parhelion-unseated-${region}-${process.pid}.glb`);writeFileSync(out,await io.writeBinary(doc));return out;
}
