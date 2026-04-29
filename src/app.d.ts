import type { Session } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: Session['session'];
			user?: Session['user'];
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
