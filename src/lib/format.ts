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

/**
 * A percentage with enough precision to stay meaningful for huge accounts,
 * whose engagement rate can be a tiny fraction of a percent. e.g. 0.017 -> "0.017%".
 */
export function pct(n: number): string {
	if (n === 0) return "0%";
	if (n < 0.1) return `${n.toFixed(3)}%`;
	if (n < 1) return `${n.toFixed(2)}%`;
	return `${n.toFixed(1)}%`;
}

/** A relative-ish "as of" string from an ISO timestamp. */
export function asOf(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}
