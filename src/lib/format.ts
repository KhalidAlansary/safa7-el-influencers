// Display formatters shared by the UI.

/** 1234 -> "1.2K", 1_200_000 -> "1.2M". Keeps big follower counts readable. */
export function compact(n: number): string {
	return new Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(n);
}

/** Full grouped number, e.g. "1,234,567". */
export function full(n: number): string {
	return new Intl.NumberFormat("en").format(Math.round(n));
}

/** A relative-ish "as of" string from an ISO timestamp. */
export function asOf(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}
