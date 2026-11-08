/** Everwinter-only portable surface identities; shared and Kyoto materials never opt in. */
export const WINTER_MATERIAL_PROFILES = {
  M_WinterSnow: { roughness: 0.98, metalness: 0, rim: 0.025, grain: 0.012 },
  M_WinterTimber: { roughness: 0.88, metalness: 0, rim: 0.035, grain: 0.045 },
  M_WinterCharredWood: { roughness: 1, metalness: 0, rim: 0.012, grain: 0.03 },
  M_WinterPlaster: { roughness: 0.96, metalness: 0, rim: 0.025, grain: 0.018 },
  M_WinterBrick: { roughness: 0.94, metalness: 0, rim: 0.025, grain: 0.035 },
  M_WinterStone: { roughness: 0.93, metalness: 0, rim: 0.035, grain: 0.045 },
  M_WinterCopper: { roughness: 0.7, metalness: 0.35, rim: 0.065, grain: 0.025 },
  M_WinterGold: { roughness: 0.4, metalness: 0.74, rim: 0.085, grain: 0.012 },
  M_WinterIron: { roughness: 0.82, metalness: 0.48, rim: 0.045, grain: 0.02 },
  M_WinterCanvas: { roughness: 1, metalness: 0, rim: 0.018, grain: 0.025 },
} as const;

export type WinterMaterialName = keyof typeof WINTER_MATERIAL_PROFILES;
export function winterMaterialProfile(name: string) {
  return Object.prototype.hasOwnProperty.call(WINTER_MATERIAL_PROFILES, name)
    ? WINTER_MATERIAL_PROFILES[name as WinterMaterialName] : undefined;
}
