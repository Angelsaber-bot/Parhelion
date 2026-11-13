/** Continuous top-facing strip. Shared corner sections prevent the triangular
 * holes made by independently capped quads at every river bend. */
export function polylineRibbon(points: readonly (readonly [number, number, number])[], width: number): number[] {
  if (points.length < 2 || width <= 0) return [];
  const normal = (a: readonly number[], b: readonly number[]) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    return length > 1e-6 ? [-dz / length, dx / length] : null;
  };
  const sections = points.map((p, i) => {
    const before = i > 0 ? normal(points[i - 1], p) : null;
    const after = i + 1 < points.length ? normal(p, points[i + 1]) : null;
    const a = before ?? after ?? [1, 0], b = after ?? a;
    let x = a[0] + b[0], z = a[1] + b[1], length = Math.hypot(x, z);
    if (length < 1e-6) { x = b[0]; z = b[1]; length = 1; }
    x /= length; z /= length;
    const reach = width / 2 / Math.max(.5, x * b[0] + z * b[1]);
    return [[p[0] + x * reach, p[1], p[2] + z * reach], [p[0] - x * reach, p[1], p[2] - z * reach]];
  });
  const vertices: number[] = [];
  for (let i = 1; i < sections.length; i++) {
    const [a, b] = sections[i - 1], [c, d] = sections[i];
    vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  return vertices;
}
