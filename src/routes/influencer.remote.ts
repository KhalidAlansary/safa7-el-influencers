// Remote functions: the typed bridge between the browser and the worker.
// The client imports `getInfluencerStats` and calls it like a local async
// function; SvelteKit runs the body on the server (Cloudflare worker).

import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { getRequestEvent, query } from "$app/server";
import { cacheGet, cachePut } from "$lib/server/cache";
import { buildStats } from "$lib/server/metrics";
import { ApifyProvider } from "$lib/server/provider";
import {
	type InfluencerStats,
	LookupError,
	type LookupErrorCode,
} from "$lib/types";

/** How many recent posts to sample for the metrics. */
const POST_LIMIT = 12;

// Normalize and validate the username: strip a leading "@", lowercase, and
// enforce Instagram's allowed character set (letters, numbers, dot, underscore).
const usernameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.transform((s) => s.replace(/^@+/, "").toLowerCase()),
	v.regex(
		/^[a-z0-9._]{1,30}$/,
		"That doesn't look like an Instagram username — use letters, numbers, dots or underscores.",
	),
);

const HTTP_STATUS: Record<LookupErrorCode, number> = {
	not_found: 404,
	private: 403,
	no_posts: 422,
	rate_limited: 429,
	provider_error: 502,
};

export const getInfluencerStats = query(
	usernameSchema,
	async (username): Promise<InfluencerStats> => {
		const cached = await cacheGet(username);
		if (cached) return { ...cached, cached: true };

		// Read the Apify token from the Cloudflare worker's env bindings. (We avoid
		// SvelteKit's declared-env system here: declaring vars in this pre-release
		// makes the runtime import build-only code that crashes workerd on boot.)
		const { platform } = getRequestEvent();
		const env = platform?.env as { APIFY_TOKEN?: string } | undefined;
		const token = env?.APIFY_TOKEN;
		if (!token) {
			error(500, {
				code: "provider_error",
				message: "Server is missing its data-provider token.",
			});
		}

		try {
			const provider = new ApifyProvider(token);
			const { profile, posts } = await provider.fetch(username, POST_LIMIT);
			const { metrics, verdict } = buildStats(profile, posts);

			const stats: InfluencerStats = {
				profile,
				metrics,
				verdict,
				posts,
				fetchedAt: new Date().toISOString(),
				cached: false,
			};

			await cachePut(username, stats);
			return stats;
		} catch (e) {
			if (e instanceof LookupError) {
				error(HTTP_STATUS[e.code], { code: e.code, message: e.message });
			}
			throw e;
		}
	},
);
