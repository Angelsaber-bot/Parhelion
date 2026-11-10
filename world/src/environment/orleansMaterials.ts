import * as THREE from 'three';
/** Orleans alone: river-washed limestone, painted plaster, split timber and blue slate. */
export function orleansToonMaterial(src:THREE.Material,gradientMap:THREE.Texture):THREE.MeshToonMaterial|null {
  if(src.name!=='M_OrleansCraft')return null;
  const s=src as THREE.MeshStandardMaterial;
  const m=new THREE.MeshToonMaterial({name:src.name,vertexColors:s.vertexColors,color:s.color,gradientMap,side:s.side,transparent:s.transparent,opacity:s.opacity,depthWrite:s.depthWrite,depthTest:s.depthTest,fog:s.fog});
  m.userData={...src.userData,orleansSurface:true};
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOrleansWorld;\nvarying vec3 vOrleansNormal;')
      .replace('#include <project_vertex>',`#include <project_vertex>
        vOrleansWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        vOrleansNormal=normalize(mat3(modelMatrix)*objectNormal);`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vOrleansWorld; varying vec3 vOrleansNormal;
      float orleansLine(float v){return sin(v)*(1.0-smoothstep(.45,2.0,fwidth(v)));}
      float orleansNoise(vec3 p){return sin(p.x*.47+sin(p.y*.63))*sin(p.z*.59+p.y*.31);}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      {
        vec3 p=vOrleansWorld; vec3 n=normalize(vOrleansNormal);
        vec3 c=diffuseColor.rgb; float value=max(max(c.r,c.g),c.b);
        float timber=step(c.b*1.3,c.r)*(1.0-smoothstep(.24,.43,value));
        float slate=step(c.r*1.12,c.b)*step(c.g*.9,c.b);
        float wash=orleansNoise(p*.7);
        float vertical=1.0-smoothstep(.35,.85,abs(n.y));
        float row=floor(p.y/ .48);
        float course=orleansLine(p.y*13.0899);
        float joint=orleansLine((p.x+p.z)*4.2+mod(row,2.0)*3.14159);
        float masonry=vertical*(.018*course+.009*joint);
        float grain=orleansLine((p.x*.8+p.z)*24.0+sin(p.y*.7)*1.5);
        float roof=orleansLine(p.y*18.0+(p.x+p.z)*.45);
        diffuseColor.rgb*=1.0+.028*wash+(1.0-timber)*(1.0-slate)*masonry+timber*.045*grain+slate*.025*roof;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.96,1.025,1.015),vertical*(1.0-timber)*.14);
      }`)
      .replace('#include <opaque_fragment>',`{
        vec3 base=diffuseColor.rgb+vec3(.0001);
        float lit=smoothstep(.62,.96,clamp(dot(outgoingLight/base,vec3(.3333)),0.0,2.0));
        outgoingLight=mix(outgoingLight*vec3(.89,.94,1.045)+base*vec3(.013,.014,.02),outgoingLight*vec3(1.025,1.01,.975),lit);
        float rim=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),4.0);
        outgoingLight+=base*vec3(1.0,.97,.9)*rim*.026;
      }\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=> 'orleans-painted-surfaces-v1';return m;
}
