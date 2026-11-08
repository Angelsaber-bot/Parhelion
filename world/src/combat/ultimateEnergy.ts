import * as THREE from 'three';
/** Original feathered cinematic strokes. RGBA edges/ends vanish, no opaque tube caps. */
export function ultimateEnergyGeometry(kind: 'lance' | 'arc') {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const stroke = (width: number, strength: number, offset: number, core: boolean, layer: number) => {
    const base = positions.length / 3, steps = 36;
    for (let i = 0; i <= steps; i++) for (let j = 0; j < 5; j++) {
      const t = i / steps, across = (j - 2) / 2, envelope = Math.pow(Math.sin(t * Math.PI), .65);
      if (kind === 'lance') positions.push(offset * Math.sin(t * Math.PI) + across * width * envelope, (t - .5) * 12, layer);
      else { const angle = -.35 + t * Math.PI * 1.35, radius = 2.3 + offset + across * width * envelope; positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, layer); }
      const alpha = Math.pow(Math.max(0, 1 - Math.abs(across)), 1.3) * envelope * strength;
      colors.push(1, core ? 1 : .91, core ? 1 : .66, alpha);
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < 4; j++) { const a = base + i * 5 + j, b = a + 5; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  };
  stroke(kind === 'lance' ? .72 : .18, .18, 0, false, 0);
  stroke(kind === 'lance' ? .22 : .055, .76, 0, true, .006);
  for (const side of [-1, 1]) stroke(.025, .32, side * (kind === 'lance' ? .66 : .15), true, side === 1 ? .012 : .018);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
}
