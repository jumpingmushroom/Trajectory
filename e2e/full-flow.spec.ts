// Trajectory full-flow e2e test (M12).
//
// Drives the actual UI: signs in as the seeded admin via the /login form,
// walks the first-run wizard (or skips it if the admin already has gyms),
// adds a strength piece of equipment, logs three sets at different
// weights — across three sessions so the per-session top-set chart has
// at least two points and the Detail sparkline renders — and finally
// exports the CSV and parses it for the three set rows.
//
// Under v0.2 multiuser, public sign-up is disabled, so the test reuses
// the seeded admin account (ADMIN_EMAIL / ADMIN_PASSWORD, override via
// E2E_EMAIL / E2E_PASSWORD). State accumulates across runs; each piece
// of equipment is timestamp-suffixed to keep selectors unique.
//
// Run: `pnpm test:e2e` (assumes `docker compose up` separately, like
// tests/smoke.mjs does). Override base URL via TRAJECTORY_URL.

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const STAMP = Date.now();
const EMAIL =
	process.env.E2E_EMAIL ?? process.env.ADMIN_EMAIL ?? 'admin@trajectory.local';
const PASSWORD =
	process.env.E2E_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 'change-me-on-first-login';

// Equipment we'll create in Setup. Strength so the chart series uses
// weight (per equipment/[id]/+page.server.ts).
const EQUIPMENT_NAME = `E2E Cable Row ${STAMP}`;
const GYM_NAME = `E2E Gym ${STAMP}`;

const WEIGHTS: number[] = [60, 65, 70];

