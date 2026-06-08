// Pure metric + verdict computation. No I/O — given a profile and its recent
// posts, produce the numbers and the plain-English read-out the UI shows.

import type { Metrics, Post, Profile, Tier, Verdict } from "$lib/types";

const mean = (xs: number[]): number =>
	xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: number[]): number => {
	if (xs.length === 0) return 0;
	const sorted = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	// noUncheckedIndexedAccess: guard the indexed reads.
	if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
	return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

/** Posts/week from the spread of timestamps in the sample. */
function postsPerWeek(posts: Post[]): number {
	if (posts.length < 2) return 0;
	const times = posts
		.map((p) => Date.parse(p.postedAt))
		.filter((t) => !Number.isNaN(t))
		.sort((a, b) => a - b);
	const first = times[0];
	const last = times[times.length - 1];
	if (first === undefined || last === undefined || last === first) return 0;
	const weeks = (last - first) / (1000 * 60 * 60 * 24 * 7);
	return weeks > 0 ? posts.length / weeks : 0;
}

function topHashtags(
	posts: Post[],
	limit = 6,
): Array<{ tag: string; count: number }> {
	const counts = new Map<string, number>();
	for (const post of posts) {
		for (const raw of post.hashtags) {
			const tag = raw.toLowerCase();
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

export function tierOf(followers: number): Tier {
	if (followers < 10_000) return "nano";
	if (followers < 100_000) return "micro";
	if (followers < 500_000) return "mid";
	if (followers < 1_000_000) return "macro";
	return "mega";
}

const TIER_LABELS: Record<Tier, string> = {
	nano: "Nano-influencer",
	micro: "Micro-influencer",
	mid: "Mid-tier influencer",
	macro: "Macro-influencer",
	mega: "Mega-influencer / celebrity",
};

// Engagement-rate benchmarks shift by audience size: smaller accounts naturally
// engage harder. These thresholds are the "good for your size" lines (in %).
function engagementVerdict(rate: number, tier: Tier): string {
	const strongAt: Record<Tier, number> = {
		nano: 5,
		micro: 3.5,
		mid: 2.5,
		macro: 1.8,
		mega: 1.2,
	};
	const okAt: Record<Tier, number> = {
		nano: 2.5,
		micro: 1.8,
		mid: 1.2,
		macro: 0.9,
		mega: 0.6,
	};
	if (rate >= strongAt[tier]) return "Strong";
	if (rate >= okAt[tier]) return "Solid";
	if (rate >= okAt[tier] / 2) return "Average";
	return "Low";
}

function buildVerdict(profile: Profile, m: Metrics): Verdict {
	const tier = tierOf(profile.followers);
	const engagementLabel = engagementVerdict(m.engagementRate, tier);

	const strengths: string[] = [];
	const cautions: string[] = [];

	if (engagementLabel === "Strong" || engagementLabel === "Solid") {
		strengths.push(
			`Their audience interacts a lot — about ${m.engagementRate.toFixed(1)} out of every 100 followers engage with each post.`,
		);
	} else {
		cautions.push(
			`Engagement is on the ${engagementLabel.toLowerCase()} side for this size — roughly ${m.engagementRate.toFixed(1)} in 100 followers interact per post.`,
		);
	}

	if (m.postsPerWeek >= 3) {
		strengths.push(
			`Posts often — around ${Math.round(m.postsPerWeek)} times a week.`,
		);
	} else if (m.postsPerWeek > 0 && m.postsPerWeek < 1) {
		cautions.push("Posts infrequently — less than once a week.");
	}

	if (m.videoShare >= 0.5 && m.avgViews) {
		strengths.push(
			`Leans into video/reels (about ${Math.round(m.videoShare * 100)}% of recent posts), averaging ${Math.round(m.avgViews).toLocaleString()} views.`,
		);
	}

	if (profile.verified) strengths.push("Verified account.");
	if (m.videoSampleSize === 0) {
		cautions.push(
			"No recent videos found, so we couldn't measure view counts.",
		);
	}

	const summary =
		`${profile.fullName || profile.username} is a ${TIER_LABELS[tier].toLowerCase()} ` +
		`with ${profile.followers.toLocaleString()} followers. ` +
		`Engagement looks ${engagementLabel.toLowerCase()} for an account this size` +
		(m.avgViews
			? `, and recent videos pull around ${Math.round(m.avgViews).toLocaleString()} views each.`
			: ".");

	return {
		tier,
		tierLabel: TIER_LABELS[tier],
		engagementLabel,
		summary,
		strengths,
		cautions,
	};
}

export function computeMetrics(profile: Profile, posts: Post[]): Metrics {
	const likes = posts.map((p) => p.likes);
	const comments = posts.map((p) => p.comments);
	const videos = posts.filter((p) => p.views != null);
	const views = videos.map((p) => p.views as number);

	const avgLikes = mean(likes);
	const avgComments = mean(comments);

	const engagementRate =
		profile.followers > 0
			? ((avgLikes + avgComments) / profile.followers) * 100
			: 0;

	const engagementPerView =
		views.length > 0
			? mean(
					videos.map((p) =>
						(p.views as number) > 0
							? (p.likes + p.comments) / (p.views as number)
							: 0,
					),
				)
			: null;

	const topPost =
		posts.length > 0
			? ([...posts].sort(
					(a, b) => b.likes + b.comments - (a.likes + a.comments),
				)[0] ?? null)
			: null;

	const metrics: Metrics = {
		sampleSize: posts.length,
		videoSampleSize: videos.length,
		avgLikes,
		medianLikes: median(likes),
		avgComments,
		medianComments: median(comments),
		avgViews: views.length > 0 ? mean(views) : null,
		medianViews: views.length > 0 ? median(views) : null,
		engagementRate,
		engagementPerView,
		postsPerWeek: postsPerWeek(posts),
		videoShare: posts.length > 0 ? videos.length / posts.length : 0,
		topPost,
		topHashtags: topHashtags(posts),
	};

	return metrics;
}

export function buildStats(profile: Profile, posts: Post[]) {
	const metrics = computeMetrics(profile, posts);
	const verdict = buildVerdict(profile, metrics);
	return { metrics, verdict };
}
