/** Per-finish scope themes for the sniper and DMR: the dark surround around the lens comes alive
 * (fire, lightning, frost, petals, bubbles, gears, ink, feathers, rain) and the reticle lines take
 * the theme's colours and line style. All effects are stateless functions of time, drawn on the
 * scope canvas; none of them moves the aim. */

type G = CanvasRenderingContext2D;
export interface FxContext { cx: number; cy: number; R: number; w: number; h: number; t: number }
export type LineStyle = 'solid' | 'flame' | 'electric' | 'frost';
export interface ScopeTheme {
  name: readonly [string, string];
  surround: readonly [string, string]; // tint at the lens edge, tint at the screen corners
  line: string; // reticle line colour
  glow: string; // reticle glow / lit centre
  style: LineStyle;
  fx: (g: G, c: FxContext) => void;
}

const TAU = Math.PI * 2;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wave = (x: number) => (Math.sin(x * 1.7) + Math.sin(x * 2.9 + 1.3) + Math.sin(x * 4.3 + 2.1)) / 3;
const polar = (c: FxContext, a: number, r: number): [number, number] => [c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r];
/** Everything drawn inside `paint` stays outside the lens (or within `inset` of its edge). */
function outside(g: G, c: FxContext, paint: () => void, inset = 0) {
  g.save(); g.beginPath(); g.rect(0, 0, c.w, c.h); g.arc(c.cx, c.cy, c.R - inset, 0, TAU, true); g.clip('evenodd'); paint(); g.restore();
}
function ringGlow(g: G, c: FxContext, colour: string, inner: number, outer: number, peak = .25) {
  const grad = g.createRadialGradient(c.cx, c.cy, c.R * inner, c.cx, c.cy, c.R * outer);
  grad.addColorStop(0, colour.replace('ALPHA', '0')); grad.addColorStop(peak, colour.replace('ALPHA', '.38')); grad.addColorStop(1, colour.replace('ALPHA', '0'));
  g.fillStyle = grad; g.beginPath(); g.arc(c.cx, c.cy, c.R * outer, 0, TAU); g.arc(c.cx, c.cy, c.R * inner, 0, TAU, true); g.fill('evenodd');
}

/** Flames licking in over the lens edge and out into the dark, with rising embers. */
function fire(g: G, c: FxContext) {
  g.save(); g.globalCompositeOperation = 'lighter';
  ringGlow(g, c, 'rgba(255,120,30,ALPHA)', .88, 1.5, .2);
  outside(g, c, () => {
    // Two passes: a soft blurred body of fire, then crisp swaying tongues of uneven height.
    for (const pass of [0, 1]) {
      g.filter = pass ? 'none' : 'blur(7px)';
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * TAU + Math.sin(c.t * .7 + i) * .03, flick = .5 + .5 * wave(c.t * 3.4 + i * 1.37), tall = hash(i * 5) > .7 ? 1.6 : 1;
        for (const dir of [-1, 1]) {
          const len = c.R * (dir < 0 ? .04 + .08 * flick : (.08 + .2 * flick) * tall) * (.7 + .6 * hash(i * 3 + dir)) * (pass ? 1 : 1.25);
          const half = c.R * (.035 + .03 * hash(i)) * (pass ? .7 : 1.4), sway = Math.sin(c.t * 5 + i * 2.1) * .07 + Math.sin(c.t * 2.3 + i) * .04;
          const [bx, by] = polar(c, a, c.R + c.R * .012), [tx, ty] = polar(c, a + sway, c.R + dir * len), [mx, my] = polar(c, a + sway * .5, c.R + dir * len * .55);
          const nx = -Math.sin(a) * half, ny = Math.cos(a) * half;
          const grad = g.createLinearGradient(bx, by, tx, ty);
          grad.addColorStop(0, pass ? 'rgba(255,248,205,.95)' : 'rgba(255,200,90,.5)'); grad.addColorStop(.3, pass ? 'rgba(255,175,55,.8)' : 'rgba(255,120,30,.45)');
          grad.addColorStop(.7, pass ? 'rgba(235,70,20,.5)' : 'rgba(200,40,10,.3)'); grad.addColorStop(1, 'rgba(120,10,0,0)');
          g.fillStyle = grad; g.beginPath(); g.moveTo(bx + nx, by + ny); g.quadraticCurveTo(mx + nx * .8, my + ny * .8, tx, ty); g.quadraticCurveTo(mx - nx * .8, my - ny * .8, bx - nx, by - ny); g.closePath(); g.fill();
        }
      }
    }
    g.filter = 'none';
    for (let i = 0; i < 70; i++) {
      const p = (c.t * (.18 + .12 * hash(i)) + hash(i + 50)) % 1, a = hash(i + 9) * TAU, [x, y] = polar(c, a, c.R * (1.02 + .35 * hash(i + 3)));
      const ey = y - p * c.h * .35, ex = x + Math.sin(c.t * 2 + i) * 12;
      g.fillStyle = `rgba(255,${150 + 80 * hash(i)},60,${(1 - p) * .9})`; g.beginPath(); g.arc(ex, ey, 1.2 + 2 * hash(i + 7), 0, TAU); g.fill();
    }
  }, c.R * .14);
  g.restore();
}

