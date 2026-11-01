/** Authored compact yard coordinates. No renderer/progress dependency. */
export const COMPACT_RELAY = Object.freeze({entry:'compact_relay_entry',controller:'compact_relay_controller',deployment:'compact_relay_deployment'});
export const COMPACT_RELAY_MARKER_IDS = [COMPACT_RELAY.entry,COMPACT_RELAY.controller,COMPACT_RELAY.deployment] as const;
export const COMPACT_RELAY_SITE = Object.freeze({
 anchor:[-60,10.003314018249512,226] as const,
 entry:[-70,10.003314018249512,228] as const,
 channelStand:[-60,10.003314018249512,226] as const,
 deployment:[-82,10.003314018249512,231] as const,
 arrival:[-140,8.014726638793945,-12] as const,
 enemySockets:[[-51,10.003314018249512,228],[-64,10.003314018249512,218]] as const,
});
/** New obstacles leave the original helipad, armory and west-campus road intact. */
export const COMPACT_RELAY_COVER = [
 {id:'entry_plinth',x:-74.8,z:228,width:4.2,height:1.2,depth:.95},
 {id:'north_cable_spool',x:-68,z:214,width:3.2,height:1.25,depth:1},
 {id:'service_baffle',x:-55,z:226,width:.8,height:2.3,depth:5.4},
] as const;
export const COMPACT_RELAY_PLATFORM = Object.freeze({x:-44,width:4.5,north:206,deckStart:214,deckEnd:222,south:230,rise:1.2});
export const COMPACT_RELAY_ROUTES = Object.freeze({
 approach:[[-90,250],[-90,232],[-80,231],[-76,231],[-70,230],[-70,228]],
 short:[[-70,228],[-67,230],[-62,230],[-60,226]],
 flank:[[-70,228],[-76,224],[-76,202],[-44,202],[-44,206],[-44,218],[-44,230],[-49,232],[-60,232],[-60,226]],
 return:[[-60,226],[-62,230],[-76,231],[-90,232],[-90,250]],
} as const);
