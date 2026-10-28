// Per-map lighting moods. A map picks one with map.json `presentation.preset`; maps without it
// (ASTER) keep the original midday look. Colours are sRGB hex; the sky shader takes linear-ish
// colours directly, as the original constants did.

export interface Atmosphere {
  background: number;
  fog: [number, number, number]; // colour, near, far
  exposure: number;
  hemi: [number, number, number]; // sky, ground, intensity
  sun: { color: number; intensity: number; pos: [number, number, number] };
  sky: { horizon: number; mid: number; top: number; sun: number; cloudLit: number; cloudShade: number; night: number; aurora?: number };
  particles: 'none' | 'petals' | 'motes' | 'embers' | 'snow';
  bloom: number; // UnrealBloom strength (0 = off)
  bloomThreshold: number; // linear luminance that starts to glow; daylight must stay above lit sand/plaster
}

export const ATMOSPHERES: Record<string, Atmosphere> = {
  seabreeze: {
    background: 0x9cbbc8, fog: [0xaac8d2, 90, 240], exposure: 1.0, hemi: [0xcbe1e8, 0x69656b, 1.7],
    sun: { color: 0xffe5bd, intensity: 2.7, pos: [-28, 36, 18] },
    sky: { horizon: 0xe0ded0, mid: 0x82b5ce, top: 0x467eaa, sun: 0xffedca, cloudLit: 0xf8ead6, cloudShade: 0xa1b2c7, night: 0 },
    particles: 'none', bloom: 0.18, bloomThreshold: 1.8,
  },
  snowcourt: {
    background: 0xb8c5d6, fog: [0xc0cbd9, 80, 220], exposure: 0.94, hemi: [0xdce6f4, 0x798397, 1.65],
    sun: { color: 0xf3e8d4, intensity: 2.0, pos: [-24, 30, 18] },
    sky: { horizon: 0xe6e5e3, mid: 0xbbcbdc, top: 0x859fbd, sun: 0xfff3df, cloudLit: 0xeef0f2, cloudShade: 0xb0bfd1, night: 0 },
    particles: 'snow', bloom: 0.08, bloomThreshold: 2.2,
  },
  oathfield: {
    background: 0xb5c6bf, fog: [0xb5c5b4, 70, 220], exposure: 1.0, hemi: [0xd8e6ec, 0x637654, 1.6],
    sun: { color: 0xffddb0, intensity: 2.6, pos: [-35, 22, 20] },
    sky: { horizon: 0xe6cfab, mid: 0x9dbdcc, top: 0x57859f, sun: 0xffedc6, cloudLit: 0xf7e5c8, cloudShade: 0xa3afc4, night: 0.06 },
    particles: 'motes', bloom: 0.16, bloomThreshold: 1.8,
  },
  day: {
    background: 0xbfdcf2, fog: [0xc4e2f6, 70, 220], exposure: 1.05, hemi: [0xd6ecff, 0x6a7088, 1.8],
    sun: { color: 0xffe7c8, intensity: 3.0, pos: [-22, 35, 18] },
    sky: { horizon: 0xf2f5ff, mid: 0x7dc4f5, top: 0x2b73db, sun: 0xfff7d9, cloudLit: 0xfffcf7, cloudShade: 0xb8c2eb, night: 0 },
    particles: 'none', bloom: 0.35, bloomThreshold: 1.7,
  },
  noon: {
    background: 0xc7e6fb, fog: [0xd2ecfb, 80, 240], exposure: 0.98, hemi: [0xe2f2ff, 0x7c7a8c, 1.7],
    sun: { color: 0xfff0d2, intensity: 3.2, pos: [-14, 42, 22] },
    sky: { horizon: 0xf5f8ff, mid: 0x8ccdf7, top: 0x2f7fe6, sun: 0xfff7d9, cloudLit: 0xffffff, cloudShade: 0xc2cbee, night: 0 },
    particles: 'motes', bloom: 0.35, bloomThreshold: 1.7,
  },
  dusk: {
    background: 0xf2b48c, fog: [0xf0b892, 45, 170], exposure: 1.0, hemi: [0xffc9a8, 0x5b4a6e, 1.5],
    sun: { color: 0xffa26b, intensity: 3.3, pos: [-46, 13, 10] },
    sky: { horizon: 0xffc58f, mid: 0xf28aa0, top: 0x5a4b9e, sun: 0xffe0a8, cloudLit: 0xffd2b0, cloudShade: 0x9c7aa8, night: 0.15 },
    particles: 'petals', bloom: 0.55, bloomThreshold: 1.15,
  },
  aurora: {
    background: 0x1c3456, fog: [0x2c4a6e, 55, 210], exposure: 1.12, hemi: [0x9fc8ff, 0x3a3f66, 1.6],
    sun: { color: 0xbfd6ff, intensity: 2.1, pos: [-30, 18, 26] },
    sky: { horizon: 0x5f8fbf, mid: 0x1f3f74, top: 0x0a1433, sun: 0xd8ecff, cloudLit: 0x3c5580, cloudShade: 0x1c2a4c, night: 0.85, aurora: 1.8 },
    particles: 'snow', bloom: 0.75, bloomThreshold: 0.95,
  },
  night: {
    background: 0x0d1430, fog: [0x141c3c, 30, 140], exposure: 1.15, hemi: [0x6e7fd6, 0x1a1530, 1.1],
    sun: { color: 0x9fb2ff, intensity: 1.2, pos: [24, 40, -16] },
    sky: { horizon: 0x2b2f6b, mid: 0x161d4d, top: 0x070b22, sun: 0xd8e2ff, cloudLit: 0x3c447c, cloudShade: 0x191c3c, night: 1 },
    particles: 'embers', bloom: 0.95, bloomThreshold: 0.7,
  },
};

export const atmosphereFor = (preset?: string) => ATMOSPHERES[preset ?? 'day'] ?? ATMOSPHERES.day;
