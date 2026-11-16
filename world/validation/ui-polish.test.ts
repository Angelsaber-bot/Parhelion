import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/worldInterface.css', import.meta.url), 'utf8');

test('drag-look: Escape closes the big map first, and leaving to the menu never leaves the map up', () => {
  const mapFirst = main.indexOf("if(dragLook&&e.code==='Escape'&&$('bigmap').classList.contains('open'))");
  const toMenu = main.indexOf("if(dragLook&&e.code==='Escape'){dragLook=false;");
  assert.ok(mapFirst > 0 && toMenu > mapFirst, 'the map check runs before the leave-to-menu branch');
  const first = main.slice(mapFirst, toMenu);
  assert.ok(first.includes("$('bigmap').classList.remove('open')") && first.includes('return;') && !first.includes('dragLook=false'), 'first press only closes the map');
  const menu = main.slice(toMenu, main.indexOf('\n', toMenu));
  assert.ok(menu.includes("$('bigmap').classList.remove('open')") && menu.includes('inspectServant=false'), 'the menu branch clears the map and the servant view');
});

test('travel panel: heading and close button stay in view on short windows, only the list scrolls', () => {
  assert.match(css, /\.travel-card\{display:flex;flex-direction:column;overflow:hidden;max-height:min\(90vh,calc\(100vh - 24px\)\)\}/);
  assert.match(css, /\.travel-card>h2,\.travel-card>p,\.travel-card>button\{flex:none\}/);
  assert.match(css, /\.travel-card>div\{flex:1 1 auto;min-height:0;overflow-y:auto/);
});

test('quest beacon: full at range, slimmer and fainter on approach, gone within a few steps', async () => {
  const { guideBeamLook, GUIDE_BEAM } = await import('../src/ui/guideBeamLook');
  const far = guideBeamLook(120, 0), mid = guideBeamLook(11, 0), near = guideBeamLook(2, 0);
  assert.equal(far.width, 1); assert.ok(Math.abs(far.opacity - GUIDE_BEAM.base) < 1e-9); assert.equal(far.visible, true);
  assert.ok(mid.opacity > 0 && mid.opacity < far.opacity && mid.width < 1 && mid.width > GUIDE_BEAM.slim);
  assert.equal(near.visible, false); assert.equal(near.opacity, 0); assert.equal(near.width, GUIDE_BEAM.slim, 'no drum over the desk it marks');
  for (let d = 0; d < 60; d += 1) assert.ok(guideBeamLook(d + 1, 0).opacity >= guideBeamLook(d, 0).opacity - 1e-12, 'never pops as you walk up');
  assert.ok(guideBeamLook(200, .15).opacity !== guideBeamLook(200, 0).opacity, 'still breathes');
  assert.equal(guideBeamLook(NaN, 0).visible, true, 'an unknown distance shows the beacon rather than hiding the objective');
});

test('controls panel and toasts never share the same spot: toasts lift above the open panel on narrow windows', () => {
  assert.ok(css.includes('@media(max-width:1572px){#toast{bottom:max(190px,var(--world-help-top,0px),var(--world-channel-top,0px))}}'), 'desktop: only where the two can overlap (panel right edge 464 + toast half-width 310)');
  assert.ok(css.includes('#toast{bottom:max(215px,var(--world-help-top,0px),var(--world-channel-top,0px));max-width:90vw;font-size:11px}'), 'phone layout follows the same variables');
  assert.ok(css.indexOf('@media(max-width:1572px){#toast') < css.indexOf('#toast{bottom:max(215px'), 'the phone rule comes later and wins there');
  const sync = main.slice(main.indexOf('function syncHelpClearance()'), main.indexOf('function togglePanel('));
  assert.ok(sync.includes("help.style.display !== 'none' && !!help.textContent") && sync.includes("'--world-help-top'") && sync.includes(": '0px'"), 'closed or empty panel clears the lift');
  assert.ok(main.includes("if (id === 'help' && typeof syncHelpClearance === 'function') syncHelpClearance();") && main.includes("addEventListener('resize', syncHelpClearance);"));
  assert.ok(main.includes("renderControlHints(); if (typeof syncHelpClearance === 'function') syncHelpClearance(); renderContract();"), 'a language switch re-measures the panel');
});

test('progress panels in the lower middle keep clear of the prompt, and toasts land above them', () => {
  assert.ok(css.includes('#toast{bottom:max(190px,var(--world-channel-top,0px));'), 'every width: the panels are centred like the toast');
  assert.ok(main.includes("gateChannelHud.id='kingdom-gate-channel';Object.assign(gateChannelHud.style,{position:'fixed',left:'50%',bottom:'max(25%, 176px)',"), 'never down in the prompt row on a short window');
  assert.ok(main.includes("Object.assign(relayChannelHud.style,{position:'fixed',left:'50%',bottom:'max(18%, 176px)',"));
  const sync = main.slice(main.indexOf('function syncChannelClearance()'), main.indexOf('function renderCompactRelayHud()'));
  assert.ok(sync.includes('if (hud.hidden) continue;') && sync.includes("'--world-channel-top'") && sync.includes('if (value !== channelClearance)'), 'hidden panels clear the lift; the style is only written when it changes');
  assert.ok(main.includes("renderCompactRelayHud(); if (typeof syncChannelClearance === 'function') syncChannelClearance(); }"));
});

test('off-screen objective marker rides the HUD-safe ellipse but stays out of the toast and prompt column', async () => {
  const { guideEdgePosition, GUIDE_EDGE } = await import('../src/ui/guideEdge');
  assert.deepEqual(guideEdgePosition(.2, .1, false), { edge: false, x: .2, y: .1, side: 0 }, 'on screen: untouched');
  const up = guideEdgePosition(0, 3, false); assert.ok(up.edge && Math.abs(up.y - GUIDE_EDGE.top) < 1e-9 && up.side === 0, 'above: top of the ellipse, centre allowed');
  // Dead behind (main.ts sends those to sy = -1): 1440 px wide, the column is ±340 px = ±0.472.
  const clear = GUIDE_EDGE.clearPx / 720;
  const behind = guideEdgePosition(.02, -1, true, 1440);
  assert.ok(behind.edge && Math.abs(behind.x - clear) < 1e-9 && behind.side === 1, `held right of the column (${behind.x.toFixed(3)})`);
  assert.ok(Math.abs((behind.x / GUIDE_EDGE.a) ** 2 + (behind.y / GUIDE_EDGE.bottom) ** 2 - 1) < 1e-9, 'still on the ellipse');
  assert.ok(behind.y < 0 && behind.y > -GUIDE_EDGE.bottom, 'and a little higher than the very bottom');
  assert.equal(guideEdgePosition(-.02, -1, true, 1440).side, -1, 'a target behind-left goes left');
  // Hysteresis: a target swinging through dead-behind does not flicker between sides.
  assert.equal(guideEdgePosition(-.02, -1, true, 1440, 1).side, 1); assert.equal(guideEdgePosition(-.3, -1, true, 1440, 1).side, -1);
  // Already outside the column: left where the ellipse puts it.
  const wide = guideEdgePosition(-2, -1, true, 1440); assert.ok(wide.side === 0 && wide.x < -clear);
  // A phone is narrower than the column: no room to step aside, so the old placement stands.
  const phone = guideEdgePosition(.02, -1, true, 390); assert.ok(phone.side === 0 && Math.abs(phone.x) < .05);
  assert.ok(main.includes('const placed = guideEdgePosition(sx, sy, behind, innerWidth, guideSide), edge = placed.edge;') && !main.includes('function guideEdgePosition('));
});

test('the uplink cabinet offers its prompt only while the exercise is running', () => {
  const nearest = main.slice(main.indexOf('function nearestInteract()'), main.indexOf('function canReachValleyPanel('));
  assert.ok(nearest.includes("if (m.id === 'compact_relay_controller' && typeof compactRelayRuntime !== 'undefined' && !compactRelayRuntime?.active) continue;"));
});
