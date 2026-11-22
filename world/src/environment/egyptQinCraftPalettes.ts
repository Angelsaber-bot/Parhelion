import { Color } from 'three';

// The generators and the runtime use the same authored swatches. glTF stores
// these sRGB colours as linear vertex channels, quantized to eight bits.
export const E = {
  sand: '#d8b77a', sandstone: '#c99a5e', sandstoneDark: '#a9784a', limestone: '#e6d8b8', limestoneDark: '#cdbb94',
  brick: '#9a6f48', brickDark: '#7f5a3a', plaster: '#efe4c8', blue: '#2f5f8f', red: '#a8432f', green: '#4f8a5a', yellow: '#d8a94a',
  gold: '#dba93a', faience: '#3fa2a0', lapis: '#24477a', trunk: '#7a5c3c', leaf: '#5d8a3e', leafDark: '#4a7333', linen: '#ece2c6',
  wood: '#6b4a2f', black: '#2a2622', water: '#4c9fae', ember: '#ffb04a', light: '#fff1c4', reed: '#8a9a52',
};

export const Q = {
  earth: '#b39a73', earthDark: '#9c845f', earthPale: '#c8b28a', loess: '#c9b48c',
  tile: '#2e3236', tileEdge: '#3d4247', ridge: '#24272b', plaster: '#ddd2b8',
  red: '#a63a2c', redDark: '#7e2c24', bronze: '#5f7c66', bronzeBright: '#a8854a', lacquer: '#201e1d',
  wood: '#5c4532', woodPale: '#8c6c4b', stone: '#8f9089', stoneDark: '#6c6e69', paving: '#9d9784',
  terracotta: '#9b7b5d', terracottaDark: '#7f6249', clay: '#b07a57', water: '#4f8fa0',
  ember: '#ff9a3c', molten: '#ffc463', mercury: '#c9d7e6', star: '#e8ecff', jade: '#6f9c86',
  ochre: '#b8823f', azure: '#3f6f8a', cinnabar: '#c0452f', gold: '#c9a25a', silk: '#c9b991',
};

export const egyptCraftSurfaces = {
  sandstone: [E.sandstone, E.sandstoneDark],
  limestone: [E.limestone, E.limestoneDark],
  brick: [E.brick, E.brickDark],
  plaster: [E.plaster],
  gold: [E.gold],
  ochre: [E.red, E.yellow],
  faience: [E.faience],
  lapis: [E.lapis, E.blue],
  plant: [E.green, E.leaf, E.leafDark, E.reed],
  wood: [E.wood, E.trunk],
  linen: [E.linen],
};

export const qinCraftSurfaces = {
  earth: [Q.earth, Q.earthDark, Q.earthPale, Q.loess],
  tile: [Q.tile, Q.tileEdge, Q.ridge],
  wood: [Q.wood, Q.woodPale],
  lacquer: [Q.red, Q.redDark, Q.lacquer, Q.cinnabar],
  bronze: [Q.bronze, Q.bronzeBright],
  stone: [Q.stone, Q.stoneDark, Q.paving],
  plaster: [Q.plaster],
  clay: [Q.terracotta, Q.terracottaDark, Q.clay],
};

export function craftSwatchKey(swatch: string) {
  const color = new Color(swatch);
  return Math.round(color.r * 255) * 65536 + Math.round(color.g * 255) * 256 + Math.round(color.b * 255);
}

/** Source geometry has a single colour per face. Identify it before lighting,
 * once per vertex; custom colours keep the region's original blended masks. */
export function craftSurfaceShader(surfaces: Record<string, readonly string[]>) {
  const families = Object.entries(surfaces);
  const cases = families.map(([, swatches], i) => {
    const labels = swatches.map(swatch => 'case ' + craftSwatchKey(swatch) + ':').join(' ');
    return labels + ' return ' + (i + 1) + '.0;';
  });
  return {
    vertex: `varying float vCraftClass;
      float craftClass(vec3 linearColor){
        vec3 bytes=floor(clamp(linearColor,0.0,1.0)*255.0+0.5);
        switch(int(dot(bytes,vec3(65536.0,256.0,1.0)))){
          ${cases.join('\n')}
          default: return 0.0;
        }
      }`,
    assign: `
      #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        vCraftClass=craftClass(color.rgb);
      #else
        vCraftClass=0.0;
      #endif
    `,
    fragment: `varying float vCraftClass;
      ${families.map(([name], i) => 'const float CRAFT_' + name.toUpperCase() + '=' + (i + 1) + '.0;').join('\n')}
      float craftMask(float family,float fallback){
        return vCraftClass<0.5 ? fallback : 1.0-step(0.5,abs(vCraftClass-family));
      }`,
  };
}
