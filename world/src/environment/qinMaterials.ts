import * as THREE from 'three';

/**
 * Qin alone: rammed loess in pounded courses, round-and-pan black tile, lacquered
 * vermilion timber, patinated bronze, dressed stone, lime plaster and fired clay.
 * The surface family is read from the authored vertex colour; no textures are loaded.
 */
export const QIN_MATERIAL = 'M_QinCraft';
export function qinToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  if (src.name !== QIN_MATERIAL) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ name: src.name, vertexColors: true, color: s.color ?? new THREE.Color(1, 1, 1), gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity, fog: s.fog ?? true });
  m.userData = { ...src.userData, qinSurface: true, artStyle: 'painted-anime' };
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vQinWorld;\nvarying vec3 vQinNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vQinWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        vQinNormal=normalize(mat3(modelMatrix)*objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vQinWorld; varying vec3 vQinNormal;
      float qinLine(float v,float w){float f=abs(fract(v)-.5)*2.0;float aa=fwidth(v)*2.0;return 1.0-smoothstep(w,w+aa+.001,1.0-f);}
      float qinHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float qinNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(qinHash(i),qinHash(i+vec2(1,0)),f.x),mix(qinHash(i+vec2(0,1)),qinHash(i+vec2(1,1)),f.x),f.y);}
      float qinFbm(vec2 p){return qinNoise(p)*.55+qinNoise(p*2.13+7.1)*.3+qinNoise(p*4.7+3.3)*.15;}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 p=vQinWorld; vec3 n=normalize(vQinNormal); vec3 c=diffuseColor.rgb;
        float mx=max(max(c.r,c.g),c.b), mn=min(min(c.r,c.g),c.b), sat=(mx-mn)/max(mx,.001);
        float vertical=1.0-smoothstep(.45,.85,abs(n.y));
        vec2 wall=abs(n.x)>abs(n.z)?p.zy:p.xy;
        float grime=qinFbm(p.xz*.35+p.y*.2);
        // fired clay figures and kilns: mottled, slightly chalky
        float clay=step(c.b*1.15,c.g)*step(c.g*1.08,c.r)*smoothstep(.18,.3,sat)*(1.0-smoothstep(.42,.55,sat))*smoothstep(.3,.4,mx)*(1.0-smoothstep(.72,.8,mx));
        // rammed loess: warm, moderately saturated and bright
        float earth=step(c.b*1.2,c.g)*step(c.g*1.05,c.r)*smoothstep(.16,.24,sat)*smoothstep(.55,.62,mx);
        float tile=(1.0-smoothstep(.2,.3,mx))*(1.0-smoothstep(.12,.25,sat));
        float wood=step(c.g*1.15,c.r)*(1.0-smoothstep(.42,.5,mx))*smoothstep(.2,.3,mx)*smoothstep(.3,.36,sat);
        float lacquer=step(c.g*1.9,c.r)*smoothstep(.35,.45,mx);
        float bronze=step(c.r*1.05,c.g)*step(c.b*1.02,c.g)*smoothstep(.15,.25,sat)*(1.0-smoothstep(.6,.7,mx));
        float stone=(1.0-smoothstep(.1,.17,sat))*smoothstep(.32,.4,mx)*(1.0-smoothstep(.78,.86,mx));
        float plaster=(1.0-smoothstep(.12,.2,sat))*smoothstep(.8,.86,mx);
        vec3 tint=vec3(1.0);
        // 版筑: pounded courses (~0.42 m) with darker lifts, tamper pocks and a rain-stained foot
        float course=floor(p.y/.42);
        float lift=qinLine(p.y/.42,.07);
        float pock=smoothstep(.62,.9,qinNoise(wall*9.0+course*3.1));
        tint*=mix(vec3(1.0),vec3(1.0+.06*(qinHash(vec2(course,floor(p.x*.05+p.z*.05)))-.5))*(1.0-.16*lift)*(1.0-.07*pock),earth*vertical);
        tint*=mix(vec3(1.0),vec3(1.0+.05*(grime-.5)),earth);
        // 筒瓦: round tiles run down the slope, courses cross it; dark joints between rolls
        vec2 down=normalize(n.xz+vec2(1e-4));vec2 along=vec2(-down.y,down.x);
        float roll=dot(p.xz,along)/.34, row=dot(p.xz,down)/.5;
        float rollShade=.82+.3*pow(abs(sin(roll*3.14159)),.6);
        float tileMask=tile*(1.0-vertical);
        tint*=mix(vec3(1.0),vec3(rollShade*(1.0-.18*qinLine(row,.05)))*(.94+.12*qinHash(floor(vec2(roll,row)))),tileMask);
        tint*=mix(vec3(1.0),vec3(1.0+.25*(grime-.5)),tile*vertical);
        // timber grain and checking
        float grain=sin((n.y>.6?p.x:p.y)*38.0+qinNoise(wall*4.0)*6.0);
        tint*=mix(vec3(1.0),vec3(1.0+.07*grain-.06*qinLine(p.y*1.3+qinNoise(wall*2.0),.03)),wood);
        // lacquer: deep glossy red with worn lighter edges
        tint*=mix(vec3(1.0),mix(vec3(.92,.96,.97),vec3(1.12,1.0,.95),qinFbm(wall*3.0)),lacquer);
        // bronze: verdigris blooms over a darker metal
        float verd=smoothstep(.45,.75,qinFbm(p.xz*2.2+p.y*1.7));
        tint*=mix(vec3(1.0),mix(vec3(.82,.86,.84),vec3(1.18,1.3,1.18),verd),bronze);
        // dressed stone blocks with offset joints
        vec2 blk=vec2(wall.x/1.15+floor(wall.y/.62)*.5,wall.y/.62);
        float joint=max(qinLine(blk.x,.035),qinLine(blk.y,.05));
        tint*=mix(vec3(1.0),vec3((.93+.12*qinHash(floor(blk)))*(1.0-.22*joint)),stone*vertical);
        tint*=mix(vec3(1.0),vec3(.92+.14*grime),stone*(1.0-vertical));
        // lime plaster with a damp, earth-splashed base
        tint*=mix(vec3(1.0),vec3(.97+.06*grime),plaster*vertical*.6);
        // clay: speckled firing and faint pigment ghosts
        float speck=step(.93,qinHash(floor(p.xz*28.0+p.y*31.0)));
        tint*=mix(vec3(1.0),vec3(.94+.12*qinFbm(p.xy*6.0+p.z*4.0))*(1.0-.12*speck),clay);
        diffuseColor.rgb=c*tint;
        // cooler, bluer shade low down in shadowed underground air; sunlit tops stay warm
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.93,.97,1.04),vertical*.25);
      }`)
      .replace('#include <opaque_fragment>', `{
        vec3 base=diffuseColor.rgb+vec3(.0001);
        float lit=smoothstep(.55,.95,clamp(dot(outgoingLight/base,vec3(.3333)),0.0,2.0));
        outgoingLight=mix(outgoingLight*vec3(.86,.9,1.04)+base*vec3(.012,.012,.02),outgoingLight*vec3(1.04,1.0,.94),lit);
        float rim=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.5);
        outgoingLight+=base*vec3(1.0,.93,.8)*rim*.05;
      }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'qin-crafted-surfaces-v1';
  return m;
}
