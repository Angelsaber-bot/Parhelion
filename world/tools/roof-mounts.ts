/** Rebuild the region-local footing table from exactly the visual GLBs used by streaming. */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { regionLoader, bakeQuantized } from '../src/rendering/glb';
import buildings from '../src/map/building-variety.json';

const hosts: Record<string, string[]> = {
  egypt: ['egypt_OasisTown'], orleans: ['orleans_RiverTown'], qin: ['qin_ArtisanTown'],
  winter: ['Moscow_WinterSnow'], kyoto: ['Rakuchu', 'Rakuchu_B'],
};
interface House { position: number[]; width: number; depth: number; rotation: number; family?: string; }
interface Lot { id: number; x: number; z: number; yaw: number; min: number; max: number; points: number[][]; }
export interface RoofMount { id: number; host: string; x: number; z: number; yaw: number; low: number; high: number; }
const round = (n: number) => Math.round(n * 1000) / 1000;

function lots(region: string, scene: THREE.Object3D): Lot[] {
  if (region === 'kyoto') return buildings.rows.flatMap(([r, variant, x0, y0, z0, x1, y1, z1], id) => {
    const w = x1 - x0, d = z1 - z0;
    if (r !== buildings.regions.indexOf(region) || Math.min(w, d) < 4) return [];
    const u = variant % 2 ? .28 : .72, v = variant % 3 ? .3 : .7;
    return [{ id, x: x0, z: z0, yaw: 0, min: y0 + .78 * (y1-y0), max: y1 + 4,
      points: [[u,v],[1-u,v],[u,1-v],[1-u,1-v]].map(([a,b])=>[w*a,d*b]) }];
  });
  if (region === 'winter') {
    const homes: { id: number; burnt: boolean; family: string; p: number[]; size: number[] }[] =
      scene.getObjectByName('Moscow_WinterTimber')!.userData.architectureManifest;
    return homes.filter(h => !h.burnt && ['warehouse','service_courtyard'].includes(h.family)).map(h => {
      const [x, y, z] = h.p, [w, height, d] = h.size;
      // The courtyard roof covers the store at the rear and the two narrow wings. The centre is open.
      const radius = Math.min(w,d) * (h.family === 'warehouse' ? .25 : .37);
      return { id: h.id, x, z, yaw: 0, min: y + height*.86, max: y + height + 2.5,
        points: Array.from({length:16}, (_,i)=>[Math.cos(i*Math.PI/8)*radius,Math.sin(i*Math.PI/8)*radius]) };
    });
  }
  const layout = JSON.parse(readFileSync(new URL(`../public/assets/world_${region}.layout.json`, import.meta.url), 'utf8'));
  return (layout.development.houses as House[]).flatMap(({position:[x,y,z],width:w,depth:d,rotation:yaw}, id) => {
    const family=id%6;
    if (region === 'orleans') {
      // These houses already have a masonry stack. Fit the actual coping and bridge its separate stone bed.
      const height=[11.5,8,6.8,12.8,5.8,9.8][family]+(family===3?5.4:family===2?3.1:4.6)+1.325;
      return [{id,x,z,yaw,min:y+height-.10,max:y+height+.10,points:[[(family%2?-1:1)*w*.28,-d*.2]]}];
    }
    // Egypt's dovecotes and existing wind towers retain their own silhouettes; some workshops get a
    // small passive outlet opposite the intake. The caravanserai has no intake and gets a sided hood.
    if (region==='egypt' && ![2,4,5].includes(family)) return [];
    // Qin smiths already vent their exterior forge. Keep those roofs and the ceremonial gate roof clear.
    if (region==='qin' && [1,5].includes(family)) return [];
    return [{id,x,z,yaw,min:y+(region==='egypt'?3.3:3.8),max:y+(region==='egypt'?4.45:10),
      points:[[.26,-.24],[-.26,-.24],[.26,.24],[-.26,.24]].map(([u,v])=>[w*u,d*v])}];
  });
}

export async function measureRoofMounts(region: string): Promise<RoofMount[]> {
  if (!hosts[region]) return [];
  const bytes = readFileSync(new URL(`../public/assets/world_${region}.visual.glb`, import.meta.url));
  const { scene } = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  bakeQuantized(scene);
  const surfaces = hosts[region].map(name=>{
    const mesh=scene.getObjectByName(name) as THREE.Mesh;
    return {name,bvh:new MeshBVH(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld))};
  });
  const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const result:RoofMount[]=[];
  for (const {id,x,z,yaw,min,max,points} of lots(region,scene)) {
    const cs=Math.cos(yaw),sn=Math.sin(yaw);
    search: for (const [u,v] of points) {
      const cx=round(x+u*cs+v*sn),cz=round(z-u*sn+v*cs);
      for(const {name,bvh} of surfaces) {
        const sample=(dx:number,dz:number,from:number)=>{
          ray.origin.set(cx+cs*dx+sn*dz,from,cz-sn*dx+cs*dz);
          return bvh.raycastFirst(ray,THREE.FrontSide);
        };
        const center=sample(0,0,max+4);
        if(!center?.face || center.face.normal.y<.62 || center.point.y<min || center.point.y>max) continue;
        const heights:number[]=[];
        for(const u of [-.39,0,.39]) for(const v of [-.39,0,.39]){
          const hit=sample(u,v,max+4);
          if(!hit?.face || hit.face.normal.y<.62 || hit.point.y<min || hit.point.y>max ||
            Math.abs(center.face.normal.dot(hit.point.clone().sub(center.point)))>.075) continue;
          heights.push(hit.point.y);
        }
        if(heights.length!==9)continue;
        let low=Math.min(...heights);const high=Math.max(...heights);
        if(high-low>.75 || ((region==='kyoto'||region==='qin') && high-low<.025))continue;
        if(region==='orleans'){
          const bed=sample(0,0,high-.29);
          if(!bed?.face || bed.face.normal.y<.98 || high-bed.point.y>.65)continue;
          low=bed.point.y;
        }
        result.push({id,host:name,x:cx,z:cz,yaw:round(yaw),low:round(low),high:round(high)});
        break search;
      }
    }
  }
  for(const {bvh} of surfaces)bvh.geometry.dispose();
  const materials=new Set<THREE.Material>();
  scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);}});
  for(const material of materials)material.dispose();
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const rows:Record<string,RoofMount[]>={};
  for(const region of Object.keys(hosts)){
    rows[region]=await measureRoofMounts(region);
    console.log(region,rows[region].length);
  }
  writeFileSync(new URL('../src/map/roof-mounts.json',import.meta.url),
    '{\n'+Object.entries(rows).map(([k,v])=>'  '+JSON.stringify(k)+': [\n'+v.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]').join(',\n')+'\n}\n');
}
