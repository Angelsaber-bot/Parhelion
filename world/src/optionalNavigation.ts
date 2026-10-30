import { getEraOptionalReward } from './eraStories';
import type { Point3 } from './combat';
export interface OptionalPin {
 kind: 'clue' | 'quiet-route' | 'trial';
 p: [number,number,number]; label: [string,string]; region: string; targetId?: string;
}
/** Optional guidance must disappear when its purpose ends, never outlive the world change. */
export function optionalPinExpired(pin:OptionalPin,region:string,position:Point3,done:ReadonlySet<string>,found:ReadonlySet<string>):boolean {
 if(pin.region!==region)return true;
 if(pin.targetId&&(done.has(pin.targetId)||found.has(pin.targetId)))return true;
 if(pin.kind==='quiet-route'&&pin.region==='kyoto'&&!getEraOptionalReward('kyoto',done))return true;
 if(pin.kind==='clue'&&pin.region==='blacksail'&&!getEraOptionalReward('blacksail',done))return true;
 return Math.hypot(position.x-pin.p[0],position.z-pin.p[2])<6;
}
