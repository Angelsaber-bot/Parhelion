import * as THREE from 'three';
import { weaponFinish, type WeaponFinishId } from './weaponFinishes';
export const WEAPON_FINISH_PATTERN_SIZE = 128;
type SurveyLayer = 'base' | 'ink' | 'brass' | 'cyan';
/** An original optical instrument diagram: off-center sighting rings, a brass
 * indexing rail, two observation baselines and a clipped cyan meridian. No decals
 * or extra surfaces are attached; every mark lives inside the existing panel UVs. */
function surveyLayer(u: number, v: number): SurveyLayer {
  const near = (value: number, center: number, width: number) => Math.abs(value - center) < width;
  const dx = u - .65, dy = v - .5, radius = Math.hypot(dx, dy);
  // Unequal major/minor graduations make the narrow side rail read as an instrument.
  const row = Math.round((v - .2) / .075), tick = .2 + row * .075;
  if (row >= 0 && row <= 8 && near(v, tick, .006) && u >= .205 && u < (row % 2 ? .245 : .275)) return 'brass';
  if (near(u, .65, .007) && v > .225 && v < .35) return 'brass';
  if (near(radius, .045, .007) || (near(dy, 0, .006) && Math.abs(dx) < .07)) return 'brass';
  // The separated sighting baselines echo the courtyard's two observation points.
  if ((near(v, .79, .007) && u > .39 && u < .86)
    || (near(v, .735, .007) && u > .47 && u < .79)
    || (near(radius, .205, .007) && dx > -.035)
    || (near(u, .885, .007) && v > .42 && v < .58)) return 'cyan';
  if ((u > .07 && u < .19 && v > .13 && v < .87)
    || near(radius, .18, .006)
    || (near(v, .13, .005) && u > .07 && u < .89)
    || (near(v, .87, .005) && u > .07 && u < .89)) return 'ink';
  return 'base';
}
type CraftedLayer = 'base' | 'contrast' | 'metal' | 'accent' | 'highlight';
const near = (value:number,center:number,width:number)=>Math.abs(value-center)<width;
/** Three composed surface treatments. Broad fields survive narrow panel UVs;
 * smaller clasps, lettering rules and inlay facets reward a closer inspection.
 * They are opaque pigment only, not embossed geometry or emissive decals. */
function craftedLayer(id:WeaponFinishId,u:number,v:number,channel:'ivory'|'dark'):CraftedLayer {
 if(id==='guard-sash'){
  // A single diagonal sash, not an all-over crossing lattice. The small dark
  // panels receive its narrower continuation and omit the oversized clasp.
  const d=u-.62*v-.12,width=channel==='ivory'?.125:.082;
  const across=(u-.486)-.62*(v-.59),along=(v-.59)+.62*(u-.486);
  if(channel==='ivory'&&((Math.abs(across)<.167&&near(Math.abs(along),.079,.013))
   ||(near(Math.abs(across),.154,.013)&&Math.abs(along)<.092)
   ||(near(along,0,.009)&&Math.abs(across)<.158)))return 'metal';
  // An asymmetric engraved laurel sprig in the free upper corner.
  if(v>.13&&v<.47&&near(u,.814-.08*(v-.13),.004))return 'highlight';
  for(let i=0;i<4;i++)for(const side of[-1,1]){
   const cy=.17+i*.078,cx=.814-.08*(cy-.13)+side*.035;
   const x=(u-cx)*.82+(v-cy)*side*.57,y=-(u-cx)*side*.57+(v-cy)*.82;
   const r=Math.hypot(x/.034,y/.013);
   if(r>.63&&r<1.08)return 'highlight';
  }
  if(near(Math.abs(d),width,.009))return 'metal';
  if(Math.abs(d)<width){
   if(near(d,width*.48,.018))return 'accent';
   if(near(d,-width*.68,.004)&&((v+.018)%.055)<.027)return 'highlight';
   return 'contrast';
  }
  if(near(v,.91,.005)&&u>.65&&u<.92)return 'metal';
  return 'base';
 }
 if(id==='sealed-passage'){
  // Irregular wax edge, an inset seal and two short hanging ribbon tails.
  const dx=u-.77,dy=v-.69,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  if(r<.119+.006*Math.sin(angle*9)){
   if(near(r,.081,.005)&&!(angle>.2&&angle<.6))return 'metal';
   if((Math.abs(dx)<.021&&Math.abs(dy)<.048)||(near(dy,.018,.006)&&Math.abs(dx)<.05))return 'highlight';
   return 'accent';
  }
  if(v>.75&&v<.91&&((u>.695&&u<.73)||(u>.79&&u<.825))&&v<.93-Math.abs(u-.76)*.42)return 'accent';
  // Broken rectangular impression: a stamped contract, not a compass rose.
  if(u>.59&&u<.90&&v>.20&&v<.44){
   const border=(near(u,.61,.007)||near(u,.88,.007)||near(v,.22,.007)||near(v,.42,.007));
   if(border&&!((u>.71&&u<.765)||(v>.28&&v<.315)))return 'accent';
   if((near(v,.28,.005)&&u>.65&&u<.79)||(near(v,.35,.005)&&u>.71&&u<.84))return 'accent';
  }
  if((near(v,.115,.006)||near(v,.15,.004))&&u>.10&&u<.90)return 'metal';
  if(near(u,.10,.004)&&v>.115&&v<.88)return 'metal';
  const lengths=[.34,.27,.39,.30,.35,.24];
  for(let i=0;i<lengths.length;i++)if(near(v,.25+i*.077,.0045)&&u>.16&&u<.16+lengths[i])return 'contrast';
  if((near(v,.79,.005)&&u>.16&&u<.54)||(near(v,.825,.004)&&u>.16&&u<.42))return 'contrast';
  if(near(u,.558,.0035)&&v>.20&&v<.86)return 'highlight';
  return 'base';
 }
 if(id==='night-nacre'){
  // A deliberately uneven cluster of clipped fragments, not a tiled diamond
  // pattern. Each fragment has a restrained second facet within its silhouette.
  const shards=[
   [.20,.22,.088,.026,-.52],[.33,.32,.047,.078,.32],[.49,.43,.105,.035,-.38],
   [.60,.55,.048,.072,.55],[.72,.68,.099,.029,-.26],[.45,.67,.038,.064,-.45],
   [.28,.58,.066,.025,.28],[.78,.36,.031,.050,-.18],
  ];
  for(let i=0;i<shards.length;i++){
   const [cx,cy,w,h,rotation]=shards[i],dx=u-cx,dy=v-cy,c=Math.cos(rotation),s=Math.sin(rotation);
   const x=dx*c+dy*s,y=-dx*s+dy*c;
   if(Math.abs(x)<w&&Math.abs(y)<h&&Math.abs(x)/w+Math.abs(y)/h<1.73){
    if(near(y,-h,.007)||x/w+y/h>.55)return 'metal';
    return i%3===0?'highlight':i%3===1?'accent':'metal';
   }
  }
  for(const [x,y,length]of[[.13,.42,.12],[.39,.16,.08],[.58,.22,.11],[.82,.51,.10],[.66,.82,.085],[.20,.78,.075]]){
   if(v>y&&v<y+length&&near(u,x+.16*(v-y),.0035))return 'metal';
  }
  // One broken silver hairline balances the cluster's open corner.
  if(near(v,.91,.004)&&u>.56&&u<.88&&!(u>.68&&u<.74))return 'accent';
  return 'base';
 }
 return 'base';
}
const crafted=(id:WeaponFinishId)=>id==='guard-sash'||id==='sealed-passage'||id==='night-nacre';
/** Original authored weapon UVs receive restrained lacquer/etched marks. This changes
 * albedo only: no geometry, opacity, emissive gain, metalness or roughness advantage.
 * Regional identities remain recognizable in grayscale; the survey finish adds
 * separately colored instrument markings without logos or added meshes.
 */
