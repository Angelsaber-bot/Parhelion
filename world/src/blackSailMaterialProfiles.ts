/** BlackSail-only surface identities; exact opt-in leaves other chapters unchanged. */
export const BLACKSAIL_MATERIAL_PROFILES = {
  M_BlackSailTimber: { roughness: 0.91, metalness: 0, rim: 0.028, grain: 0.048 },
  M_BlackSailStone: { roughness: 0.97, metalness: 0, rim: 0.025, grain: 0.038 },
  M_BlackSailPlaster: { roughness: 0.96, metalness: 0, rim: 0.022, grain: 0.018 },
  M_BlackSailTerracotta: { roughness: 0.9, metalness: 0, rim: 0.03, grain: 0.028 },
  M_BlackSailShingle: { roughness: 0.94, metalness: 0, rim: 0.023, grain: 0.043 },
  M_BlackSailThatch: { roughness: 1, metalness: 0, rim: 0.018, grain: 0.038 },
  M_BlackSailCanvas: { roughness: 1, metalness: 0, rim: 0.018, grain: 0.026 },
  M_BlackSailRope: { roughness: 0.98, metalness: 0, rim: 0.022, grain: 0.04 },
  M_BlackSailIron: { roughness: 0.83, metalness: 0.52, rim: 0.035, grain: 0.019 },
  M_BlackSailBrass: { roughness: 0.48, metalness: 0.7, rim: 0.065, grain: 0.018 },
} as const;

export type BlackSailMaterialName = keyof typeof BLACKSAIL_MATERIAL_PROFILES;
export function blackSailMaterialProfile(name: string) {
  return Object.prototype.hasOwnProperty.call(BLACKSAIL_MATERIAL_PROFILES, name)
    ? BLACKSAIL_MATERIAL_PROFILES[name as BlackSailMaterialName] : undefined;
}
