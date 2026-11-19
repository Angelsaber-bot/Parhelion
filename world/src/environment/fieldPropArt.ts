import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Field-chapter props used to be bare coloured boxes: a 4 m dark slab for a portcullis, a brown brick for a
 * crossbow rack. From a few metres away they read as broken scenery. This turns the same size into a built
 * object (a plank panel with battens and end posts, a banded beam, a framed crate), keeping the exact
 * bounding size so gameplay offsets, glides and shot boxes are unchanged.
 */
export type FieldPropShape = 'sheet' | 'ladder' | 'panel' | 'beam' | 'crate';
type Vec = [number, number, number];
type Part = { size: Vec; at: Vec; layer: 0 | 1 | 2 };

export function fieldPropShape(size: readonly number[]): FieldPropShape {
  const sorted = [...size].sort((a, b) => a - b), [t, m, l] = sorted;
  if (t <= .09) return 'sheet';
  // Tall and narrow upright boards are ladders (K04's service ladder was a plank strip).
  if (t <= .42 && size[1] >= 1.8 && Math.max(size[0], size[2]) <= .7) return 'ladder';
  if (t <= .42 && m >= .7) return 'panel';
  if (m <= .65 && l >= .9) return 'beam';
  return 'crate';
}

/** Axis-aligned parts in prop-local space (layer 0 body, 1 darker trim, 2 iron). */
export function fieldPropParts(size: readonly number[]): Part[] {
  const [sx, sy, sz] = size, shape = fieldPropShape(size), parts: Part[] = [];
  const put = (s: Vec, at: Vec, layer: 0 | 1 | 2) => { if (s.every(v => v > 1e-4)) parts.push({ size: s, at, layer }); };
  const axis = (v: number, i: number): Vec => { const out: Vec = [0, 0, 0]; out[i] = v; return out; };
  const compose = (values: Record<number, number>): Vec => [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
  if (shape === 'sheet') { put([sx, sy, sz], [0, 0, 0], 0); return parts; }
  if (shape === 'ladder') {
    const wideX = sx >= sz, width = wideX ? sx : sz, depth = wideX ? sz : sx, rail = Math.min(.08, width * .16);
    for (const side of [-1, 1]) put(wideX ? [rail, sy, depth] : [depth, sy, rail], wideX ? [side * (width - rail) / 2, 0, 0] : [0, 0, side * (width - rail) / 2], 1);
    const rungs = Math.max(3, Math.floor(sy / .34));
    for (let i = 0; i < rungs; i++) { const y = -sy / 2 + sy * (i + .5) / rungs; put(wideX ? [width - rail, .05, depth * .6] : [depth * .6, .05, width - rail], [0, y, 0], 0); }
    return parts;
  }
  if (shape === 'panel') {
    const dims = [sx, sy, sz], thin = dims.indexOf(Math.min(...dims));
    const others = [0, 1, 2].filter(i => i !== thin);
    // Planks run upright on a standing panel, along the longer side on a lying one.
    const along = others.includes(1) ? 1 : (dims[others[0]] >= dims[others[1]] ? others[0] : others[1]);
    const across = others.find(i => i !== along)!;
    const length = dims[along], width = dims[across], depth = dims[thin], flat = thin === 1;
    const frame = Math.min(.12, width * .08), inner = width - frame * 2;
    const count = Math.max(2, Math.round(inner / .24)), plank = inner / count;
    for (let i = 0; i < count; i++) {
      const c = -inner / 2 + plank * (i + .5), shorten = (i % 3 === 1 ? .03 : 0) * length;
      // A deck keeps its walking surface flush with its collision top; standing boards are inset.
      const d = flat ? depth : depth * .72;
      put(compose({ [along]: length - (flat ? .02 : shorten + .02), [across]: plank * .9, [thin]: d }), compose({ [along]: flat ? 0 : -shorten / 2, [across]: c, [thin]: 0 }), 0);
    }
    // End posts along both long edges and two battens across the back.
    for (const side of [-1, 1]) put(compose({ [along]: length, [across]: frame, [thin]: depth }), compose({ [across]: side * (width / 2 - frame / 2) }), 1);
    const batten = Math.min(.16, length * .1);
    // Battens on the back (under a deck); big standing gates and barricades get iron straps on the face.
    if (!flat) for (const k of length > 1.2 ? [-.32, .32] : [0]) put(compose({ [along]: batten, [across]: inner, [thin]: depth * .3 }), compose({ [along]: k * length, [thin]: -depth * .36 }), 1);
    if (!flat && length * width > 4) for (const k of [-.32, .32]) put(compose({ [along]: batten * .55, [across]: inner, [thin]: depth * .12 }), compose({ [along]: k * length, [thin]: depth * .4 }), 2);
    return parts;
  }
  if (shape === 'beam') {
    const dims = [sx, sy, sz], long = dims.indexOf(Math.max(...dims)), length = dims[long];
    put([sx, sy, sz], [0, 0, 0], 0);
    const band = Math.min(.1, length * .06);
    for (const k of [-.4, .4]) { const s: Vec = [sx * 1.1, sy * 1.1, sz * 1.1]; s[long] = band; const at = axis(k * length, long); put(s, at, 2); }
    return parts;
  }
  // Crate or block: a framed body with corner posts and top and bottom rims.
  const edge = Math.min(Math.max(.05, Math.min(sx, sy, sz) * .1), .14);
  put([sx - edge, sy - edge, sz - edge], [0, 0, 0], 0);
  for (const x of [-1, 1]) for (const z of [-1, 1]) put([edge, sy, edge], [x * (sx - edge) / 2, 0, z * (sz - edge) / 2], 1);
  for (const y of [-1, 1]) {
    for (const z of [-1, 1]) put([sx, edge, edge], [0, y * (sy - edge) / 2, z * (sz - edge) / 2], 1);
    for (const x of [-1, 1]) put([edge, edge, sz], [x * (sx - edge) / 2, y * (sy - edge) / 2, 0], 1);
  }
  if (sy > .5 && sx > .5 && sz > .5) for (const z of [-1, 1]) put([sx - edge * 2, edge * .7, edge * .5], [0, 0, z * sz / 2], 1);
  return parts;
}

export interface FieldPropMaterials { body: THREE.Material; trim: THREE.Material; iron: THREE.Material }

/** One group with at most three merged meshes; the caller owns geometry disposal through `geometries`. */
export function buildFieldProp(size: readonly number[], materials: FieldPropMaterials, geometries: Set<THREE.BufferGeometry>): THREE.Group {
  const group = new THREE.Group(), layers: THREE.BufferGeometry[][] = [[], [], []];
  for (const part of fieldPropParts(size)) {
    const g = new THREE.BoxGeometry(...part.size); g.translate(...part.at); layers[part.layer].push(g);
  }
  layers.forEach((list, layer) => {
    if (!list.length) return;
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (merged && merged !== list[0]) list.forEach(g => g.dispose());
    for (const geometry of merged ? [merged] : list) {
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, layer === 0 ? materials.body : layer === 1 ? materials.trim : materials.iron);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = ['FieldPropBody', 'FieldPropTrim', 'FieldPropIron'][layer];
      group.add(mesh);
    }
  });
  return group;
}

