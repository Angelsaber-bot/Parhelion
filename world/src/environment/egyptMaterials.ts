import * as THREE from 'three';

/**
 * Egypt alone: bedded sandstone, dressed limestone, sun-dried mudbrick, painted plaster
 * with incised relief bands, beaten gold, turquoise faience, palm timber and reed matting.
 * The family is read from the authored vertex colour; nothing is textured.
 */
export const EGYPT_MATERIAL = 'M_EgyptCraft';
export function egyptToonMaterial(src: THREE.Material, gradientMap: THREE.Texture): THREE.MeshToonMaterial | null {
  if (src.name !== EGYPT_MATERIAL) return null;
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ name: src.name, vertexColors: true, color: s.color ?? new THREE.Color(1, 1, 1), gradientMap, side: s.side, transparent: s.transparent, opacity: s.opacity, fog: s.fog ?? true });
  m.userData = { ...src.userData, egyptSurface: true, artStyle: 'painted-anime' };
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEgWorld;\nvarying vec3 vEgNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vEgWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        vEgNormal=normalize(mat3(modelMatrix)*objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vEgWorld; varying vec3 vEgNormal; float egGold=0.0;
      float egLine(float v,float w){float f=abs(fract(v)-.5)*2.0;float aa=fwidth(v)*2.0;return 1.0-smoothstep(w,w+aa+.001,1.0-f);}
      float egHash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*15731.743);}
      float egNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(egHash(i),egHash(i+vec2(1,0)),f.x),mix(egHash(i+vec2(0,1)),egHash(i+vec2(1,1)),f.x),f.y);}
      float egFbm(vec2 p){return egNoise(p)*.55+egNoise(p*2.2+5.3)*.3+egNoise(p*4.6+1.7)*.15;}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 p=vEgWorld; vec3 n=normalize(vEgNormal); vec3 c=diffuseColor.rgb;
        float mx=max(max(c.r,c.g),c.b), mn=min(min(c.r,c.g),c.b), sat=(mx-mn)/max(mx,.001);
        float vertical=1.0-smoothstep(.45,.85,abs(n.y));
        vec2 wall=abs(n.x)>abs(n.z)?p.zy:p.xy;
        float warm=step(c.b*1.25,c.g)*step(c.g*1.03,c.r);
        // sandstone: warm ochre, saturated; limestone: pale, low saturation; mudbrick: dark warm
        float sandstone=warm*smoothstep(.22,.3,sat)*smoothstep(.5,.6,mx)*(1.0-smoothstep(.62,.7,sat));
        float plaster=warm*(1.0-smoothstep(.15,.19,sat))*smoothstep(.9,.93,mx);
        float limestone=warm*(1.0-smoothstep(.16,.24,sat))*smoothstep(.7,.78,mx)*(1.0-plaster);
        float brick=warm*smoothstep(.25,.32,sat)*smoothstep(.3,.36,mx)*(1.0-smoothstep(.52,.58,mx));
        float gold=warm*smoothstep(.45,.55,sat)*smoothstep(.6,.7,mx)*smoothstep(.56,.68,c.g/max(c.r,.001));
        float ochre=warm*smoothstep(.5,.6,sat)*(1.0-smoothstep(.5,.6,c.g/max(c.r,.001)));
        float lapis=step(c.r*1.4,c.b)*step(c.g*1.12,c.b)*smoothstep(.3,.4,sat);
        float faience=step(c.r*1.2,c.g)*step(c.r*1.15,c.b)*smoothstep(.3,.4,sat);
        float plant=step(c.r*1.05,c.g)*step(c.b*1.15,c.g)*smoothstep(.2,.3,sat);
        vec3 tint=vec3(1.0);
        // bedded sandstone: thick and thin beds, cross-bedding and wind-worn hollows
        float bed=p.y/.7+egNoise(wall*.25)*1.4;
        tint*=mix(vec3(1.0),vec3(1.0+.07*sin(bed*3.14159)+.05*(egHash(vec2(floor(bed),0.0))-.5))*(1.0-.12*egLine(bed,.04))*(1.0-.1*smoothstep(.62,.85,egNoise(wall*1.6))),sandstone*vertical);
        tint*=mix(vec3(1.0),vec3(.94+.12*egFbm(p.xz*.6)),sandstone*(1.0-vertical));
        // dressed limestone: large ashlar blocks with fine joints and a soft patina
        vec2 blk=vec2(wall.x/1.6+floor(wall.y/.9)*.5,wall.y/.9);
        float joint=max(egLine(blk.x,.03),egLine(blk.y,.04));
        tint*=mix(vec3(1.0),vec3((.95+.08*egHash(floor(blk)))*(1.0-.16*joint)),limestone*vertical);
        // incised relief band: a frieze of figures suggested by stepped dark marks
        float frieze=smoothstep(.0,.1,fract(p.y/4.2)-.55)*(1.0-smoothstep(.1,.2,fract(p.y/4.2)-.85));
        float glyph=step(.55,egNoise(vec2(wall.x*2.2,floor(p.y*2.5))));
        tint*=mix(vec3(1.0),vec3(1.0-.18*glyph*frieze),limestone*vertical*.9);
        // weathering: faint dark streaks running down the stone faces from the joints and cornices
        float streak=smoothstep(.58,.92,egNoise(vec2(wall.x*1.4,p.y*.06)))*smoothstep(.2,.8,egNoise(vec2(wall.x*.3,p.y*.4)));
        tint*=mix(vec3(1.0),vec3(1.0-.1*streak),(sandstone+limestone)*vertical);
        // lime plaster: soft brush wash and a fine craquelure
        vec2 cq=wall*3.2+vec2(egNoise(wall*1.7),egNoise(wall*1.7+3.1))*.8;
        float crack=max(egLine(cq.x+egNoise(cq*.5)*.6,.035),egLine(cq.y+egNoise(cq*.5+7.0)*.6,.035));
        tint*=mix(vec3(1.0),vec3((.96+.06*egNoise(wall*.9))*(1.0-.09*crack)),plaster*vertical);
        tint*=mix(vec3(1.0),vec3(.97+.05*egNoise(p.xz*.8)),plaster*(1.0-vertical));
        // red ochre: matte pigment laid on in strokes
        tint*=mix(vec3(1.0),vec3(.9+.14*egNoise(vec2(wall.x*6.0,wall.y*1.5))),ochre);
        // mudbrick courses, with plaster loss at the corners and foot
        vec2 mb=vec2(wall.x/.36+floor(wall.y/.12)*.5,wall.y/.12);
        float mortar=max(egLine(mb.x,.06),egLine(mb.y,.12));
        tint*=mix(vec3(1.0),vec3((.92+.12*egHash(floor(mb)))*(1.0-.14*mortar)),brick*vertical);
        // beaten gold: bright facets and darker hammer marks
        tint*=mix(vec3(1.0),vec3(.85+.35*egNoise(p.xz*9.0+p.y*7.0)),gold);
        // faience: glossy glaze pooling darker in recesses
        tint*=mix(vec3(1.0),vec3(.9+.2*egNoise(wall*5.0)),faience);
        // lapis and blue frit: deep blue with pyrite flecks of gold
        float fleck=step(.988,egHash(floor(p.xz*9.0)+floor(p.y*9.0)*vec2(1.7,3.1)));
        tint*=mix(vec3(1.0),vec3(.9+.16*egNoise(wall*4.0)),lapis);
        egGold=gold;
        // palm fronds, reeds and crops: veined, lighter at the tips
        tint*=mix(vec3(1.0),vec3(.88+.24*egNoise(p.xz*3.0+p.y*2.0)),plant);
        diffuseColor.rgb=mix(c*tint,vec3(.86,.68,.28),fleck*lapis*.85);
        // sun-bleached tops, a little cooler in the shade of walls
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.05,1.03,.98),(1.0-vertical)*.5);
      }`)
      .replace('#include <opaque_fragment>', `{
        vec3 base=diffuseColor.rgb+vec3(.0001);
        float lit=smoothstep(.5,.95,clamp(dot(outgoingLight/base,vec3(.3333)),0.0,2.0));
        outgoingLight=mix(outgoingLight*vec3(.88,.9,1.06)+base*vec3(.02,.016,.02),outgoingLight*vec3(1.06,1.0,.92),lit);
        float rim=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.5);
        outgoingLight+=base*vec3(1.0,.9,.72)*rim*.06;
        // beaten gold catches the sun: a warm sheen toward grazing angles and small hot glints
        float glint=step(.93,egHash(floor(vEgWorld.xz*9.0+vEgWorld.y*7.0)));
        outgoingLight+=base*vec3(1.0,.86,.55)*egGold*(pow(rim,1.6)*.45+glint*lit*.25);
      }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'egypt-crafted-surfaces-v2';
  return m;
}
