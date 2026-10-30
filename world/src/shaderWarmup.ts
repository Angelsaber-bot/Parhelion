/** Optional, bounded shader preparation. Never blocks entry on unsupported drivers or a failed warmup.
 * No GPU/FPS improvement is inferred from merely scheduling this operation. */
export async function warmupShaders(
  supported: boolean, compile: () => Promise<unknown>, timeoutMs = 6000,
): Promise<'ready' | 'unavailable' | 'failed' | 'timed-out'> {
  if (!supported) return 'unavailable';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = Promise.resolve().then(compile).then(() => 'ready' as const, () => 'failed' as const);
    const timeout = new Promise<'timed-out'>(resolve => { timer = setTimeout(() => resolve('timed-out'), timeoutMs); });
    return await Promise.race([work, timeout]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
