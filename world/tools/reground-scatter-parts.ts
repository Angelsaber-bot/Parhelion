import * as THREE from 'three';
/** Connected pieces of a merged batch (welded by position as well as by index). */
export function components(g:THREE.BufferGeometry):number[][] {
  const p=g.attributes.position,idx=g.index,n=p.count,parent=new Int32Array(n).map((_,i)=>i);
  const find=(a:number):number=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  const key=new Map<string,number>();
  for(let i=0;i<n;i++){const k=`${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;const e=key.get(k);if(e!==undefined)parent[find(i)]=find(e);else key.set(k,i);}
  const tri=idx?idx.count:n;for(let i=0;i<tri;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;parent[find(b)]=find(a);parent[find(c)]=find(a);}
  const groups=new Map<number,number[]>();for(let i=0;i<n;i++){const r=find(i);(groups.get(r)??groups.set(r,[]).get(r)!).push(i);}
  return [...groups.values()];
}
