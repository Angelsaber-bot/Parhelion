/**
 * Orleans' second ring: the land outside the walls and along both river banks.
 * Authored in the region's own frame (world = offset + local; Orleans is not turned).
 * Shared by the generator, the runtime scenes and the checks, so a landmark, the
 * moving wheel fitted to it and the path that reaches it can never drift apart.
 */
export type OutskirtsPoint2=readonly [number,number];
export const ORLEANS_OFFSET=[-720,-1440] as const;

/** Bridgehead fort on the south end of the merchant bridge; local +z points away from the river. */
export const ORLEANS_TOURELLES={x:-5.5,z:285.5,deck:14.2,yaw:Math.atan2(.356,.934)} as const;
/** Mid-river pier where the riverfront loop turns; local +z points upstream. */
export const ORLEANS_BRIDGE_MILL={x:-170,z:130,deck:14,yaw:Math.atan2(.5,.866),
  /** Undershot wheel hung beside the pier: frame-local centre, radius and width. */
  wheel:{x:-8.2,y:3.4,z:6,radius:4.2,width:2.2}} as const;
export const ORLEANS_VINEYARD={x:-130,z:311} as const;
export const ORLEANS_GRANGE={x:150,z:306} as const;
/** The tower mill faces the town; the sails turn in a plane across that heading. */
export const ORLEANS_WINDMILL={x:238,z:-204,yaw:Math.atan2(-.86,.5),hub:13.4,reach:4.4,sail:9.5} as const;
export const ORLEANS_BASTILLE={x:292,z:-6,half:21} as const;
/** Saint-Loup approach: excavated ditch and an independent west flank. */
export const ORLEANS_EAST_MOAT = { x: 292, z: 46, halfWidth: 15, halfDepth: 8, depth: 3.6 } as const;

/** Unpaved country lanes draped on the ground; they join the graded roads at grade. */
export const ORLEANS_COUNTRY_LANES:readonly {id:string;name:readonly [string,string];points:readonly OutskirtsPoint2[]}[]=[
  {id:'southbank',name:['南岸乡道','South bank lane'],points:[[-4,300],[-25,301],[-55,300],[-88,299],[-112,299],[-150,299],[-185,293],[-218,279],[-238,252],[-243,215],[-241,180],[-240,150],[-236,120],[-229,94]]},
  {id:'grange',name:['农庄小路','Grange track'],points:[[44,283],[62,292],[88,301],[118,305],[138,305]]},
  {id:'millhill',name:['风车坡道','Mill hill path'],points:[[182,-62],[198,-86],[214,-122],[226,-152],[233,-180],[236,-192]]},
  {id:'bastille',name:['营垒路','Bastille road'],points:[[303,145],[300,118],[296,88],[293,58],[292,34],[292,22]]},
  {id:'eastfields',name:['东郊连道','East fields path'],points:[[264,-8],[258,-40],[250,-80],[238,-118],[226,-152]]},
];

/** Strip fields: centre, size, turn and crop. Colours are painted into the ground itself. */
export const ORLEANS_FIELDS:readonly {x:number;z:number;w:number;d:number;a:number;crop:'wheat'|'plough'|'fallow'|'vine'}[]=[
  {x:-84,z:324,w:44,d:34,a:0,crop:'vine'},{x:-180,z:324,w:50,d:34,a:.05,crop:'vine'},
  {x:92,z:328,w:52,d:30,a:-.06,crop:'wheat'},{x:216,z:323,w:46,d:32,a:.08,crop:'plough'},
  {x:238,z:74,w:50,d:74,a:.12,crop:'wheat'},{x:236,z:-28,w:44,d:52,a:-.1,crop:'plough'},
  {x:300,z:-96,w:54,d:60,a:.2,crop:'fallow'},{x:188,z:-196,w:34,d:70,a:.1,crop:'wheat'},
];
/** Where the shadow passed over the grange: a burnt swath and three long gouges. */
export const ORLEANS_SCORCH={x:175,z:296,rx:34,rz:13,a:.3,
  claws:[[[150,297],[196,283]],[[153,303],[200,289]],[[156,309],[203,296]]] as readonly (readonly [OutskirtsPoint2,OutskirtsPoint2])[]} as const;
/** Loire sandbanks: centre, radii and turn; they stand just above the water. */
export const ORLEANS_SANDBARS:readonly {x:number;z:number;rx:number;rz:number;a:number}[]=[
  {x:104,z:245,rx:27,rz:6,a:-.1},{x:218,z:249,rx:18,rz:5,a:.05},{x:-222,z:-118,rx:18,rz:5,a:1.83},
];

export function fieldAt(x:number,z:number){
  for(const f of ORLEANS_FIELDS){
    const dx=x-f.x,dz=z-f.z,u=Math.cos(f.a)*dx-Math.sin(f.a)*dz,v=Math.sin(f.a)*dx+Math.cos(f.a)*dz;
    if(Math.abs(u)<=f.w/2&&Math.abs(v)<=f.d/2)return {field:f,u,v};
  }
  return null;
}
export function laneDistance(x:number,z:number):number{
  let best=Infinity;
  for(const lane of ORLEANS_COUNTRY_LANES)for(let i=1;i<lane.points.length;i++){
    const a=lane.points[i-1],b=lane.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return best;
}
/** How firmly the ground keeps its painted colour (fields, lanes, burnt swath) where it nears a neighbouring region. */
export function paintedGround(x:number,z:number):number{
  if(fieldAt(x,z))return 1;
  const ramp=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  let keep=1-ramp(1.4,4.2,laneDistance(x,z));
  const k=ORLEANS_SCORCH,dx=x-k.x,dz=z-k.z,u=Math.cos(k.a)*dx-Math.sin(k.a)*dz,v=Math.sin(k.a)*dx+Math.cos(k.a)*dz;
  keep=Math.max(keep,1-ramp(.5,1.3,Math.hypot(u/k.rx,v/k.rz)));
  for(const [a,b] of k.claws){
    const ex=b[0]-a[0],ez=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez)));
    keep=Math.max(keep,1-ramp(1.1,3,Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t)));
  }
  return keep;
}
