# Journey weapon finishes

Five visual-only finishes accompany the optional resident chronicles: Radio Echo (Valley), Remembered Oath (Britain), Homeward Tide (Black Sail), Winter Ember (Winter), and Paper Lantern (Kyoto). Original restores the authored Dawn rifle/Refract Blade palette. Unlocks use the corresponding `campaign_<region>_complete` progress flag; the cosmetic store never creates these flags.

The settings control displays locked entries and explains their story source. Preferences use the isolated `parhelion.world.weapon.finish.v1` key. New-game/imported saves without an unlock render Original without deleting the preference; earning the flag again restores it. Denied storage retains an in-memory selection with an honest status message.

The actual authored weapon geometry, muzzle and hand anchors, hitboxes, textures, transparency, roughness, metalness, emissive strengths, weapon statistics, controls and Arena loadout/network state are unchanged. Material clones are private to each loaded weapon; disposal restores material ownership and releases each clone once. Selections made before an asynchronous model load are applied when that model becomes ready; late loads cannot reattach after cancellation.

Automated validation includes actual AR and blade material/geometry invariants, suffixed blade material names, pre-load selection, reversible changes, repeated disposal, denied/malformed storage, a real JSDOM control cycle, lock bypass attempts, language changes, new-game fallback, and current main progress/input tests. Offline material render inspection is a separate ongoing step; no browser or FPS claim is implied.
