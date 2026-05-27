import { log } from "./logger";

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const delayMs = opts.delayMs ?? 2000;
  const label = opts.label ?? "operation";

  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i < retries) {
        log.warn(`${label} 실패 (${i + 1}/${retries + 1}): ${msg} → ${delayMs}ms 후 재시도`);
        await sleep(delayMs);
      } else {
        log.error(`${label} 최종 실패: ${msg}`);
      }
    }
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
