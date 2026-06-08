<script lang="ts">
import { asOf, compact, full, pct } from "$lib/format";
import { getInfluencerStats } from "./influencer.remote";

let username = $state("");
// The active query resource. Reassigned on each search; SvelteKit dedupes
// identical lookups and exposes reactive `.loading` / `.error` / `.current`.
let q = $state<ReturnType<typeof getInfluencerStats> | undefined>(undefined);

function search(event: SubmitEvent) {
	event.preventDefault();
	const u = username.trim().replace(/^@+/, "");
	if (u) q = getInfluencerStats(u);
}

// Pull a friendly { title, hint } out of whatever error shape the server sent.
const ERROR_COPY: Record<string, { title: string; hint: string }> = {
	not_found: {
		title: "We couldn't find that account",
		hint: "Double-check the spelling. It needs to be a public Instagram username.",
	},
	private: {
		title: "That account is private",
		hint: "We can only analyze public accounts — private profiles hide their posts.",
	},
	no_posts: {
		title: "Nothing to measure yet",
		hint: "This account doesn't have recent posts we can pull stats from.",
	},
	rate_limited: {
		title: "Too many lookups right now",
		hint: "Give it a minute and try again.",
	},
	provider_error: {
		title: "Something went wrong fetching the data",
		hint: "This is on us — please try again in a moment.",
	},
};

const FALLBACK_ERROR = {
	title: "Something went wrong fetching the data",
	hint: "This is on us — please try again in a moment.",
};

function readError(err: unknown): { title: string; hint: string } {
	const obj = (err ?? {}) as Record<string, unknown>;
	const body = (obj["body"] ?? {}) as Record<string, unknown>;
	const code =
		typeof obj["code"] === "string"
			? obj["code"]
			: typeof body["code"] === "string"
				? (body["code"] as string)
				: "provider_error";
	return ERROR_COPY[code] ?? FALLBACK_ERROR;
}

const engagementColor: Record<string, string> = {
	good: "text-emerald-600",
	ok: "text-slate-700",
	weak: "text-amber-600",
};
</script>

