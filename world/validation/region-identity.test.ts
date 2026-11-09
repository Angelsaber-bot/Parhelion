import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPAIGN_REGION_IDS, WORLD_REGION_IDS, EXPANSION_REGION_IDS, isExpansionRegion, isCampaignRegion } from '../src/core/regionIdentity';
import { CAMPAIGN_EPISODES, CAMPAIGN_REGIONS } from '../src/story/campaignEpisodes';

test('world has eight destinations while resident chronicles retain the five authored chapters', () => {
  assert.deepEqual(CAMPAIGN_REGION_IDS, ['alpha', 'britain', 'blacksail', 'winter', 'kyoto']);
  assert.deepEqual(CAMPAIGN_REGIONS, CAMPAIGN_REGION_IDS);
  assert.deepEqual(Object.keys(CAMPAIGN_EPISODES).sort(), [...CAMPAIGN_REGION_IDS].sort());
  assert.deepEqual(WORLD_REGION_IDS, [...CAMPAIGN_REGION_IDS,...EXPANSION_REGION_IDS]);
  for(const id of EXPANSION_REGION_IDS){assert.ok(isExpansionRegion(id));assert.equal(isCampaignRegion(id),false);}
});

test('campaign guard accepts only authored region identifiers, without coercing save or route data', () => {
  for (const region of CAMPAIGN_REGION_IDS) assert.equal(isCampaignRegion(region), true);
  for (const value of ['', 'unknown', 'winter ', 'ALPHA', '__proto__', 'constructor', undefined, null, 0, [], {}, new String('alpha')]) {
    assert.equal(isCampaignRegion(value), false);
  }
});
