#!/usr/bin/env python3
"""Parhelion GPU/frame benchmark for World and Arena.

Runs a silent headless Chromium on the real GPU (ANGLE Metal on macOS) with
vsync and the frame cap off, so each number is the work one frame costs, not a
60 Hz wait. GPU time comes from EXT_disjoint_timer_query_webgl2.

Serve a build first (for example the "site-dist" launch entry, which serves
site/dist/public on :4190), then:

  python3 tools/perf/bench.py world --q med --out _local/perf/world-med.json
  python3 tools/perf/bench.py arena --q high --out _local/perf/arena-high.json
  python3 tools/perf/bench.py compare _local/perf/before.json _local/perf/after.json

World visits every safe-travel stop (flying, fixed yaw). Arena starts an
offline match on each map with Math.random seeded, so every run gets the same
bot heroes and kits and the maps can be compared fairly. Add --shots DIR to save
a screenshot per view for before/after image comparison.

Needs the Python `playwright` package and its Chromium (`playwright install chromium`).
"""
import argparse, json, os, sys, time

ARGS = ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu',
        '--disable-gpu-vsync', '--disable-frame-rate-limit', '--autoplay-policy=user-gesture-required']
ARENA_MAPS = ['aster', 'camlann', 'blackflag', 'frostcourt', 'sakura', 'homeward', 'lishan', 'orleans', 'suntemple']

# Times composer.render (or renderer.render with ?nopost) for `frames` frames.
WORLD_SAMPLE = """async (frames) => {
  const w = window.__world, r = w.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const target = w.composer ?? r, original = target.render, pending = [], gpu = [], cpu = [], frame = [], js = [];
  let calls = 0, tris = 0;
  target.render = function (...a) {
    const q = ext ? gl.createQuery() : null; if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const t0 = performance.now(); const res = original.apply(this, a); cpu.push(performance.now() - t0);
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); }
    calls = r.info.render.calls; tris = r.info.render.triangles; return res;
  };
  await new Promise(done => { let n = 0, last = performance.now(); const tick = () => {
    const now = performance.now(); frame.push(now - last); last = now; js.push(window.__perfJs ?? NaN); window.__perfJs = 0;
    for (let i = pending.length - 1; i >= 0; i--) { const q = pending[i];
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); pending.splice(i, 1); } }
    ++n < frames ? requestAnimationFrame(tick) : done(); }; requestAnimationFrame(tick); });
  target.render = original;
  const s = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? { med: +a[a.length >> 1].toFixed(2), p95: +a[Math.floor(a.length * .95)].toFixed(2) } : null; };
  return { gpu: s(gpu), cpu: s(cpu), js: s(js.slice(3)), frame: s(frame.slice(3)), calls, tris, programs: r.info.programs?.length ?? null, dpr: r.getPixelRatio() };
}"""

# Installed before the page loads: seeded Math.random, a draw counter on the game
# canvas's context and a GPU timer around every animation-frame callback.
ARENA_INIT = """(() => {
  let seed = 0x9e3779b9; Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = getContext.call(this, type, ...a);
    if (type === 'webgl2' && c && this.id && !window.__perfGl) { window.__perfGl = c; window.__perfDraws = 0;
      for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = c[f].bind(c); c[f] = (...x) => { window.__perfDraws++; return o(...x); }; } }
    return c; };
  const raf = window.requestAnimationFrame.bind(window), pending = []; let active = false;
  window.__perf = { gpu: [], draws: [] };
  window.requestAnimationFrame = cb => raf(t => {
    const gl = window.__perfGl, ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2'); let q = null;
    if (ext && !active) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); active = true; }
    const d0 = window.__perfDraws ?? 0;
    try { cb(t); } finally {
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); active = false; const d = (window.__perfDraws ?? 0) - d0; if (d > 0) { pending.push(q); window.__perf.draws.push(d); } else gl.deleteQuery(q); }
      for (let i = pending.length - 1; gl && i >= 0; i--) { const p = pending[i];
        if (gl.getQueryParameter(p, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) window.__perf.gpu.push(gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(p); pending.splice(i, 1); } }
    } });
})()"""
ARENA_TAKE = """() => { const s = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? { med: +a[a.length >> 1].toFixed(2), p95: +a[Math.floor(a.length * .95)].toFixed(2), n: a.length } : null; };
  const r = { gpu: s(window.__perf.gpu), draws: s(window.__perf.draws) }; window.__perf.gpu = []; window.__perf.draws = []; return r; }"""


# World: time spent in animation-frame callbacks (the game's whole JS frame).
WORLD_INIT = """(() => { const raf = window.requestAnimationFrame.bind(window); window.__perfJs = 0;
  window.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); try { cb(t); } finally { window.__perfJs += performance.now() - t0; } }); })()"""


def launch(pw):
    return pw.chromium.launch(headless=True, args=ARGS)


def gpu_name(page):
    return page.evaluate("""() => { const c = document.createElement('canvas').getContext('webgl2'), e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; }""")


