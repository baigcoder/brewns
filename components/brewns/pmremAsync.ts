// @ts-nocheck
/* Environment lighting without the freeze. PMREMGenerator.fromScene compiles its filter
   shaders (the GGX one loops 256 times) the first time it draws with them, and that
   first draw waits for the compile on the main thread: over a second at page load in
   Chrome on Windows, where shaders go through Direct3D's compiler. Here those shaders
   are built first and compiled in parallel (renderer.compileAsync, which uses
   KHR_parallel_shader_compile where the GPU has it), under the state fromScene draws
   them in, a half-float render target. By the time fromScene draws, they are ready.
   It reaches into the generator's private setup, so if a three.js update changes that,
   it falls back to the plain, blocking call. */
export async function environmentFromScene(T, renderer, scene, sigma = 0) {
  const pmrem = new T.PMREMGenerator(renderer);
  try {
    await warmFilters(T, renderer, pmrem, scene);
  } catch (error) {
    console.warn('environment: shaders not compiled ahead', error);
  }
  const environment = pmrem.fromScene(scene, sigma);
  pmrem.dispose();
  return environment;
}

async function warmFilters(T, renderer, pmrem, scene) {
  if (!renderer.compileAsync || !pmrem._setSize || !pmrem._allocateTargets) return;
  pmrem._setSize(256); // fromScene's default size, so it keeps the materials built here
  const target = pmrem._allocateTargets();
  const filters = [pmrem._blurMaterial, pmrem._ggxMaterial].filter(Boolean);
  const plane = pmrem._lodMeshes?.[0]?.geometry;
  if (!filters.length || !plane) return target.dispose();
  const warm = new T.Scene();
  for (const material of filters) warm.add(new T.Mesh(plane, material));
  scene.traverse((node) => node.isMesh && warm.add(new T.Mesh(node.geometry, node.material)));
  const camera = new T.OrthographicCamera();
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  // compileAsync creates the programs right away, under the target set above; only the
  // wait for the GPU to finish them is asynchronous.
  const ready = renderer.compileAsync(warm, camera);
  renderer.setRenderTarget(previous);
  await ready;
  target.dispose();
}