/** Crimson lightning crawling round the rim and forking out into the dark. */
function lightning(g: G, c: FxContext) {
  const seed = Math.floor(c.t * 14), flash = hash(seed * 7.3) > .78;
  g.save(); g.globalCompositeOperation = 'lighter';
  ringGlow(g, c, `rgba(255,40,90,ALPHA)`, .92, flash ? 1.7 : 1.35, .15);
  outside(g, c, () => {
    const bolt = (pts: [number, number][], width: number) => {
      for (const [lw, col] of [[width * 4, 'rgba(255,40,90,.22)'], [width * 1.8, 'rgba(255,90,140,.7)'], [width * .7, 'rgba(255,240,250,.95)']] as const) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      }
    };
    for (let k = 0; k < 7; k++) { // arcs hugging the rim
      const a0 = hash(seed * 13 + k) * TAU, span = .3 + .6 * hash(seed * 5 + k), pts: [number, number][] = [];
      for (let s = 0; s <= 14; s++) pts.push(polar(c, a0 + span * s / 14, c.R * (1.01 + (hash(seed * 31 + k * 17 + s) - .5) * .07)));
      bolt(pts, 1.6);
    }
    for (let k = 0; k < (flash ? 6 : 3); k++) { // forks out toward the screen edge
      const a = hash(seed * 3 + k * 11) * TAU, reach = c.R * (.35 + .9 * hash(seed + k)), pts: [number, number][] = [];
      for (let s = 0; s <= 10; s++) { const r = c.R * 1.01 + reach * s / 10, wob = (hash(seed * 17 + k * 7 + s) - .5) * .18 * (s / 10 + .3); pts.push(polar(c, a + wob, r)); }
      bolt(pts, flash ? 2.2 : 1.4);
    }
  }, c.R * .04);
  g.restore();
}

/** Ice shards creeping in from the rim, a frosted edge and drifting snow. */
function frost(g: G, c: FxContext) {
  ringGlow(g, c, 'rgba(190,235,255,ALPHA)', .84, 1.3, .3);
  outside(g, c, () => {
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * TAU + hash(i) * .1, len = c.R * (.04 + .12 * hash(i + 4)) * (.85 + .15 * Math.sin(c.t * .8 + i)), half = c.R * (.012 + .01 * hash(i + 2));
      const [bx, by] = polar(c, a, c.R * 1.02), [tx, ty] = polar(c, a + (hash(i + 8) - .5) * .05, c.R - len), nx = -Math.sin(a) * half, ny = Math.cos(a) * half;
      g.fillStyle = 'rgba(200,240,255,.55)'; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(bx + nx, by + ny); g.lineTo(tx, ty); g.lineTo(bx - nx, by - ny); g.closePath(); g.fill(); g.stroke();
    }
    for (let i = 0; i < 80; i++) {
      const x = hash(i) * c.w, y = ((c.t * (12 + 20 * hash(i + 1)) + hash(i + 2) * c.h) % (c.h + 20)) - 10, s = 1.5 + 2.5 * hash(i + 3), rot = c.t * .5 + i;
      g.strokeStyle = `rgba(230,248,255,${.35 + .45 * hash(i + 5)})`; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const a = rot + k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); g.stroke(); }
    }
  }, c.R * .16);
}