/** Ground-standing posts for a prop whose lowest pose still hangs in the air (a raised rack, a lifted gate). */
export function supportPosts(prop: { size: readonly number[]; off: readonly number[]; rot?: readonly number[]; moved?: { off: readonly number[]; rot?: readonly number[] } },
  at: readonly number[], ground: (x: number, z: number, ceiling: number) => number | null): { x: number; z: number; bottom: number; top: number }[] {
  // Judged on the prop's starting pose: a rack that later falls leaves its posts standing, a gate that later
  // lifts straight up keeps them as its frame.
  if (prop.rot && (Math.abs(prop.rot[0]) > .05 || Math.abs(prop.rot[2]) > .05)) return [];
  if (fieldPropShape(prop.size) === 'ladder' || fieldPropShape(prop.size) === 'sheet') return [];
  const [sx, sy, sz] = prop.size, half = sy / 2, yaw = prop.rot?.[1] ?? 0, m = prop.moved?.off;
  const lifts = !!m && Math.abs(m[0] - prop.off[0]) < .05 && Math.abs(m[2] - prop.off[2]) < .05 && m[1] > prop.off[1];
  const lowest = prop.off[1] - half + at[1], highest = (lifts ? m![1] : prop.off[1]) + half + at[1];
  const cx = at[0] + prop.off[0], cz = at[2] + prop.off[2];
  const floor = ground(cx, cz, lowest - .05);
  if (floor === null || lowest - floor < .6 || lowest - floor > 9) return [];
  // Posts at the two ends of the longer horizontal side, just outside the prop.
  const wide = sx >= sz, reach = (wide ? sx : sz) / 2 + .1;
  const ux = wide ? Math.cos(yaw) : Math.sin(yaw), uz = wide ? -Math.sin(yaw) : Math.cos(yaw);
  const posts: { x: number; z: number; bottom: number; top: number }[] = [];
  for (const side of [-1, 1]) {
    const x = cx + ux * reach * side, z = cz + uz * reach * side, g = ground(x, z, lowest - .05);
    if (g === null || lowest - g > 9) return [];
    posts.push({ x, z, bottom: g - .1, top: highest + .15 });
  }
  return posts;
}

/** Warm brown, not stone grey, painted trim or cloth: the colours SiteArt uses for timber. */
export function timberColor(color: THREE.ColorRepresentation) {
  const hsl = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 });
  return hsl.h >= .03 && hsl.h <= .14 && hsl.s >= .16 && hsl.l >= .12 && hsl.l <= .6;
}
/** Big plain timber slabs in story-site art that read as unfinished blockout from a distance. */
export function timberSlab(size: readonly number[], color: THREE.ColorRepresentation) {
  const [t, m, l] = [...size].sort((a, b) => a - b);
  return t <= .45 && m >= 1.2 && l >= 1.6 && m * l >= 3 && timberColor(color) && fieldPropShape(size) === 'panel';
}
