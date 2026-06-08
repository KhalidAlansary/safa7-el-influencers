// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			/** Stable, machine-readable cause so the UI can show a tailored message. */
			code?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// `Platform` (with `env`) is declared ambiently by @sveltejs/adapter-cloudflare.
	}
}

export {};
