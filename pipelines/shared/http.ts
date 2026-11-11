import type { HttpResult } from "./types";

export const USER_AGENT = process.env.PIPELINE_USER_AGENT ?? "FASTO-FTS/0.1 (https://fasto-fts.vercel.app)";

/** GET (or POST for Overpass) with the project User-Agent, a timeout and bounded retries on 429/5xx. */
export async function httpGet(
  url: string,
  init: { headers?: Record<string, string>; method?: string; body?: string; timeoutMs?: number; retries?: number } = {},
): Promise<HttpResult> {
  const retries = init.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: init.method ?? "GET",
        body: init.body,
        headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...init.headers },
        signal: AbortSignal.timeout(init.timeoutMs ?? 120_000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 2 ** attempt * 2000;
        await sleep(Math.min(wait, 60_000));
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}: ${new TextDecoder().decode(bytes.slice(0, 300))}`);
      return toResult(url, res.status, res.headers.get("content-type") ?? "application/octet-stream", bytes);
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(2 ** attempt * 2000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function toResult(url: string, status: number, contentType: string, bytes: Uint8Array): HttpResult {
  return {
    url,
    status,
    contentType,
    bytes,
    text: () => new TextDecoder().decode(bytes),
    json: <T,>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
