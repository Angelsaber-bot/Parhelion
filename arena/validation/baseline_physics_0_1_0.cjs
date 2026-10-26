(function(root,factory){if(typeof module==='object')module.exports=factory();else root.MapPhysics=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const inside=(o,x,z)=>Math.abs(x-o.position[0])<=o.size[0]/2+.001&&Math.abs(z-o.position[2])<=o.size[2]/2+.001;
  function top(o,x,z){if(o.type==='box')return o.position[1]+o.size[1]/2;
    const a=o.axis==='x'?0:2;return o.position[1]+o.size[1]*(1-((a===0?x:z)-o.position[a])/(o.size[a]/2)*o.lowAt)/2;}
  function overlaps(o,x,z,r){let qx=Math.max(o.position[0]-o.size[0]/2,Math.min(x,o.position[0]+o.size[0]/2));let qz=Math.max(o.position[2]-o.size[2]/2,Math.min(z,o.position[2]+o.size[2]/2));return (x-qx)**2+(z-qz)**2<r*r-.000001;}
  function ground(map,x,z,y){let g=-100;for(const o of map.objects){if(!o.collision||!inside(o,x,z))continue;const t=top(o,x,z);if(t<=y+map.player.stepHeight+.001)g=Math.max(g,t);}return g;}
  function blocked(map,x,z,y){for(const o of map.objects){if(!o.collision||!overlaps(o,x,z,map.player.radius))continue;
    const t=top(o,Math.max(o.position[0]-o.size[0]/2,Math.min(x,o.position[0]+o.size[0]/2)),Math.max(o.position[2]-o.size[2]/2,Math.min(z,o.position[2]+o.size[2]/2)));
    const bottom=o.type==='box'?o.position[1]-o.size[1]/2:o.position[1];
    if(t>y+map.player.stepHeight+.001&&bottom<y+map.player.height-.02)return o.id;
  }return null;}
  function step(map,s,dx,dz,dt){
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
    for(let i=0;i<count;i++){
      for(const [a,d] of [['x',dx/count],['z',dz/count]]){const x=a==='x'?s.x+d:s.x,z=a==='z'?s.z+d:s.z;if(!blocked(map,x,z,s.y)){s[a]+=d;const g=ground(map,s.x,s.z,s.y);if(g>s.y-.3&&s.vy<=0){s.y=g;s.vy=0;}}}
    }
    const g=ground(map,s.x,s.z,s.y);s.vy-=18*dt;s.y+=s.vy*dt;
    if(s.y<=g){s.y=g;s.vy=0;}return s;
  }
  function rayBox(a,b,o){let lo=0,hi=1;for(let i=0;i<3;i++){const mn=o.position[i]-o.size[i]/2,mx=o.position[i]+o.size[i]/2,d=b[i]-a[i];if(Math.abs(d)<1e-9){if(a[i]<mn||a[i]>mx)return false;}else{let l=(mn-a[i])/d,h=(mx-a[i])/d;if(l>h)[l,h]=[h,l];lo=Math.max(lo,l);hi=Math.min(hi,h);if(lo>hi)return false;}}return hi>0&&lo<1;}
  function lineOfSight(map,a,b){return !map.objects.some(o=>o.collision&&o.type==='box'&&rayBox(a,b,o));}
  return {step,ground,blocked,top,lineOfSight,overlaps};
});