def run_world(a):
    from playwright.sync_api import sync_playwright
    out = {'kind': 'world', 'q': a.q, 'viewport': [a.width, a.height], 'views': []}
    with sync_playwright() as pw:
        b = launch(pw); page = b.new_page(viewport={'width': a.width, 'height': a.height}); page.add_init_script(WORLD_INIT)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        t0 = time.time()
        page.goto(f"{a.url}/world/?q={a.q}&resolution=native{a.extra}")
        page.wait_for_function('() => window.__world?.ready', timeout=180000)
        out['bootSeconds'] = round(time.time() - t0, 1); out['gpuName'] = gpu_name(page)
        stops = page.evaluate('() => window.__world.travelStops.map(s => ({ id: s.id, p: s.position }))')
        for stop in stops:
            if a.only and stop['id'] not in a.only.split(','): continue
            page.evaluate("""(s) => { const w = window.__world, [x, y, z] = s.p; w.player.flying = true; w.player.teleport(x, y + 2, z, 0); }""", stop)
            page.wait_for_timeout(a.settle)
            row = {'id': stop['id'], **page.evaluate(WORLD_SAMPLE, a.frames)}
            out['views'].append(row); print(json.dumps(row), file=sys.stderr)
            if a.shots: page.screenshot(path=os.path.join(a.shots, f"world-{a.q}-{stop['id']}.png"))
        out['errors'] = errors; b.close()
    return out


def run_arena(a):
    from playwright.sync_api import sync_playwright
    out = {'kind': 'arena', 'q': a.q, 'viewport': [a.width, a.height], 'views': []}
    maps = a.only.split(',') if a.only else ARENA_MAPS
    with sync_playwright() as pw:
        b = launch(pw)
        for m in maps:
            ctx = b.new_context(viewport={'width': a.width, 'height': a.height})
            ctx.add_init_script(ARENA_INIT)
            ctx.add_init_script(f"try{{localStorage.setItem('parhelion-arena-graphics-v2','{'high' if a.q == 'high' else 'low'}')}}catch{{}}")
            page = ctx.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(f"{a.url}/arena/?map={m}&autostart&test&mute{'&low' if a.q == 'low' else ''}{a.extra}")
            if 'gpuName' not in out: out['gpuName'] = gpu_name(page)
            page.wait_for_timeout(a.settle + 5000); page.evaluate(ARENA_TAKE)
            page.mouse.move(a.width / 2, a.height / 2); page.keyboard.down('w'); page.mouse.down()
            page.wait_for_timeout(a.frames * 16)
            page.keyboard.up('w'); page.mouse.up()
            row = {'id': m, **page.evaluate(ARENA_TAKE), 'errors': errors[:3]}
            if a.shots: page.screenshot(path=os.path.join(a.shots, f"arena-{a.q}-{m}.png"))
            out['views'].append(row); print(json.dumps(row), file=sys.stderr); ctx.close()
        b.close()
    return out


def compare(a, b):
    A, B = json.load(open(a)), json.load(open(b))
    rows = {v['id']: v for v in A['views']}
    print(f"{A['kind']} q={A['q']} → q={B['q']}   GPU ms (median)            draws")
    total = [0, 0]
    for v in B['views']:
        o = rows.get(v['id'])
        if not o or not o.get('gpu') or not v.get('gpu'): continue
        g0, g1 = o['gpu']['med'], v['gpu']['med']; total[0] += g0; total[1] += g1
        d0 = o.get('calls', (o.get('draws') or {}).get('med')); d1 = v.get('calls', (v.get('draws') or {}).get('med'))
        print(f"  {v['id']:<24} {g0:7.2f} → {g1:7.2f}  ({(g1 - g0) / g0 * 100:+5.0f}%)   {d0} → {d1}")
    if total[0]: print(f"  {'sum':<24} {total[0]:7.2f} → {total[1]:7.2f}  ({(total[1] - total[0]) / total[0] * 100:+5.0f}%)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('kind', choices=['world', 'arena', 'compare'])
    p.add_argument('files', nargs='*', help='compare: before.json after.json')
    p.add_argument('--q', default='med', help='world: low|med|high; arena: low|high')
    p.add_argument('--url', default='http://127.0.0.1:4190')
    p.add_argument('--only', default='', help='comma-separated travel stops or maps')
    p.add_argument('--extra', default='', help='extra query string, e.g. "&nopost"')
    p.add_argument('--frames', type=int, default=150)
    p.add_argument('--settle', type=int, default=7000, help='ms to wait after each teleport/load')
    p.add_argument('--width', type=int, default=1600); p.add_argument('--height', type=int, default=900)
    p.add_argument('--shots', default='', help='directory for screenshots')
    p.add_argument('--out', default='')
    a = p.parse_args()
    if a.kind == 'compare': return compare(*a.files)
    if a.shots: os.makedirs(a.shots, exist_ok=True)
    res = run_world(a) if a.kind == 'world' else run_arena(a)
    res['when'] = time.strftime('%Y-%m-%dT%H:%M:%S')
    if a.out:
        os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True); json.dump(res, open(a.out, 'w'), indent=1)
    else: print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
