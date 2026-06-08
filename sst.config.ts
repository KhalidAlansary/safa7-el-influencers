/// <reference path="./.sst/platform/config.d.ts" />

const name = "safa7-el-influencers";

export default $config({
	app(input) {
		return {
			name,
			removal: input?.stage === "production" ? "retain" : "remove",
			protect: ["production"].includes(input?.stage),
			home: "cloudflare",
		};
	},
	async run() {
		const kv = new sst.cloudflare.Kv("Kv");
		new sst.cloudflare.Worker("Site", {
			assets: { directory: ".svelte-kit/cloudflare" },
			handler: ".svelte-kit/cloudflare/_worker.js",
			link: [kv],
			// Exposed on the worker as `platform.env.APIFY_TOKEN`. Sourced from the
			// local environment / .env (SST loads .env into process.env).
			environment: {
				APIFY_TOKEN: process.env.APIFY_TOKEN ?? "",
			},
			compatibility: { date: "2026-06-08" },
			url: true,
			transform: {
				worker(args) {
					if (args.scriptName.toString().startsWith(`${name}-production`)) {
						args.scriptName = name;
					}
					args.observability = { enabled: true };
				},
			},
		});
	},
});