export function weaponFinishPatternInk(id: WeaponFinishId, u: number, v: number): boolean {
  u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
  const line = (value: number, center: number, width: number) => Math.abs(value-center) < width;
  if (crafted(id)) return craftedLayer(id,u,v,'ivory')!=='base';
  if (id === 'survey') return surveyLayer(u, v) !== 'base';
  if (id === 'signal') { const x=u%.25; return x<.014||(x>.035&&x<.046)||(u>.3&&u<.7&&line(v,.5,.012)); }
  if (id === 'oath') return ((u+v)%.4)<.024||((u-v+2)%.4)<.010;
  if (id === 'tide') { const wave=.045*Math.sin(u*Math.PI*4); return ((v-wave+2)%.25)<.027; }
  if (id === 'frost') return ((u+v)%.5)<.014||((u-v+2)%.5)<.014;
  if (id === 'ember') return ((u-v*.28+2)%.32)<.027||((u-v*.28+2)%.32)>.308;
  return false;
}
export function makeWeaponFinishPattern(id: WeaponFinishId, channel: 'ivory'|'dark' = 'ivory'): THREE.DataTexture {
  const size=WEAPON_FINISH_PATTERN_SIZE,data=new Uint8Array(size*size*4);
  const palette=weaponFinish(id)?.colors;
  const rgb=(hex:string)=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  const base=rgb(palette?.[channel]??'#ffffff'),accent=rgb(palette?.[channel==='ivory'?'dark':'copper']??'#aaaaaa');
  const ink=base.map((value,index)=>Math.round(value+(accent[index]-value)*(channel==='ivory'?.62:.85)));
  const surveyColors:Record<SurveyLayer,number[]>={base,ink:rgb(palette?.[channel==='ivory'?'dark':'ivory']??'#aaaaaa'),brass:rgb(palette?.copper??'#aaaaaa'),cyan:rgb(palette?.glow??'#aaaaaa')};
  const craftedColors:Record<CraftedLayer,number[]>={
    base:id==='guard-sash'?rgb(palette!.dark):base,
    contrast:rgb(palette?.[id==='guard-sash'?'ivory':channel==='ivory'?'dark':'ivory']??'#aaaaaa'),
    metal:rgb(palette?.copper??'#aaaaaa'),accent:rgb(palette?.glow??'#aaaaaa'),highlight:rgb(palette?.amber??'#aaaaaa'),
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size;
    const color=crafted(id)?craftedColors[craftedLayer(id,u,v,channel)]:id==='survey'?surveyColors[surveyLayer(u,v)]:(weaponFinishPatternInk(id,u,v)?ink:base),index=(y*size+x)*4;
    data[index]=color[0];data[index+1]=color[1];data[index+2]=color[2];data[index+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name=`JourneyFinish_${id}_${channel}`;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
