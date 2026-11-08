import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMPAIGN_REGION_IDS, WORLD_REGION_IDS, isCampaignRegion } from '../src/core/regionIdentity';
import { CAMPAIGN_EPISODES, CAMPAIGN_REGIONS } from '../src/story/campaignEpisodes';

test('world destinations and resident chronicles use exactly the five authored regions', () => {
  assert.deepEqual(CAMPAIGN_REGION_IDS, ['alpha', 'britain', 'blacksail', 'winter', 'kyoto']);
  assert.deepEqual(CAMPAIGN_REGIONS, CAMPAIGN_REGION_IDS);
  assert.deepEqual(Object.keys(CAMPAIGN_EPISODES).sort(), [...CAMPAIGN_REGION_IDS].sort());
  assert.deepEqual(WORLD_REGION_IDS, CAMPAIGN_REGION_IDS);
});

test('campaign guard accepts only authored region identifiers, without coercing save or route data', () => {
  for (const region of CAMPAIGN_REGION_IDS) assert.equal(isCampaignRegion(region), true);
  for (const value of ['', 'unknown', 'winter ', 'ALPHA', '__proto__', 'constructor', undefined, null, 0, [], {}, new String('alpha')]) {
    assert.equal(isCampaignRegion(value), false);
  }
});
