import {Batch} from './geo.js';
/** Seat a fixed building on sloping terrain without moving its original walls,
 * doors or quest anchors. Dedicated callers export matching physical proxies. */
export function addGroundFooting(batch:Batch,x:number,y:number,z:number,ry:number,w:number,d:number,heightAt:(x:number,z:number)=>number,color:string) {
  let low=y;
  for(const u of[-.5,-.25,0,.25,.5])for(const v of[-.5,-.25,0,.25,.5]) {
    const xx=x+Math.cos(ry)*u*w+Math.sin(ry)*v*d,zz=z-Math.sin(ry)*u*w+Math.cos(ry)*v*d;
    low=Math.min(low,heightAt(xx,zz));
  }
  if(y-low<.12)return false;
  // Bury the lower edge so terrain interpolation/GLB quantization cannot leave
  // daylight. The 4 cm rim stays inside the house's existing frontage setback.
  batch.box(x,low-.16,z,w+.08,y-low+.20,d+.08,color,ry);
  return true;
}
