// Data provider abstraction. The rest of the app only ever sees normalized
// `Profile` + `Post[]`, so swapping Apify for another source (or self-hosted
// scraping) later is a single-file change.

import { LookupError, type Post, type Profile } from "$lib/types";

export interface DataProvider {
	/** Fetch a profile and its most recent posts. Throws `LookupError` on failure. */
	fetch(
		username: string,
		postLimit: number,
	): Promise<{ profile: Profile; posts: Post[] }>;
}

// ---------------------------------------------------------------------------
// Apify implementation
//
// Actor: apify/instagram-scraper, resultsType "details" — returns one item per
// profile that includes the profile fields plus a `latestPosts` array.
//
// Transport: we hit Apify's REST API directly with the worker-native `fetch`
// rather than the `apify-client` SDK. The SDK is axios-based and does not work
// on Cloudflare Workers (no Node HTTP stack), failing with "Expected response
// object with a 'data' property". The `run-sync-get-dataset-items` endpoint
// runs the actor and returns the dataset items as JSON in a single request.
//
// Field mapping VERIFIED against a live run (natgeo, 2026-06): profile fields
// and `latestPosts` are as below. The view count lives in `videoViewCount`
// (`videoPlayCount` is not populated by this actor version). `type` is
// "Image" | "Video" | "Sidecar". `businessCategoryName` can be the literal
// string "None".
// ---------------------------------------------------------------------------

const ACTOR_ID = "apify/instagram-scraper";

/** Loose shape of a post inside the actor's output. All fields optional/defensive. */
interface RawPost {
	id?: string;
	shortCode?: string;
	type?: string; // "Image" | "Video" | "Sidecar"
	url?: string;
	caption?: string;
	displayUrl?: string;
	likesCount?: number;
	commentsCount?: number;
	videoPlayCount?: number;
	videoViewCount?: number;
	timestamp?: string;
	hashtags?: string[];
}

/** Loose shape of the "details" item. */
interface RawDetails {
	username?: string;
	fullName?: string;
	biography?: string;
	profilePicUrl?: string;
	profilePicUrlHD?: string;
	externalUrl?: string;
	verified?: boolean;
	isBusinessAccount?: boolean;
	businessCategoryName?: string;
	followersCount?: number;
	followsCount?: number;
	postsCount?: number;
	private?: boolean;
	latestPosts?: RawPost[];
	error?: string; // actor sets this when a profile can't be scraped
}

function mapPost(raw: RawPost): Post | null {
	if (!raw.shortCode && !raw.id) return null;
	const kind: Post["kind"] =
		raw.type === "Video"
			? "video"
			: raw.type === "Sidecar"
				? "carousel"
				: "photo";
	const isVideo = kind === "video";
	// `videoViewCount` is the field this actor populates; `videoPlayCount` is a
	// fallback for other actor versions. Keep null when genuinely missing — do
	// NOT coerce to 0, or videos with no view data would drag the stat down.
	const views = raw.videoViewCount ?? raw.videoPlayCount ?? null;

	return {
		id: raw.id ?? raw.shortCode ?? "",
		url:
			raw.url ??
			(raw.shortCode ? `https://www.instagram.com/p/${raw.shortCode}/` : ""),
		kind,
		caption: raw.caption ?? "",
		thumbnailUrl: raw.displayUrl ?? null,
		likes: raw.likesCount ?? 0,
		comments: raw.commentsCount ?? 0,
		views: isVideo ? views : null,
		postedAt: raw.timestamp ?? "",
		hashtags: raw.hashtags ?? [],
	};
}

function mapProfile(raw: RawDetails): Profile {
	return {
		username: raw.username ?? "",
		fullName: raw.fullName ?? "",
		biography: raw.biography ?? "",
		profilePicUrl: raw.profilePicUrlHD ?? raw.profilePicUrl ?? null,
		externalUrl: raw.externalUrl ?? null,
		verified: raw.verified ?? false,
		isBusinessAccount: raw.isBusinessAccount ?? false,
		// The actor returns the string "None" rather than null when there's no category.
		category:
			raw.businessCategoryName && raw.businessCategoryName !== "None"
				? raw.businessCategoryName
				: null,
		followers: raw.followersCount ?? 0,
		following: raw.followsCount ?? 0,
		postsCount: raw.postsCount ?? 0,
	};
}

export class ApifyProvider implements DataProvider {
	#token: string;

	constructor(token: string) {
		this.#token = token;
	}

	async fetch(
		username: string,
		postLimit: number,
	): Promise<{ profile: Profile; posts: Post[] }> {
		let items: RawDetails[];
		try {
			// In a REST URL the actor's "/" becomes "~": apify/x -> apify~x
			const actorPath = ACTOR_ID.replace("/", "~");
			const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(this.#token)}`;
			const res = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					directUrls: [`https://www.instagram.com/${username}/`],
					resultsType: "details",
					resultsLimit: postLimit,
					addParentData: false,
				}),
			});
			if (!res.ok) {
				const detail = (await res.text()).slice(0, 200);
				throw new Error(`Apify API ${res.status}: ${detail}`);
			}
			items = (await res.json()) as RawDetails[];
		} catch (e) {
			throw new LookupError(
				"provider_error",
				`Provider call failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		}

		const details = items[0];
		if (!details || details.error || !details.username) {
			throw new LookupError(
				"not_found",
				`No public account found for "${username}".`,
			);
		}
		if (details.private) {
			throw new LookupError("private", `@${username} is a private account.`);
		}

		const profile = mapProfile(details);
		const posts = (details.latestPosts ?? [])
			.map(mapPost)
			.filter((p): p is Post => p !== null)
			// newest first
			.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
			.slice(0, postLimit);

		if (posts.length === 0) {
			throw new LookupError(
				"no_posts",
				`@${username} has no recent posts to analyze.`,
			);
		}

		return { profile, posts };
	}
}
