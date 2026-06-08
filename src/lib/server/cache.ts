// KV-backed cache for lookup results. Caching is the core cost-control strategy:
// popular influencers get looked up repeatedly, but we only pay the provider
// once per TTL window. If KV isn't wired up (e.g. plain `vite dev` without SST
// linking), every helper degrades gracefully to a no-op so the app still works.

import type { InfluencerStats } from "$lib/types";

/** How long a cached result stays fresh. 12h balances cost vs. staleness. */
const TTL_SECONDS = 12 * 60 * 60;

/** Minimal slice of the Cloudflare KV API we use. */
interface KVLike {
	get(key: string, type: "json"): Promise<unknown>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
}

function isKVLike(value: unknown): value is KVLike {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as KVLike).get === "function" &&
		typeof (value as KVLike).put === "function"
	);
}

// Resolve the KV binding via SST's linked-resource accessor. Wrapped in a
// dynamic import + try/catch because `Resource.Kv` throws when SST hasn't
// injected the binding (local dev without `sst dev`).
async function getKV(): Promise<KVLike | null> {
	try {
		const { Resource } = await import("sst");
		const binding = (Resource as unknown as Record<string, unknown>)["Kv"];
		return isKVLike(binding) ? binding : null;
	} catch {
		return null;
	}
}

const keyFor = (username: string) => `stats:v1:${username}`;

export async function cacheGet(
	username: string,
): Promise<InfluencerStats | null> {
	const kv = await getKV();
	if (!kv) return null;
	try {
		const hit = await kv.get(keyFor(username), "json");
		return (hit as InfluencerStats | null) ?? null;
	} catch {
		return null;
	}
}

export async function cachePut(
	username: string,
	stats: InfluencerStats,
): Promise<void> {
	const kv = await getKV();
	if (!kv) return;
	try {
		await kv.put(keyFor(username), JSON.stringify(stats), {
			expirationTtl: TTL_SECONDS,
		});
	} catch {
		// Cache writes are best-effort; never fail a lookup over a cache miss.
	}
}
