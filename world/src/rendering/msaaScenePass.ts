import * as THREE from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

/**
 * Scene pass with its own multisampled target, resolved once into the composer's
 * single-sample buffers.
 *
 * Giving EffectComposer multisampled targets makes every later pass (AO, bloom,
 * sun shafts, output) write into a multisampled half-float buffer and resolve it
 * again. On Apple-silicon GPUs that made high quality (4× MSAA) cost about twice
 * its scene render (tools/perf/bench.py). Geometry edges stay antialiased, because
 * only the scene draws need the samples. Full-screen post passes have no edges.
 */
export class MsaaScenePass extends RenderPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly copy = new FullScreenQuad(new THREE.ShaderMaterial({
    name: 'MsaaResolveCopy', uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
    vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  }));

  constructor(scene: THREE.Scene, camera: THREE.Camera, samples: number, type: THREE.TextureDataType = THREE.HalfFloatType) {
    super(scene, camera);
    this.target = new THREE.WebGLRenderTarget(1, 1, { samples, type });
    this.target.texture.name = 'MsaaScenePass.target';
  }

  setSize(width: number, height: number) { this.target.setSize(width, height); }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    if (this.target.width !== readBuffer.width || this.target.height !== readBuffer.height) this.target.setSize(readBuffer.width, readBuffer.height);
    const toScreen = this.renderToScreen;
    this.renderToScreen = false;
    super.render(renderer, writeBuffer, this.target, deltaTime, maskActive);
    this.renderToScreen = toScreen;
    const material = this.copy.material as THREE.ShaderMaterial;
    material.uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(toScreen ? null : readBuffer);
    this.copy.render(renderer);
  }

  dispose() { this.target.dispose(); this.copy.material.dispose(); this.copy.dispose(); }
}
