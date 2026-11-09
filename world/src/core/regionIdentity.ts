/** The five authored eras shared by world destinations and campaign content. */
export const CAMPAIGN_REGION_IDS = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'] as const;
export type CampaignRegionId = typeof CAMPAIGN_REGION_IDS[number];

/** New areas are exploration blockouts; they do not impersonate completed campaign chapters. */
export const EXPANSION_REGION_IDS = ['orleans', 'egypt', 'qin'] as const;
export type ExpansionRegionId = typeof EXPANSION_REGION_IDS[number];
export const WORLD_REGION_IDS = [...CAMPAIGN_REGION_IDS, ...EXPANSION_REGION_IDS] as const;
export type WorldRegionId = typeof WORLD_REGION_IDS[number];

const campaignRegions: ReadonlySet<string> = new Set(CAMPAIGN_REGION_IDS);
export function isCampaignRegion(value: unknown): value is CampaignRegionId {
  return typeof value === 'string' && campaignRegions.has(value);
}
export function isExpansionRegion(value: unknown): value is ExpansionRegionId {
  return typeof value === 'string' && (EXPANSION_REGION_IDS as readonly string[]).includes(value);
}
