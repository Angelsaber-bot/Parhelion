import * as THREE from 'three';

/** UI rate limiting never changes the game simulation or 3D frame rate. */
export class MapRefreshPolicy {
  private last = -Infinity;
  private x = NaN; private z = NaN; private yaw = NaN;
  private revision = ''; private visible = false;
  constructor(private interval = 1000 / 30) {}
  shouldDraw(now: number, x: number, z: number, yaw: number, revision: string, visible = true, animate = false) {
    if (!visible) { this.visible = false; return false; }
    const force = !this.visible || revision !== this.revision;
    this.visible = true;
    if (!force && now - this.last < this.interval) return false;
    if (!force && !animate && Math.abs(x-this.x) < .05 && Math.abs(z-this.z) < .05 && Math.abs(yaw-this.yaw) < .003) return false;
    this.last=now;this.x=x;this.z=z;this.yaw=yaw;this.revision=revision;return true;
  }
}
export function setTextIfChanged(element: { textContent: string | null }, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

/** Cache only immutable loaded model subtrees; replacing an outfit invalidates automatically. */
export class ReflectionMaterialCache {
  private roots = new WeakMap<THREE.Object3D, { children: THREE.Object3D[]; materials: THREE.MeshStandardMaterial[] }>();
  private bases = new WeakMap<THREE.Material, number>();
  update(root: THREE.Object3D, factor: number) {
    let entry=this.roots.get(root);
    if(!entry || entry.children.length!==root.children.length || entry.children.some((o,i)=>o!==root.children[i])) {
      const unique=new Set<THREE.MeshStandardMaterial>();
      root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const material of [o.material].flat()){
        const m=material as THREE.MeshStandardMaterial;if(m.envMap)unique.add(m);
      }});
      entry={children:[...root.children],materials:[...unique]};this.roots.set(root,entry);
    }
    for(const m of entry.materials){if(!this.bases.has(m))this.bases.set(m,m.envMapIntensity);const value=this.bases.get(m)!*factor;if(Math.abs(m.envMapIntensity-value)>.0001)m.envMapIntensity=value;}
  }
}

/** Actual browser frame/JS-submit observations. This is not a GPU timer. */
export class FrameMetrics {
  private frames=new Float64Array(240);private work=new Float64Array(240);private cursor=0;private count=0;
  record(frameSeconds:number,mainThreadMs:number,visibleFrame=true){
    if(!visibleFrame||!Number.isFinite(frameSeconds)||frameSeconds<=0||!Number.isFinite(mainThreadMs)||mainThreadMs<0)return;
    this.frames[this.cursor]=frameSeconds*1000;this.work[this.cursor]=mainThreadMs;this.cursor=(this.cursor+1)%240;this.count=Math.min(240,this.count+1);
  }
  summary(){
    if(!this.count)return {samples:0,fps:0,p95FrameMs:0,meanMainThreadMs:0};
    const f=Array.from(this.frames.subarray(0,this.count)).sort((a,b)=>a-b);
    let total=0,cpu=0;for(let i=0;i<this.count;i++){total+=this.frames[i];cpu+=this.work[i];}
    return {samples:this.count,fps:1000/(total/this.count),p95FrameMs:f[Math.ceil(this.count*.95)-1],meanMainThreadMs:cpu/this.count};
  }
}
