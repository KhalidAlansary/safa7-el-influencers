// Shared types between the worker (server) and the browser (client).
// These are the normalized shapes our UI renders — deliberately decoupled from
// whatever the data provider (Apify, etc.) returns, so providers stay swappable.

/** A single post/reel after normalization. */
export interface Post {
	id: string;
	/** Permalink on instagram.com */
	url: string;
	kind: "photo" | "video" | "carousel";
	caption: string;
	thumbnailUrl: string | null;
	likes: number;
	comments: number;
	/** Play/view count — only present for videos/reels. */
	views: number | null;
	/** ISO timestamp of when it was posted. */
	postedAt: string;
	hashtags: string[];
}

/** Follower-count tier, used for friendly labelling and benchmark comparisons. */
export type Tier = "nano" | "micro" | "mid" | "macro" | "mega";

/** Everything we know about the account itself. */
export interface Profile {
	username: string;
	fullName: string;
	biography: string;
	profilePicUrl: string | null;
	externalUrl: string | null;
	verified: boolean;
	isBusinessAccount: boolean;
	category: string | null;
	followers: number;
	following: number;
	postsCount: number;
}

/** Computed metrics over the recent posts we sampled. */
export interface Metrics {
	/** How many recent posts the metrics are based on. */
	sampleSize: number;
	/** How many of the sampled posts were videos/reels (i.e. have view data). */
	videoSampleSize: number;

	avgLikes: number;
	medianLikes: number;
	avgComments: number;
	medianComments: number;

	/** Null when the sample contains no videos. */
	avgViews: number | null;
	medianViews: number | null;

	/** (avg likes + avg comments) / followers * 100. The headline "how engaged" number. */
	engagementRate: number;
	/** (likes + comments) / views, averaged over videos. Null when no videos. */
	engagementPerView: number | null;

	/** Posts per week, derived from the timestamps in the sample. */
	postsPerWeek: number;

	/** Share of the sample that is video/reel content, 0..1. */
	videoShare: number;

	/** The single best post in the sample, by total engagement. */
	topPost: Post | null;
	/** Most frequently used hashtags in the sample, most-common first. */
	topHashtags: Array<{ tag: string; count: number }>;
}

/** Plain-English, jargon-free read-out for a non-technical business owner. */
export interface Verdict {
	tier: Tier;
	tierLabel: string;
	/** e.g. "Strong", "Solid", "Average", "Low" — a word for the engagement rate. */
	engagementLabel: string;
	/** One or two sentences summarizing the account as a marketing partner. */
	summary: string;
	/** Short bullet-style positives. */
	strengths: string[];
	/** Short bullet-style things to watch out for. */
	cautions: string[];
}

/** The full payload returned to the browser for a single lookup. */
export interface InfluencerStats {
	profile: Profile;
	metrics: Metrics;
	verdict: Verdict;
	/** The posts the metrics were computed from (newest first). */
	posts: Post[];
	/** When this data was fetched (ISO). Lets the UI show "as of …". */
	fetchedAt: string;
	/** True when served from cache rather than a fresh provider call. */
	cached: boolean;
}

/** Errors we surface to the user, mapped to friendly messages in the UI. */
export type LookupErrorCode =
	| "not_found"
	| "private"
	| "no_posts"
	| "provider_error"
	| "rate_limited";

export class LookupError extends Error {
	code: LookupErrorCode;
	constructor(code: LookupErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = "LookupError";
	}
}
