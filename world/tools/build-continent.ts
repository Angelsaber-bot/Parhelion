export {};
// Preserve reviewed buildings and collision while rebuilding the shared landscape.
for(const tool of ['rebuild-continental-terrain','build-expansions','build-stream-assets']) {
  await import(`./${tool}.ts`);
}
