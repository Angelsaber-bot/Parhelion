/** Britain-only exact material identities. No other chapter is opted in. */
export const BRITAIN_MATERIAL_PROFILES = {
  M_BritainLimestone: { roughness: 0.94, metalness: 0, rim: 0.035, grain: 0.032 },
  M_BritainSandstone: { roughness: 0.97, metalness: 0, rim: 0.028, grain: 0.044 },
  M_BritainOak: { roughness: 0.88, metalness: 0, rim: 0.028, grain: 0.052 },
  M_BritainSlate: { roughness: 0.82, metalness: 0, rim: 0.04, grain: 0.024 },
  M_BritainThatch: { roughness: 1, metalness: 0, rim: 0.018, grain: 0.045 },
  M_BritainPlaster: { roughness: 0.95, metalness: 0, rim: 0.025, grain: 0.02 },
  M_BritainWool: { roughness: 1, metalness: 0, rim: 0.018, grain: 0.028 },
  M_BritainIron: { roughness: 0.76, metalness: 0.48, rim: 0.04, grain: 0.018 },
  M_BritainBronze: { roughness: 0.48, metalness: 0.72, rim: 0.068, grain: 0.016 },
  M_BritainCharredWood: { roughness: 1, metalness: 0, rim: 0.012, grain: 0.024 },
} as const;

export type BritainMaterialName = keyof typeof BRITAIN_MATERIAL_PROFILES;
export function britainMaterialProfile(name: string) {
  return Object.prototype.hasOwnProperty.call(BRITAIN_MATERIAL_PROFILES, name)
    ? BRITAIN_MATERIAL_PROFILES[name as BritainMaterialName] : undefined;
}
