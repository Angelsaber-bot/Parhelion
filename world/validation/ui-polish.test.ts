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