{#snippet info(text: string)}
	<span class="group relative ml-1 inline-flex align-middle">
		<button
			type="button"
			aria-label="What does this mean?"
			class="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-300"
		>
			i
		</button>
		<span
			class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
			>{text}</span
		>
	</span>
{/snippet}

{#snippet stat(label: string, value: string, hint?: string, tip?: string)}
	<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
		<div class="text-2xl font-bold text-slate-900">{value}</div>
		<div class="mt-1 flex items-center text-sm font-medium text-slate-600">
			{label}
			{#if tip}
				{@render info(tip)}
			{/if}
		</div>
		{#if hint}
			<div class="mt-0.5 text-xs text-slate-400">{hint}</div>
		{/if}
	</div>
{/snippet}

<main class="mx-auto min-h-screen max-w-5xl px-4 py-10">
	<header class="text-center">
		<h1
			class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl"
		>
			Safa7 el Influencers
		</h1>
		<p class="mx-auto mt-3 max-w-xl text-base text-slate-600">
			Type any Instagram username and see the real numbers — average views,
			likes, and how engaged their audience actually is. Free, no sign-up.
		</p>
	</header>

	<form onsubmit={search} class="mx-auto mt-8 flex max-w-xl gap-2">
		<div class="relative flex-1">
			<span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
				>@</span
			>
			<input
				bind:value={username}
				type="text"
				autocapitalize="none"
				autocomplete="off"
				spellcheck="false"
				placeholder="instagram_username"
				class="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
			>
		</div>
		<button
			type="submit"
			class="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
		>
			Check
		</button>
	</form>

	{#if q?.loading}
		<div class="mt-16 flex flex-col items-center gap-3 text-slate-500">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500"
			></div>
			<p>Pulling the latest posts… this can take a few seconds.</p>
		</div>
	{:else if q?.error}
		{@const e = readError(q.error)}
		<div
			class="mx-auto mt-12 max-w-md rounded-2xl bg-rose-50 p-6 text-center ring-1 ring-rose-100"
		>
			<p class="font-semibold text-rose-800">{e.title}</p>
			<p class="mt-1 text-sm text-rose-600">{e.hint}</p>
		</div>
	{:else if q?.current}
		{@const s = q.current}
		<section class="mt-10 space-y-8">
			<!-- Profile header -->
			<div
				class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6"
			>
				{#if s.profile.profilePicUrl}
					<img
						src={s.profile.profilePicUrl}
						alt={s.profile.username}
						referrerpolicy="no-referrer"
						class="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100"
					>
				{/if}
				<div class="text-center sm:text-left">
					<div class="flex items-center justify-center gap-2 sm:justify-start">
						<h2 class="text-xl font-bold text-slate-900">
							{s.profile.fullName || s.profile.username}
						</h2>
						{#if s.profile.verified}
							<span class="text-indigo-500" title="Verified">✔</span>
						{/if}
					</div>
					<p class="text-slate-500">@{s.profile.username}</p>
					<p
						class="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700"
					>
						{s.verdict.tierLabel}
						{@render info(
							"Based on follower count: nano (under 10K), micro (under 100K), mid (under 500K), macro (under 1M), mega (under 10M), celebrity (10M+). Smaller accounts usually have higher engagement %.",
						)}
					</p>
				</div>
				<div class="flex gap-6 sm:ml-auto">
					<div class="text-center">
						<div class="text-lg font-bold text-slate-900">
							{compact(s.profile.followers)}
						</div>
						<div class="text-xs text-slate-500">followers</div>
					</div>
					<div class="text-center">
						<div class="text-lg font-bold text-slate-900">
							{compact(s.profile.postsCount)}
						</div>
						<div class="text-xs text-slate-500">posts</div>
					</div>
				</div>
			</div>

			<!-- Plain-English verdict -->
			<div
				class="rounded-2xl bg-gradient-to-br from-indigo-50 to-white p-6 ring-1 ring-indigo-100"
			>
				<p class="text-slate-700">{s.verdict.summary}</p>
				{#if s.verdict.strengths.length || s.verdict.cautions.length}
					<div class="mt-4 grid gap-4 sm:grid-cols-2">
						{#if s.verdict.strengths.length}
							<ul class="space-y-1 text-sm text-slate-600">
								{#each s.verdict.strengths as str (str)}
									<li>✅ {str}</li>
								{/each}
							</ul>
						{/if}
						{#if s.verdict.cautions.length}
							<ul class="space-y-1 text-sm text-slate-600">
								{#each s.verdict.cautions as caution (caution)}
									<li>⚠️ {caution}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Headline numbers -->
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{@render stat(
					"Typical views / video",
					s.metrics.medianViews != null ? compact(s.metrics.medianViews) : "—",
					s.metrics.videoSampleSize > 0
						? `${s.metrics.avgViews != null ? `avg ${compact(s.metrics.avgViews)} · ` : ""}across ${s.metrics.videoSampleSize} videos`
						: "no recent videos",
					"The middle (median) view count across recent videos — half got more, half fewer. We use the median so one viral video doesn't skew it. 'avg' is the plain average, shown for comparison.",
				)}
				{@render stat(
					"Typical likes / post",
					compact(s.metrics.medianLikes),
					undefined,
					"The median (middle) number of likes across the recent posts we sampled — half got more, half fewer.",
				)}
				{@render stat(
					"Typical comments / post",
					compact(s.metrics.medianComments),
					undefined,
					"The median (middle) number of comments across the recent posts we sampled.",
				)}
				<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
					<div
						class="text-2xl font-bold {engagementColor[s.verdict.engagementTone] ?? 'text-slate-900'}"
					>
						{pct(s.metrics.engagementRate)}
					</div>
					<div
						class="mt-1 flex items-center text-sm font-medium text-slate-600"
					>
						Engagement rate{@render info(
							"Likes + comments per post, as a share of followers. Big accounts naturally have a much lower %, so we rate it against what's typical for an account of this size — not a fixed bar.",
						)}
					</div>
					<div class="mt-0.5 text-xs text-slate-400">
						{s.verdict.engagementLabel}
					</div>
				</div>
				{@render stat(
					"Posts / week",
					s.metrics.postsPerWeek > 0 ? s.metrics.postsPerWeek.toFixed(1) : "—",
					undefined,
					"How often they post, estimated from the dates of the recent posts we looked at.",
				)}
			</div>

			<!-- Recent posts -->
			<div>
				<h3
					class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
				>
					Recent posts we measured
				</h3>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each s.posts as post (post.id)}
						<a
							href={post.url}
							target="_blank"
							rel="noopener noreferrer"
							class="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-100"
						>
							{#if post.thumbnailUrl}
								<img
									src={post.thumbnailUrl}
									alt=""
									referrerpolicy="no-referrer"
									loading="lazy"
									class="h-full w-full object-cover transition group-hover:scale-105"
								>
							{/if}
							<div
								class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white"
							>
								{#if post.views != null}
									▶ {compact(post.views)} views
								{:else}
									♥ {compact(post.likes)}
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>

			<!-- Hashtags -->
			{#if s.metrics.topHashtags.length}
				<div>
					<h3
						class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
					>
						Most-used hashtags
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each s.metrics.topHashtags as h (h.tag)}
							<span
								class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
							>
								#{h.tag} <span class="text-slate-400">×{h.count}</span>
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<p class="pt-2 text-center text-xs text-slate-400">
				Based on the last {s.metrics.sampleSize} posts · average likes
				{full(s.metrics.avgLikes)}
				· as of {asOf(s.fetchedAt)}
				{s.cached ? " · cached" : ""}
			</p>

			<details class="mx-auto max-w-xl text-xs text-slate-500">
				<summary
					class="cursor-pointer text-center text-slate-400 hover:text-slate-600"
				>
					How are these numbers calculated?
				</summary>
				<div class="mt-3 space-y-2 rounded-xl bg-slate-50 p-4">
					<p>
						We pull this account's last {s.metrics.sampleSize} public posts from
						Instagram and crunch the numbers — no guesswork.
					</p>
					<p>
						<strong>"Typical" values are medians</strong>
						(the middle value), not averages, so a single viral post doesn't
						distort them. Where it helps, we also show the average.
					</p>
					<p>
						<strong>Engagement rate</strong>
						= (average likes + average comments) ÷ followers. Because engagement
						% drops sharply as accounts grow, we rate it
						<strong>relative to other accounts of a similar size</strong>
						rather than against one fixed target.
					</p>
					<p>
						<strong>View counts</strong>
						only exist on videos and reels, so photo-only accounts won't show a
						"typical views" number.
					</p>
				</div>
			</details>
		</section>
	{/if}
</main>
