export {};
// Preserve reviewed buildings and collision while rebuilding the shared landscape;
// then seat join-band trees and rocks on the new ground.
for(const tool of ['rebuild-continental-terrain','reground-scatter','build-expansions','build-stream-assets']) {
  await import(`./${tool}.ts`);
}
