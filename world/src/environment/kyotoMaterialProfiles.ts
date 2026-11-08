/** Kyoto's portable GLB surface identities. Unprefixed materials are deliberately untouched. */
export const KYOTO_MATERIAL_PROFILES = {
  M_KyotoArchitecture: { roughness: 0.87, metalness: 0, rim: 0.045, grain: 0.018 },
  M_KyotoTimber: { roughness: 0.84, metalness: 0, rim: 0.055, grain: 0.055 },
  M_KyotoCharredWood: { roughness: 0.98, metalness: 0, rim: 0.018, grain: 0.035 },
  M_KyotoRoof: { roughness: 0.64, metalness: 0, rim: 0.075, grain: 0.025 },
  M_KyotoPlaster: { roughness: 0.96, metalness: 0, rim: 0.025, grain: 0.018 },
  M_KyotoGold: { roughness: 0.38, metalness: 0.72, rim: 0.12, grain: 0.018 },
  M_KyotoStone: { roughness: 0.93, metalness: 0, rim: 0.045, grain: 0.065 },
  M_KyotoVermilion: { roughness: 0.58, metalness: 0, rim: 0.07, grain: 0.022 },
  M_KyotoFabric: { roughness: 1, metalness: 0, rim: 0.025, grain: 0.035 },
  M_KyotoBamboo: { roughness: 0.72, metalness: 0, rim: 0.06, grain: 0.035 },
} as const;

export type KyotoMaterialName = keyof typeof KYOTO_MATERIAL_PROFILES;
export function kyotoMaterialProfile(name: string) {
  return Object.prototype.hasOwnProperty.call(KYOTO_MATERIAL_PROFILES, name)
    ? KYOTO_MATERIAL_PROFILES[name as KyotoMaterialName] : undefined;
}