async function logIn(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

async function ensureGymExists(page: Page): Promise<void> {
	// Fresh admin → /+page.server.ts redirects to /setup/first-run.
	// Returning admin → already lands on Home; first-run is then unreachable
	// (the wizard's load redirects away when the user already has a gym).
	// Wait for either outcome and create a gym only when first-run shows.
	await page.waitForURL(/(\/|\/setup\/first-run\b)/);
	if (/\/setup\/first-run\b/.test(page.url())) {
		await page.getByLabel('Gym name').fill(GYM_NAME);
		await page.getByRole('button', { name: 'Create gym' }).click();
		await page.waitForURL(/^[^?]*\/(?:\?.*)?$/);
	}
}

async function addStrengthEquipment(page: Page): Promise<void> {
	await page.goto('/setup');
	// On a returning admin the gym name may differ; the Add button
	// always reads "Add equipment to <gym name>", so anchor on the prefix.
	await page.getByRole('button', { name: /^Add equipment to / }).first().click();

	// Step 1: pick a glyph. We choose 'Chest Press' because its default
	// type is 'machine' (see src/lib/components/glyph-kinds.ts) — and
	// equipment.create only auto-creates a hidden exercise for
	// machine/cable/cardio types (mutations.ts equipmentCreate). Without
	// that hidden exercise, set.create has no exerciseId to FK against.
	// Clicking a glyph auto-advances to step 2 in add mode (pickGlyph).
	await page.getByRole('button', { name: 'Chest Press', exact: true }).first().click();

	// Step 2: name + type. Default type is 'machine' — fine for strength.
	await page.getByLabel('Name', { exact: true }).fill(EQUIPMENT_NAME);
	await page.getByRole('button', { name: 'Continue' }).click();

	// Step 3: muscle group. Default 'push' is fine — not load-bearing
	// for the test. Submit.
	await page.getByRole('button', { name: 'Add to gym' }).click();

	// Sheet closes; Setup page re-renders with the new equipment row.
	await expect(page.getByText(EQUIPMENT_NAME).first()).toBeVisible();
}

async function logSetForEquipment(page: Page, weightKg: number): Promise<void> {
	// Drive Home → equipment tile → Log → tap Log button.
	await page.goto('/');
	await page
		.getByRole('link', { name: new RegExp(escapeRegExp(EQUIPMENT_NAME), 'i') })
		.first()
		.click();
	await page.waitForURL(/\/log\/[^/]+$/);

	// Stepper has no text input — it's +/- buttons (aria-labels Increase /
	// Decrease) over a non-editable display (see src/lib/components/Stepper.svelte).
	// Parse the current weight out of the big "Log set N of M · X kg × Y"
	// button label, then tap Increase/Decrease (step = 2.5 kg) enough
	// times to land on the target. We resolve the diff from the live UI
	// state instead of hardcoding so the helper survives changes to the
	// default starting weight or the lastWeight pre-fill behaviour.
	const STEP = 2.5;
	const logButton = page.getByRole('button', { name: /^(?:Log set|Extra set)\b/ });
	const initialLabel = (await logButton.textContent())?.trim() ?? '';
	const m = initialLabel.match(/(\d+(?:\.\d+)?)\s*kg/);
	if (!m) throw new Error(`could not parse current weight from "${initialLabel}"`);
	const current = Number(m[1]);
	const diff = Math.round((weightKg - current) / STEP);
	const adjuster =
		diff >= 0
			? page.getByRole('button', { name: 'Increase' }).first()
			: page.getByRole('button', { name: 'Decrease' }).first();
	for (let i = 0; i < Math.abs(diff); i++) {
		await adjuster.click();
	}

	// Confirm the label now reflects the target weight before clicking
	// Log — guards against off-by-one drift if the page hadn't fully
	// settled the lastWeight effect.
	await expect(logButton).toHaveText(new RegExp(`${weightKg}\\s*kg`));
	await logButton.click();
	// "Logged" flashes for ~700ms; wait for the button label to flip back
	// to a normal log label so the queued mutation has had a chance to
	// drain before we navigate.
	await expect(page.getByRole('button', { name: /^(?:Log set|Extra set)\b/ })).toBeVisible({
		timeout: 5000
	});
}

async function endActiveSessionViaHistory(page: Page): Promise<void> {
	// Sessions only become end-able from /sessions/[id]. The most stable
	// path from any state is via /history which lists every session.
	await page.goto('/history');
	// First (most-recent) session row links to /sessions/{id}.
	const firstSession = page.locator('a[href^="/sessions/"]').first();
	await firstSession.click();
	await page.waitForURL(/\/sessions\/[^/]+$/);
	await page.getByRole('button', { name: 'End session' }).click();
	// After ending, the End button is replaced by Undo/Resume — wait
	// for the page to settle so subsequent navigation doesn't race the
	// mutation drain.
	await expect(page.getByRole('button', { name: 'End session' })).toHaveCount(0);
}

async function exportAndParseCsv(
	request: APIRequestContext,
	baseURL: string,
	cookieHeader: string
): Promise<string[][]> {
	// Drive the export endpoint directly with the logged-in session
	// cookie. The CSV link in the UI ultimately hits the same endpoint;
	// fetching it here keeps the parse step explicit and side-effect-free.
	const res = await request.get(`${baseURL}/api/export.csv`, {
		headers: { cookie: cookieHeader }
	});
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('text/csv');
	const csv = await res.text();
	// Server emits CRLF line endings (see export.csv/+server.ts).
	const lines = csv.replace(/\r\n/g, '\n').trim().split('\n');
	expect(lines.length).toBeGreaterThanOrEqual(4); // header + 3 sets
	// Naive split — the export uses simple comma separation and our
	// test inputs contain no commas, quotes, or formula-prefix chars
	// (see csvEscape in export.csv/+server.ts).
	return lines.map((l) => l.split(','));
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('full flow: login → gym → equipment → 3 sets → sparkline → CSV', async ({
	page,
	request,
	baseURL
}) => {
	if (!baseURL) throw new Error('baseURL is not configured');
	test.setTimeout(120_000);

	// 1. Log in as the seeded admin via the actual /login form.
	await logIn(page);

	// 2. Create a gym via the first-run wizard, or skip if one already exists.
	await ensureGymExists(page);

	// 4. Add a strength equipment via Setup.
	await addStrengthEquipment(page);

	// 5. Log three sets at different weights, ending the session
	// between each so the per-session top-set chart accumulates
	// ≥ 2 points and the Detail sparkline renders (it requires
	// data.series.length >= 2 — see equipment/[id]/+page.server.ts).
	// Logging on /log/[id] implicitly opens a session if none is
	// active, so we don't need to click "Start session" between sets.
	for (let i = 0; i < WEIGHTS.length; i++) {
		await logSetForEquipment(page, WEIGHTS[i]);
		// Don't end the final session — leaves a realistic open session
		// in the dev DB and saves one round-trip. Two ended + one open
		// still gives 3 distinct sessionIds in the chart series.
		if (i < WEIGHTS.length - 1) {
			await endActiveSessionViaHistory(page);
		}
	}

	// 6. Verify the sparkline appears on Detail. The Sparkline lives in
	// the hero section of /equipment/[id] and only renders when
	// data.series.length >= 2 (per +page.server.ts) — i.e. ≥ 2 sessions
	// with at least one weighted set. Three sessions × one set each
	// satisfies that.
	await page.goto('/');
	await page
		.getByRole('link', { name: new RegExp(escapeRegExp(EQUIPMENT_NAME), 'i') })
		.first()
		.click();
	await page.waitForURL(/\/log\/[^/]+$/);
	// Top-right icon link goes to the equipment detail.
	await page.getByRole('link', { name: 'Equipment detail' }).click();
	await page.waitForURL(/\/equipment\/[^/]+$/);

	// Assert the Sparkline SVG path is present in the hero — a stable,
	// minimal selector. The Sparkline component renders an <svg> with
	// a <path> stroke. We pair it with the delta caption (▲/▼/flat kg)
	// for a second corroborating signal.
	await expect(page.locator('section').first().locator('svg path').first()).toBeVisible();
	await expect(page.getByText(/(?:▲|▼|flat)\s*\d*(?:\.\d+)?\s*kg/)).toBeVisible();

	// Sanity-check the meta tiles reflect the three sets and the PR
	// equals the heaviest weight.
	const heaviest = Math.max(...WEIGHTS);
	await expect(page.getByText(`${heaviest} kg`).first()).toBeVisible();

	// 7. Export CSV and parse — verify our three set IDs aren't
	// strictly known here (UI generates the ULIDs), so verify by
	// (equipment name, weight, reps) tuple instead.
	const cookies = await page.context().cookies();
	const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
	const rows = await exportAndParseCsv(request, baseURL, cookieHeader);

	const header = rows[0];
	const dataRows = rows.slice(1);
	// Column names come from src/routes/api/export.csv/+server.ts COLUMNS.
	const eqNameIdx = header.indexOf('equipmentName');
	const weightIdx = header.indexOf('weightKg');
	expect(eqNameIdx, 'CSV has equipmentName column').toBeGreaterThanOrEqual(0);
	expect(weightIdx, 'CSV has weightKg column').toBeGreaterThanOrEqual(0);

	const ourRows = dataRows.filter((r) => r[eqNameIdx] === EQUIPMENT_NAME);
	expect(ourRows.length, 'CSV contains 3 rows for our equipment').toBe(3);

	const csvWeights = ourRows.map((r) => Number(r[weightIdx])).sort((a, b) => a - b);
	expect(csvWeights).toEqual([...WEIGHTS].sort((a, b) => a - b));
});
