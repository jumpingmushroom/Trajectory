// "Date-mode" lets the user log sets for a past calendar date when they
// forgot to record the workout in real time. The state is encoded as
// `?asOfTs=<unix-ms>` on the current URL — there's no separate store.
// That means a hard reload exits date-mode (per the brainstormed design),
// while SvelteKit's SPA navigations preserve it as long as in-app links
// thread the param through `withDateMode()`.
//
// All exported helpers are pure and safe to import from both client and
// server code.

// `goto` is loaded lazily inside the client-only entry/exit helpers so this
// module can be imported safely from server load functions and `mutations.ts`
// without dragging `$app/navigation` into the server bundle.

export const ASOF_PARAM = 'asOfTs';

/**
 * Parse and validate `?asOfTs=` from a search-params object. Returns the
 * timestamp in ms (a `number`) when the param is present, parses as a
 * positive integer, and is ≤ `now` (no future dates). Otherwise null.
 */
export function parseAsOfTs(
	searchParams: URLSearchParams,
	now: number = Date.now()
): number | null {
	const raw = searchParams.get(ASOF_PARAM);
	if (raw == null) return null;
	const n = Number(raw);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
	if (n > now) return null;
	return n;
}

/**
 * Append `?asOfTs=<ts>` to a relative href when date-mode is active. Use
 * for in-app links so the mode survives an SPA navigation.
 */
export function withDateMode(href: string, asOfTs: number | null): string {
	if (asOfTs == null) return href;
	const sep = href.includes('?') ? '&' : '?';
	return `${href}${sep}${ASOF_PARAM}=${asOfTs}`;
}

/**
 * Enter date-mode for the chosen day. Uses replaceState so the entry
 * doesn't pollute the back-button history.
 */
export async function enterDateMode(ts: number): Promise<void> {
	const { goto } = await import('$app/navigation');
	const url = new URL(window.location.href);
	url.searchParams.set(ASOF_PARAM, String(ts));
	await goto(url.pathname + url.search, {
		keepFocus: true,
		noScroll: true,
		replaceState: true
	});
}

/** Exit date-mode by stripping the param from the current URL. */
export async function exitDateMode(): Promise<void> {
	const { goto } = await import('$app/navigation');
	const url = new URL(window.location.href);
	url.searchParams.delete(ASOF_PARAM);
	const target = url.pathname + (url.search || '');
	await goto(target, { keepFocus: true, noScroll: true, replaceState: true });
}

/**
 * UTC-midnight of the day containing `ts`. Used server-side to scope a
 * backdated set to "the same calendar day."
 */
export function startOfUtcDay(ts: number): number {
	const d = new Date(ts);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * The exclusive upper bound for "this calendar day" on the server. Used
 * for the `set.ts < endOfUtcDay(asOfTs)` filter that powers backdated
 * prefill — letting both pre-existing sets *and* freshly-logged backdated
 * sets show up, even when their projected ts drifts a few seconds past
 * the picker's asOfTs value.
 */
export function endOfUtcDay(ts: number): number {
	return startOfUtcDay(ts) + 86_400_000;
}

/**
 * Project the current wall-clock time-of-day onto a chosen calendar date.
 * Used when picking "Yesterday" so that subsequent set logs preserve
 * accurate rest intervals (the *deltas* between sets stay real; only the
 * absolute hour/minute is fictional).
 */
export function projectNowOntoDate(targetDayStartLocal: Date, now: number = Date.now()): number {
	const nowDate = new Date(now);
	const t = new Date(targetDayStartLocal);
	t.setHours(nowDate.getHours(), nowDate.getMinutes(), nowDate.getSeconds(), nowDate.getMilliseconds());
	return t.getTime();
}

/**
 * Compute a `set.ts` for a backdated log. Re-projects the *current*
 * wall-clock time-of-day onto the picked calendar day, so two sets logged
 * 5 minutes apart get `ts` values 5 minutes apart on the past date.
 * Pass the asOfTs from the URL — only its calendar day matters.
 */
export function tsForBackdate(asOfTs: number, now: number = Date.now()): number {
	const picked = new Date(asOfTs);
	const pickedMid = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()).getTime();
	const n = new Date(now);
	const nowMid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
	return now - (nowMid - pickedMid);
}

/**
 * Human label for the date-mode chip. "Today" never appears here — the
 * caller decides what to show when asOfTs is null.
 */
export function dayLabel(asOfTs: number, now: number = Date.now()): string {
	const a = new Date(asOfTs);
	const n = new Date(now);
	const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
	const nMid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
	const days = Math.round((nMid - aMid) / 86_400_000);
	if (days === 0) return 'Today';
	if (days === 1) return 'Yesterday';
	if (days > 1 && days < 7) return `${days} days ago`;
	return a.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
