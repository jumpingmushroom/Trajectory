// Layout-wide server load. Ships unread-achievement metadata so
// <AchievementHost /> can pop a celebration modal on the next render after a
// badge is awarded, plus restSettings (user rest-timer config) and openRest
// (descriptor of the open session's last set for rehydrating the timer after
// a reload). Runs on every navigation — all queries are single-indexed.

import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	achievement,
	user,
	workoutSession,
	set as setTable,
	exercise,
	equipment
} from '$lib/server/db/schema';
import { and, eq, isNull, asc, desc } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Tag the load so <AchievementHost /> can re-run *just* this query via
	// invalidate('app:achievements') after a successful seen-ack, instead
	// of an invalidateAll().
	depends('app:achievements');
	if (!locals.user) {
		return { achievementQueue: [], isAdmin: false, restSettings: null, openRest: null };
	}
	const rows = await db
		.select({ id: achievement.id, badgeKey: achievement.badgeKey })
		.from(achievement)
		.where(and(eq(achievement.userId, locals.user.id), isNull(achievement.seenAt)))
		.orderBy(asc(achievement.unlockedAt));

	const urow = (
		await db
			.select({
				restDefaultSec: user.restDefaultSec,
				restTimerEnabled: user.restTimerEnabled,
				restSoundEnabled: user.restSoundEnabled,
				restVibrateEnabled: user.restVibrateEnabled
			})
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1)
	)[0];
	const restSettings = {
		enabled: urow?.restTimerEnabled ?? true,
		defaultSec: urow?.restDefaultSec ?? 90,
		sound: urow?.restSoundEnabled ?? true,
		vibrate: urow?.restVibrateEnabled ?? true
	};

	// Open session's last set → descriptor used to rehydrate the rest timer
	// after a reload. Cheap, single-indexed; mirrors the achievements query
	// that already runs on every navigation.
	const openSession = (
		await db
			.select({ id: workoutSession.id })
			.from(workoutSession)
			.where(and(eq(workoutSession.userId, locals.user.id), isNull(workoutSession.endedAt)))
			.orderBy(desc(workoutSession.startedAt))
			.limit(1)
	)[0];
	let openRest: {
		setId: string;
		ts: number;
		equipmentId: string;
		equipmentName: string;
		restTargetSec: number | null;
	} | null = null;
	if (openSession) {
		const last = (
			await db
				.select({
					setId: setTable.id,
					ts: setTable.ts,
					equipmentId: equipment.id,
					equipmentName: equipment.name,
					restTargetSec: equipment.restTargetSec
				})
				.from(setTable)
				.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
				.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
				.where(and(eq(setTable.workoutSessionId, openSession.id), isNull(setTable.deletedAt)))
				.orderBy(desc(setTable.ts))
				.limit(1)
		)[0];
		if (last) {
			openRest = {
				setId: last.setId,
				ts: last.ts.getTime(),
				equipmentId: last.equipmentId,
				equipmentName: last.equipmentName,
				restTargetSec: last.restTargetSec
			};
		}
	}

	return {
		achievementQueue: rows,
		isAdmin: locals.user.role === 'admin',
		restSettings,
		openRest
	};
};
