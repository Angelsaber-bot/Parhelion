// Conservative AABB screen of editable decoration against all authored route centres.
const fs=require('fs'),assert=require('assert'),P=require('../runtime/physics.js'),m=require('../runtime/map.json'),bounds=require('./model_bounds.json');
let samples=0,hits=[],certifiedSurfaceDetails=0;
const certified=new Set();
for(const d of bounds.details){
 const ramp=m.objects.find(o=>o.type==='ramp'&&d.name.startsWith(o.id+'_tread'));
 if(!ramp)continue;
 const axis=ramp.axis==='x'?0:2,L=ramp.size[axis],c=ramp.position[axis];
 const lowHeight=Math.min(...[d.min[axis],d.max[axis]].map(v=>ramp.size[1]*(1-((v-c)/(L/2))*ramp.lowAt)/2));
 assert(d.max[1]-lowHeight<.06,'Ramp tread protrusion exceeds 6cm: '+d.name);certified.add(d.name);certifiedSurfaceDetails++;
}
for(const route of m.routes)for(let k=1;k<route.points.length;k++){
 const a=route.points[k-1],b=route.points[k],length=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil(length/.1);
 for(let i=0;i<=n;i++){
  const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,y=P.ground(m,x,z,Math.max(a[1],b[1]));samples++;
  for(const d of bounds.details){if(certified.has(d.name))continue;const lo=d.min,hi=d.max;
   // Up to 6 cm of flush floor/ramp treads is deliberate non-blocking surface detail.
   if(hi[1]<=y+.06||lo[1]>=y+m.player.height)continue;
   const dx=Math.max(lo[0]-x,0,x-hi[0]),dz=Math.max(lo[2]-z,0,z-hi[2]);
   if(dx*dx+dz*dz<m.player.radius*m.player.radius)hits.push({route:route.id,detail:d.name,position:[x,y,z]});
  }
 }
}
assert.equal(bounds.collisionObjects,36);assert.equal(bounds.baseVisualObjects,57);assert(bounds.batchCount<=20);assert.equal(hits.length,0,JSON.stringify(hits.slice(0,10)));
const report={version:m.version,routeSamples:samples,certifiedSurfaceDetails,editableDetails:bounds.editableDetails,batches:bounds.batchCount,decorativeRouteIntersections:hits.length,method:'0.1m samples; full player radius/height against editable decoration AABBs; 0.06m floor/tread allowance; complements actual keyboard walkthrough and exact base/collision GLB bounds checks.'};
fs.writeFileSync(__dirname+'/detail_clearance_report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
