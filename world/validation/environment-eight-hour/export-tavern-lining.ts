/** Authoritative small source geometry for append-only shipped GLB repair. */
import { tavernRoofUnderside } from '../../tools/gen/blacksail/architecture';
import { TAVERN, PORT } from '../../tools/gen/blacksail/layout';
import { writeFile } from 'node:fs/promises';
const output=process.argv[2];if(!output)throw Error('OUTPUT_JSON');
const b=tavernRoofUnderside(TAVERN.c[0],PORT.y,TAVERN.c[1],TAVERN.w,TAVERN.d);
if(b.col.length||b.vis.length!==1)throw Error('Expected one ART-only lining');
const g=b.vis[0];
await writeFile(output,JSON.stringify({name:b.name,material:b.material,positions:[...g.attributes.position.array],normals:[...g.attributes.normal.array],colors:[...g.attributes.color.array]},null,2)+'\n');
g.dispose();
