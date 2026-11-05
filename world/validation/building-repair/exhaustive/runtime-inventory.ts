import {bootWorldWithoutGpu} from '../../world-dom-boot.fixture.ts';
import {writeFileSync} from 'node:fs';
const h=await bootWorldWithoutGpu({deterministic:true});
try {await h.settleAssets();const w=h.world;h.frame(16);const rows:any[]=[];w.scene.traverse((o:any)=>{if(o.isGroup||o.isScene)rows.push({name:o.name,type:o.type,children:o.children.length,path:(()=>{const a=[];let p=o;while(p){if(p.name)a.push(p.name);p=p.parent;}return a.reverse().join('/');})(),userData:o.userData});});writeFileSync('/tmp/parhelion-exhaustive/runtime-groups.json',JSON.stringify(rows,null,2));console.log(rows.filter(x=>x.children>0).map(x=>`${x.path} (${x.children})`).join('\n'));}finally{await h.close();}
