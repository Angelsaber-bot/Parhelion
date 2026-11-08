// Anime ink lines as a post pass: a Sobel filter on linearised scene depth marks silhouettes and
// creases between surfaces at different depths, and darkens the colour there with a cool tint.
// Lines thin out with distance so far scenery stays soft. The viewmodel is drawn after this pass.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.05 },
    cameraFar: { value: 260 },
    strength: { value: 0.85 },
    thickness: { value: 1.5 },
    inkColor: { value: new THREE.Color(0x241a3a) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth;
    uniform vec2 resolution;
    uniform float cameraNear, cameraFar, strength, thickness;
    uniform vec3 inkColor;
    varying vec2 vUv;
    float lin(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return perspectiveDepthToViewZ(d, cameraNear, cameraFar) * -1.0;
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 px = thickness / resolution;
      float c = lin(vUv);
      if (c > cameraFar * 0.9) { gl_FragColor = col; return; } // sky
      float tl = lin(vUv + px * vec2(-1, 1)), t = lin(vUv + px * vec2(0, 1)), tr = lin(vUv + px * vec2(1, 1));
      float l = lin(vUv + px * vec2(-1, 0)), r = lin(vUv + px * vec2(1, 0));
      float bl = lin(vUv + px * vec2(-1, -1)), b = lin(vUv + px * vec2(0, -1)), br = lin(vUv + px * vec2(1, -1));
      float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
      float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
      float g = sqrt(gx * gx + gy * gy) / max(c, 0.5); // relative depth jump: scale-free
      float edge = smoothstep(0.06, 0.16, g) * (1.0 - smoothstep(22.0, 60.0, c));
      gl_FragColor = vec4(mix(col.rgb, col.rgb * 0.22 + inkColor * 0.3, edge * strength), col.a);
    }`,
};

export class OutlinePass extends ShaderPass {
  constructor(private camera: THREE.PerspectiveCamera) {
    super(OutlineShader);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.cameraNear.value = this.camera.near;
    this.uniforms.cameraFar.value = this.camera.far;
    this.uniforms.resolution.value.set(readBuffer.width, readBuffer.height);
    this.uniforms.thickness.value = Math.max(1.6, renderer.getPixelRatio() * 1.4); // ~1.5 CSS px lines
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  }
}
