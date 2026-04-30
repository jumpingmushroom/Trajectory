import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
			injectRegister: 'auto',
			devOptions: {
				// Keep the SW out of the dev path — Vite HMR + service worker
				// fight in subtle ways. The SW is built + tested via
				// `pnpm build && pnpm preview`.
				enabled: false
			},
			manifest: {
				name: 'Trajectory',
				short_name: 'Trajectory',
				description: 'Equipment-first workout tracker.',
				theme_color: '#0d0f12',
				background_color: '#0d0f12',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				scope: '/',
				lang: 'en',
				icons: [
					{
						src: '/icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				navigateFallback: '/',
				navigateFallbackAllowlist: [/^\/(?!api|uploads).*/],
				navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				runtimeCaching: [
					{
						// /api/ is always fresh-from-network. The earlier NetworkFirst
						// config cached /api/export.csv (full per-user CSV) and
						// /api/auth/get-session for 24h regardless of cache-control,
						// which on a shared device would serve user A's data to user B.
						// The IndexedDB queue (sync.ts) is the offline write buffer;
						// the SW cache adds nothing for reads here and is a privacy
						// liability.
						urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
						handler: 'NetworkOnly'
					},
					{
						urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'trajectory-uploads',
							expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
							cacheableResponse: { statuses: [0, 200] }
						}
					},
					{
						urlPattern: ({ url }) =>
							url.origin === 'https://fonts.googleapis.com' ||
							url.origin === 'https://fonts.gstatic.com',
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'trajectory-fonts',
							expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] }
						}
					}
				]
			}
		})
	],
	server: {
		host: '0.0.0.0',
		port: 5173,
		strictPort: true,
		watch: {
			usePolling: true,
			interval: 200
		}
	}
});
