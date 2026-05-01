// Playwright config for Trajectory's full end-to-end test (M12).
//
// Mirrors the smoke test convention: assumes the dev container is up at
// TRAJECTORY_URL (default http://localhost:5173). We do NOT spawn a
// webServer here — `docker compose up` is the single way to bring the
// app up locally, and Playwright owning a process would just create a
// second source of truth. Run with `pnpm test:e2e` after `docker compose up`.

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.TRAJECTORY_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
