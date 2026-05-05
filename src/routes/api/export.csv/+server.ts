// GET /api/export.csv
// Streams a flat per-set CSV with joined gym + equipment + exercise +
// user names so the export opens cleanly in any spreadsheet without
// needing the relational context. Always scoped to the calling user's
// own rows under v0.2 multiuser tenancy (the prior `scope=all` mode is
// no longer accepted; one user's data is opaque to another).

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	user,
	gym,
	equipment,
	exercise,
	set as setTable,
	workoutSession
} from '$lib/server/db/schema';
import { isNull, eq, and, asc } from 'drizzle-orm';

const COLUMNS = [
	'setId',
	'userId',
	'userName',
	'sessionId',
	'sessionStartedAt',
	'gymId',
	'gymName',
	'equipmentId',
	'equipmentName',
	'equipmentType',
	'equipmentGroup',
	'inputMode',
	'cardioKind',
	'exerciseId',
	'exerciseName',
	'weightKg',
	'reps',
	'durationMin',
	'distanceKm',
	'calories',
	'avgHR',
	'otherExtrasJson',
	'ts'
] as const;

const KNOWN_EXTRAS = new Set(['distance', 'calories', 'hr']);

// Cells starting with =, +, -, @, or whitespace control chars are interpreted
// as formulas by Excel/Numbers/Sheets — a gym/equipment named "=HYPERLINK(...)"
// would execute on open. Wrap in quotes and prefix a single quote so the
// spreadsheet treats it as literal text. Pure-numeric leading minus (e.g. a
// negative weight delta in a future column) is still safe because it's a
// number, not user-controlled string — but our user-controlled fields here
// are all strings, so blanket-escape any leading-formula-char string.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvEscape(value: unknown): string {
	if (value == null) return '';
	const str = typeof value === 'string' ? value : String(value);
	if (FORMULA_PREFIX.test(str)) {
		return `"'${str.replace(/"/g, '""')}"`;
	}
	if (/[",\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function sanitizeFilename(name: string): string {
	return name.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'user';
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthenticated');

	const baseFilter = and(
		isNull(setTable.deletedAt),
		isNull(exercise.deletedAt),
		isNull(equipment.deletedAt),
		isNull(gym.deletedAt),
		eq(setTable.userId, locals.user.id),
		eq(gym.userId, locals.user.id)
	);

	const rows = (await db
		.select({
			setId: setTable.id,
			ts: setTable.ts,
			weight: setTable.weight,
			reps: setTable.reps,
			durationMin: setTable.durationMin,
			extras: setTable.extras,
			userId: setTable.userId,
			userName: user.name,
			sessionId: workoutSession.id,
			sessionStartedAt: workoutSession.startedAt,
			gymId: gym.id,
			gymName: gym.name,
			equipmentId: equipment.id,
			equipmentName: equipment.name,
			equipmentType: equipment.type,
			equipmentGroup: equipment.group,
			inputMode: equipment.inputMode,
			cardioKind: equipment.cardioKind,
			exerciseId: exercise.id,
			exerciseName: exercise.name
		})
		.from(setTable)
		.innerJoin(exercise, eq(exercise.id, setTable.exerciseId))
		.innerJoin(equipment, eq(equipment.id, exercise.equipmentId))
		.innerJoin(gym, eq(gym.id, equipment.gymId))
		.innerJoin(workoutSession, eq(workoutSession.id, setTable.workoutSessionId))
		.innerJoin(user, eq(user.id, setTable.userId))
		.where(baseFilter)
		.orderBy(asc(setTable.ts))) as Array<{
		setId: string;
		ts: Date;
		weight: number | null;
		reps: number | null;
		durationMin: number | null;
		extras: Record<string, number> | null;
		userId: string;
		userName: string;
		sessionId: string;
		sessionStartedAt: Date;
		gymId: string;
		gymName: string;
		equipmentId: string;
		equipmentName: string;
		equipmentType: string;
		equipmentGroup: string;
		inputMode: string;
		cardioKind: string | null;
		exerciseId: string;
		exerciseName: string;
	}>;

	const lines: string[] = [COLUMNS.join(',')];
	for (const r of rows) {
		const extras = r.extras ?? {};
		const distanceKm =
			typeof extras.distance === 'number'
				? // rower stores distance in meters (>= 200 + integer); convert to km
					extras.distance >= 200 && Number.isInteger(extras.distance)
					? (extras.distance / 1000).toFixed(3)
					: extras.distance
				: '';
		const calories = typeof extras.calories === 'number' ? extras.calories : '';
		const avgHR = typeof extras.hr === 'number' ? extras.hr : '';
		const otherExtras: Record<string, number> = {};
		for (const [k, v] of Object.entries(extras)) {
			if (!KNOWN_EXTRAS.has(k)) otherExtras[k] = v;
		}
		const otherJson = Object.keys(otherExtras).length > 0 ? JSON.stringify(otherExtras) : '';
		const cells = [
			r.setId,
			r.userId,
			r.userName,
			r.sessionId,
			r.sessionStartedAt.toISOString(),
			r.gymId,
			r.gymName,
			r.equipmentId,
			r.equipmentName,
			r.equipmentType,
			r.equipmentGroup,
			r.inputMode,
			r.cardioKind ?? '',
			r.exerciseId,
			r.exerciseName,
			r.weight ?? '',
			r.reps ?? '',
			r.durationMin ?? '',
			distanceKm,
			calories,
			avgHR,
			otherJson,
			r.ts.toISOString()
		];
		lines.push(cells.map(csvEscape).join(','));
	}

	const body = lines.join('\r\n') + '\r\n';
	const dateStamp = new Date().toISOString().slice(0, 10);
	const filename = `trajectory-export-${sanitizeFilename(locals.user.name)}-${dateStamp}.csv`;

	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
};
