import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Node } from '@gltf-transform/core';

export const SCATTER_NODES = /^(Trees_Trunks|Trees_Leaves|Rocks|Bushes|COL_Props)/;
export const SEATING_RECORD = new URL('../validation/join-band-seating.edits.json', import.meta.url);

/** Vertex ranges belong to one mesh export, never merely to a region name. */
export function invalidateScatterSeating(id: string, path: URL = SEATING_RECORD) {
  if (!existsSync(path)) return;
  const record = JSON.parse(readFileSync(path, 'utf8'));
  if (!(id in record.regions)) return;
  record.regions[id] = {};
  if (record.appliedHashes) delete record.appliedHashes[id];
  writeFileSync(path, JSON.stringify(record));
}

export function scatterFingerprint(nodes: Node[]) {
  const hash = createHash('sha256');
  for (const node of nodes.filter(n => SCATTER_NODES.test(n.getName())).sort((a,b)=>a.getName().localeCompare(b.getName()))) {
    hash.update(node.getName()); hash.update(JSON.stringify(node.getWorldMatrix()));
    for (const primitive of node.getMesh()!.listPrimitives()) {
      for (const accessor of [primitive.getAttribute('POSITION'), primitive.getIndices()]) {
        if (!accessor) continue;
        const array = accessor.getArray()!;
        hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
      }
    }
  }
  return hash.digest('hex');
}
