/**
 * List prices in USD per token (cached 2026-11-03). Logged spend is an estimate used by the budget
 * gates; an unknown model is an error, never a free model (a zero cost would bypass the gates).
 * Cache writes (5-minute) cost 1.25x the input price.
 */
type Price = { input: number; output: number; cacheRead: number };
const PRICE: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1 / 1e6, output: 0.5 / 1e6, cacheRead: 0.01 / 1e6 },
  "claude-sonnet-5-5": { input: 2 / 1e6, output: 10 / 1e6, cacheRead: 0.1 / 1e6 },
};

export function priceFor(model: string): Price {
  const p = PRICE[model];
  if (!p) throw new Error(`no price for model ${model}: add it to PRICE in lib/ai/pricing.ts before using it`);
  return p;
}

export type ApiUsage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

export function costOf(model: string, u: ApiUsage): { inputTokens: number; outputTokens: number; costUsd: number } {
  const p = priceFor(model);
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  return {
    inputTokens: u.input_tokens + write + read,
    outputTokens: u.output_tokens,
    costUsd: u.input_tokens * p.input + 1.25 * write * p.input + read * p.cacheRead + u.output_tokens * p.output,
  };
}
