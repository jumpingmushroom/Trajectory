// Client-side store of unread achievements. Seeded by `+layout.server.ts`
// load output and trimmed when the modal acks an unlock. Re-seeded on
// every layout invalidation (which fires after queue drains, navs, etc.)
// so the queue stays in sync with the server's view of seenAt=null.

import { writable } from 'svelte/store';

export interface QueuedAchievement {
	id: string;
	badgeKey: string;
}

const store = writable<QueuedAchievement[]>([]);

export const achievementQueue = {
	subscribe: store.subscribe,
	/**
	 * Replace the queue contents. Called from <AchievementHost /> on each
	 * `data.achievementQueue` change so navigations / `invalidateAll()`
	 * pick up newly-awarded badges.
	 */
	set(items: QueuedAchievement[]) {
		store.set(items);
	},
	/** Remove the head of the queue after a successful dismiss. */
	consume(id: string) {
		store.update((list) => list.filter((q) => q.id !== id));
	}
};