function petal(g: G, x: number, y: number, size: number, rot: number, fill: string) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = fill; g.beginPath(); g.moveTo(0, -size); g.quadraticCurveTo(size * .9, -size * .2, 0, size); g.quadraticCurveTo(-size * .9, -size * .2, 0, -size); g.fill(); g.restore();
}
/** Sakura petals swirling round the lens. */
function sakura(g: G, c: FxContext, colours = ['rgba(255,183,207,.85)', 'rgba(255,214,228,.8)', 'rgba(244,140,175,.8)'], count = 90) {
  ringGlow(g, c, 'rgba(255,150,190,ALPHA)', .9, 1.3, .25);
  outside(g, c, () => {
    for (let i = 0; i < count; i++) {
      const a = hash(i) * TAU + c.t * (.12 + .18 * hash(i + 1)), r = c.R * (1.03 + .55 * hash(i + 2)) + Math.sin(c.t + i) * 10;
      const [x, y] = polar(c, a, r);
      petal(g, x, y + ((c.t * 18 * hash(i + 4)) % 60), 4 + 5 * hash(i + 3), c.t * (1 + hash(i)) + i, colours[i % colours.length]);
    }
  }, c.R * .05);
}
/** A thorned vine ring with roses, and rose petals drifting through the dark. */
function rose(g: G, c: FxContext) {
  sakura(g, c, ['rgba(176,30,70,.85)', 'rgba(220,70,110,.8)', 'rgba(140,20,50,.85)'], 50);
  outside(g, c, () => {
    g.strokeStyle = 'rgba(46,92,58,.95)'; g.lineWidth = 5; g.beginPath();
    for (let s = 0; s <= 240; s++) { const a = s / 240 * TAU, [x, y] = polar(c, a, c.R * (1.035 + .022 * Math.sin(a * 9 + c.t * .4))); s ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU, r = c.R * (1.035 + .022 * Math.sin(a * 9 + c.t * .4)), out = i % 2 ? 1 : -1;
      const [x, y] = polar(c, a, r), [tx, ty] = polar(c, a + .012, r + out * 11);
      g.fillStyle = 'rgba(30,60,40,.95)'; g.beginPath(); g.moveTo(x - Math.sin(a) * 3, y + Math.cos(a) * 3); g.lineTo(tx, ty); g.lineTo(x + Math.sin(a) * 3, y - Math.cos(a) * 3); g.fill();
    }
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU + .3, [x, y] = polar(c, a, c.R * 1.09);
      for (let p = 0; p < 6; p++) petal(g, x + Math.cos(p) * 5, y + Math.sin(p) * 5, 10 - p, p * 1.1 + c.t * .1, p % 2 ? 'rgba(200,40,80,.95)' : 'rgba(240,90,130,.9)');
    }
  });
}
/** Deep-sea light: bubbles rising and caustic shimmer around the rim. */
function abyss(g: G, c: FxContext) {
  ringGlow(g, c, 'rgba(60,200,255,ALPHA)', .9, 1.4, .2);
  outside(g, c, () => {
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(140,230,255,${.25 - k * .04})`; g.lineWidth = 2; g.beginPath();
      for (let s = 0; s <= 180; s++) { const a = s / 180 * TAU, [x, y] = polar(c, a, c.R * (1.02 + k * .04 + .012 * Math.sin(a * 7 + c.t * 2 + k))); s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = hash(i) * c.w + Math.sin(c.t * 1.5 + i) * 8, y = c.h + 20 - ((c.t * (30 + 50 * hash(i + 1)) + hash(i + 2) * c.h) % (c.h + 40)), r = 2 + 6 * hash(i + 3);
      g.strokeStyle = 'rgba(170,240,255,.55)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(230,255,255,.7)'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .25, 0, TAU); g.fill();
    }
    for (let i = 0; i < 30; i++) { const [x, y] = polar(c, hash(i + 40) * TAU, c.R * (1.1 + .5 * hash(i + 41))); g.fillStyle = `rgba(120,255,230,${.3 + .4 * (.5 + .5 * Math.sin(c.t * 3 + i))})`; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
  }, c.R * .02);
}
function gearRing(g: G, c: FxContext, r: number, teeth: number, depth: number, spin: number, fill: string, stroke: string) {
  g.beginPath();
  for (let k = 0; k < teeth * 4; k++) { const a = spin + k / (teeth * 4) * TAU, rr = r + (k % 4 < 2 ? depth : 0), [x, y] = polar(c, a, rr); k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.arc(c.cx, c.cy, r - depth * 1.6, 0, TAU, true);
  g.fillStyle = fill; g.fill('evenodd'); g.strokeStyle = stroke; g.lineWidth = 1.2; g.stroke();
}
/** Brass clockwork: two gear rings turning against each other, a clock face and forge sparks. */
function clockwork(g: G, c: FxContext) {
  outside(g, c, () => {
    gearRing(g, c, c.R * 1.07, 48, c.R * .03, c.t * .15, 'rgba(120,86,40,.9)', 'rgba(240,200,120,.85)');
    gearRing(g, c, c.R * 1.2, 64, c.R * .022, -c.t * .1, 'rgba(90,64,30,.85)', 'rgba(220,180,100,.7)');
    for (let k = 0; k < 60; k++) { const a = k / 60 * TAU, long = k % 5 === 0, [x0, y0] = polar(c, a, c.R * 1.27), [x1, y1] = polar(c, a, c.R * (long ? 1.33 : 1.3)); g.strokeStyle = long ? 'rgba(255,220,150,.85)' : 'rgba(220,180,110,.5)'; g.lineWidth = long ? 2.4 : 1.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    const hand = c.t * TAU / 60, [hx, hy] = polar(c, hand - Math.PI / 2, c.R * 1.36); g.strokeStyle = 'rgba(255,230,170,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(...polar(c, hand - Math.PI / 2, c.R * 1.27)); g.lineTo(hx, hy); g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) { const p = (c.t * (.5 + hash(i)) + hash(i + 2)) % 1, a = Math.PI * (.35 + .3 * hash(i + 4)), [x, y] = polar(c, a, c.R * (1.05 + p * .4)); g.fillStyle = `rgba(255,${190 + 50 * hash(i)},90,${1 - p})`; g.beginPath(); g.arc(x, y + p * 30, 1.5, 0, TAU); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  });
}
/** Ink-wash clouds swirling round the lens with a gilt wave line. */
function inkwash(g: G, c: FxContext) {
  outside(g, c, () => {
    for (let i = 0; i < 18; i++) {
      const a = hash(i) * TAU + c.t * .04 * (i % 2 ? 1 : -1), [x, y] = polar(c, a, c.R * (1.05 + .25 * hash(i + 1))), r = c.R * (.16 + .16 * hash(i + 2));
      const grad = g.createRadialGradient(x, y, 0, x, y, r); grad.addColorStop(0, 'rgba(40,90,78,.55)'); grad.addColorStop(.6, 'rgba(30,70,62,.25)'); grad.addColorStop(1, 'rgba(20,50,45,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (const [k, alpha] of [[0, .85], [1, .45]] as const) {
      g.strokeStyle = `rgba(230,195,110,${alpha})`; g.lineWidth = 2.2 - k; g.beginPath();
      for (let s = 0; s <= 240; s++) { const a = s / 240 * TAU, [x, y] = polar(c, a, c.R * (1.03 + k * .03) + Math.sin(a * 14 + c.t * .8 + k) * c.R * .01); s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  });
}
/** Moonlight halo and night feathers drifting past. */
function feathers(g: G, c: FxContext) {
  ringGlow(g, c, 'rgba(190,170,255,ALPHA)', .9, 1.45, .2);
  outside(g, c, () => {
    for (let i = 0; i < 26; i++) {
      const a = hash(i) * TAU + c.t * (.05 + .05 * hash(i + 1)), [x, y] = polar(c, a, c.R * (1.08 + .45 * hash(i + 2))), len = 14 + 14 * hash(i + 3), rot = a + Math.PI / 2 + Math.sin(c.t + i) * .4;
      g.save(); g.translate(x, y + Math.sin(c.t * .7 + i) * 6); g.rotate(rot);
      g.fillStyle = 'rgba(200,190,240,.55)'; g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(len * .35, 0, 0, len); g.quadraticCurveTo(-len * .3, 0, 0, -len); g.fill();
      g.strokeStyle = 'rgba(245,240,255,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -len); g.lineTo(0, len * 1.2); g.stroke(); g.restore();
    }
  });
}
/** Mother-of-pearl sheen round the rim and iridescent rain. */
function nacre(g: G, c: FxContext) {
  outside(g, c, () => {
    const conic = (g as G & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient?.(c.t * .3, c.cx, c.cy);
    if (conic) { for (const [s, col] of [[0, '#9fe8ff'], [.2, '#d8b6ff'], [.4, '#ffd6f0'], [.6, '#b8ffe2'], [.8, '#fff3c4'], [1, '#9fe8ff']] as const) conic.addColorStop(s, col); g.strokeStyle = conic; }
    else g.strokeStyle = 'rgba(210,220,255,.6)';
    g.globalAlpha = .7; g.lineWidth = c.R * .035; g.beginPath(); g.arc(c.cx, c.cy, c.R * 1.03, 0, TAU); g.stroke(); g.globalAlpha = 1;
    for (let i = 0; i < 110; i++) {
      const x = hash(i) * (c.w + 200) - 100, y = ((c.t * (380 + 200 * hash(i + 1)) + hash(i + 2) * c.h) % (c.h + 60)) - 30;
      g.strokeStyle = `hsla(${(hash(i + 3) * 360 + c.t * 40) % 360},80%,85%,${.25 + .3 * hash(i + 4)})`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 18); g.stroke();
    }
  });
}

export const SCOPE_THEMES: Record<string, ScopeTheme> = {
  'void-lance': { name: ['星渊雷暴', 'Void storm'], surround: ['#14040c', '#040103'], line: '#ff4d7a', glow: '#ffd0dc', style: 'electric', fx: lightning },
  'glacier-survey': { name: ['冰川霜镜', 'Glacier frost'], surround: ['#04121c', '#010408'], line: '#9fe6ff', glow: '#ffffff', style: 'frost', fx: frost },
  'velvet-thorn': { name: ['荆棘蔷薇', 'Thorned rose'], surround: ['#160409', '#040102'], line: '#f4a3b6', glow: '#ffe2ea', style: 'solid', fx: rose },
  'abyssal-requiem': { name: ['深海回响', 'Abyssal light'], surround: ['#021320', '#010409'], line: '#62f0ff', glow: '#d6fbff', style: 'solid', fx: abyss },
  'meridian-key': { name: ['黄铜钟械', 'Brass clockwork'], surround: ['#140d04', '#040301'], line: '#f2c66b', glow: '#fff1c8', style: 'solid', fx: clockwork },
  'brass-horizon': { name: ['烈日火环', 'Solar fire'], surround: ['#1a0602', '#050100'], line: '#ff9a3c', glow: '#fff1b0', style: 'flame', fx: fire },
  'celadon-atlas': { name: ['青瓷水墨', 'Celadon ink'], surround: ['#06120f', '#010403'], line: '#7fe0c0', glow: '#f2ffe9', style: 'solid', fx: inkwash },
  'owl-canticle': { name: ['月夜羽影', 'Moonlit feathers'], surround: ['#0b0816', '#020104'], line: '#c8b8ff', glow: '#f4efff', style: 'solid', fx: feathers },
  'night-nacre': { name: ['螺钿雨幕', 'Nacre rain'], surround: ['#0a0d16', '#020204'], line: '#e8f0ff', glow: '#ffffff', style: 'solid', fx: nacre },
  'petal-scabbard': { name: ['樱吹雪', 'Sakura storm'], surround: ['#160710', '#040103'], line: '#ffb7cf', glow: '#fff0f6', style: 'solid', fx: (g, c) => sakura(g, c) },
};
export const scopeTheme = (skinId?: string): ScopeTheme | undefined => skinId ? SCOPE_THEMES[skinId] : undefined;
