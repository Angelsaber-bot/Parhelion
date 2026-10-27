/** Valley-only exact material identities. No other chapter is opted in. */
export const VALLEY_MATERIAL_PROFILES = {
  M_ValleyCeramic: { roughness: 0.36, metalness: 0, rim: 0.055, grain: 0.008 },
  M_ValleyMetal: { roughness: 0.4, metalness: 0.62, rim: 0.055, grain: 0.012 },
  M_ValleyGlass: { roughness: 0.2, metalness: 0.12, rim: 0.075, grain: 0.005 },
  M_ValleyStone: { roughness: 0.93, metalness: 0, rim: 0.028, grain: 0.035 },
  M_ValleyTimber: { roughness: 0.86, metalness: 0, rim: 0.028, grain: 0.038 },
  M_ValleyCanvas: { roughness: 0.98, metalness: 0, rim: 0.018, grain: 0.02 },
  M_ValleyBrass: { roughness: 0.42, metalness: 0.72, rim: 0.065, grain: 0.012 },
} as const;

export type ValleyMaterialName = keyof typeof VALLEY_MATERIAL_PROFILES;
export function valleyMaterialProfile(name: string) {
  return Object.prototype.hasOwnProperty.call(VALLEY_MATERIAL_PROFILES, name)
    ? VALLEY_MATERIAL_PROFILES[name as ValleyMaterialName] : undefined;
}
