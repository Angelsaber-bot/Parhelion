// Optional local authoring tool. Not part of the shipped lobby and never uploads anything.
import {build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await build({root,configFile:path.join(root,'vite.config.ts'),build:{outDir:'.scratch/map-review-build',rollupOptions:{input:path.join(root,'tools/map-review.html')}}});
const target=path.join(root,'../site/dist/public/arena/map-review');
await fs.cp(path.join(root,'.scratch/map-review-build'),target,{recursive:true});
console.log('Local inspection: http://127.0.0.1:4173/arena/map-review/tools/map-review.html');
