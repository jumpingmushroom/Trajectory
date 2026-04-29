// Demo data for Trajectory
// Single user. Multi-gym. Units: kg.

// ── Gyms ─────────────────────────────────────────────────────
// The user trains at these. `primary` is the default-active one on launch.
const GYMS = [
  { id: 'spenst-tonsberg', name: 'Spenst Tønsberg',  city: 'Tønsberg', tint: '#2a1a12', primary: true },
  { id: 'sats-sandefjord', name: 'SATS Sandefjord',  city: 'Sandefjord', tint: '#1a2530' },
  { id: 'home-garage',     name: 'Home Garage',       city: 'Home',      tint: '#1b2316' },
];

// Equipment. Each belongs to one gym (`gymId`).
// `tint` = tile tint; `glyph` = abstract motif (no stock photos, no brand marks).
const EQUIPMENT = [
  // ── Spenst Tønsberg (commercial) ─────────────────────────────
  { id: 'leg-press',  gymId: 'spenst-tonsberg', name: 'Leg Press',            type: 'machine',    group: 'legs',   tint: '#2a1a12', glyph: 'legpress',   lastWeight: 140,  lastReps: 10, daysSince: 1 },
  { id: 'cable-row',  gymId: 'spenst-tonsberg', name: 'Cable Row',            type: 'cable',      group: 'pull',   tint: '#12202a', glyph: 'cable',      lastWeight: 65,   lastReps: 10, daysSince: 3 },
  { id: 'lat-pd',     gymId: 'spenst-tonsberg', name: 'Lat Pulldown',         type: 'cable',      group: 'pull',   tint: '#1a2530', glyph: 'pulldown',   lastWeight: 57.5, lastReps: 10, daysSince: 3 },
  { id: 'smith',      gymId: 'spenst-tonsberg', name: 'Smith Machine',        type: 'machine',    group: 'push',   tint: '#221a14', glyph: 'smith',      lastWeight: 60,   lastReps: 8,  daysSince: 5 },
  { id: 'flat-bench', gymId: 'spenst-tonsberg', name: 'Flat Bench Press',     type: 'barbell',    group: 'push',   tint: '#2a1a12', glyph: 'bench',      lastWeight: 72.5, lastReps: 8,  daysSince: 1 },
  { id: 'squat-rack', gymId: 'spenst-tonsberg', name: 'Squat Rack',           type: 'barbell',    group: 'legs',   tint: '#2e1d13', glyph: 'squat',      lastWeight: 95,   lastReps: 6,  daysSince: 4 },
  { id: 'preacher',   gymId: 'spenst-tonsberg', name: 'Preacher Curl Bench',  type: 'freeweight', group: 'pull',   tint: '#1b2316', glyph: 'preacher',   lastWeight: 22.5, lastReps: 10, daysSince: 6 },
  { id: 'chest-press',gymId: 'spenst-tonsberg', name: 'Seated Chest Press',   type: 'machine',    group: 'push',   tint: '#241612', glyph: 'chestpress', lastWeight: 50,   lastReps: 10, daysSince: 1 },
  { id: 'tm-3',       gymId: 'spenst-tonsberg', name: 'Treadmill #3',         type: 'cardio',     group: 'cardio', tint: '#102028', glyph: 'treadmill',  lastWeight: null, lastReps: null, daysSince: 2, lastDuration: 22, lastDistanceKm: 3.1 },
  { id: 'bike-2',     gymId: 'spenst-tonsberg', name: 'Stationary Bike #2',   type: 'cardio',     group: 'cardio', tint: '#12202a', glyph: 'bike',       lastWeight: null, lastReps: null, daysSince: 8, lastDuration: 35 },
  { id: 'rower',      gymId: 'spenst-tonsberg', name: 'Rowing Machine',       type: 'cardio',     group: 'cardio', tint: '#0f2426', glyph: 'rower',      lastWeight: null, lastReps: null, daysSince: 9, lastDuration: 18 },

  // ── SATS Sandefjord (secondary — when I visit family) ────────
  { id: 'sats-hack',    gymId: 'sats-sandefjord', name: 'Hack Squat',        type: 'machine',   group: 'legs',  tint: '#2a1a18', glyph: 'squat',      lastWeight: 80,  lastReps: 8,  daysSince: 14 },
  { id: 'sats-row',     gymId: 'sats-sandefjord', name: 'T-Bar Row',         type: 'freeweight',group: 'pull',  tint: '#12202a', glyph: 'cable',      lastWeight: 50,  lastReps: 8,  daysSince: 14 },
  { id: 'sats-incline', gymId: 'sats-sandefjord', name: 'Incline DB Bench',  type: 'freeweight',group: 'push',  tint: '#241612', glyph: 'bench',      lastWeight: 22.5,lastReps: 10, daysSince: 22 },

  // ── Home Garage ──────────────────────────────────────────────
  { id: 'home-rack',  gymId: 'home-garage', name: 'Power Rack',              type: 'barbell',   group: 'legs',  tint: '#2e1d13', glyph: 'squat',     lastWeight: 80,  lastReps: 5,  daysSince: 35 },
  { id: 'home-dbs',   gymId: 'home-garage', name: 'Adjustable Dumbbells',    type: 'freeweight',group: 'push',  tint: '#221a14', glyph: 'chestpress',lastWeight: 24,  lastReps: 10, daysSince: 40 },
];

// Common weights per machine (learned-from-history chips)
const COMMON_WEIGHTS = {
  'leg-press':   [120, 130, 140, 150],
  'cable-row':   [55, 60, 65, 70],
  'lat-pd':      [50, 55, 57.5, 60],
  'smith':       [50, 55, 60, 65],
  'flat-bench':  [60, 65, 70, 72.5],
  'squat-rack':  [80, 85, 90, 95],
  'preacher':    [17.5, 20, 22.5, 25],
  'chest-press': [40, 45, 50, 55],
  'sats-hack':   [70, 75, 80, 85],
  'sats-row':    [40, 45, 50, 55],
  'sats-incline':[18, 20, 22.5, 25],
  'home-rack':   [70, 75, 80, 90],
  'home-dbs':    [20, 22, 24, 26],
};

// Progression history per machine (weight over time). Realistic curves.
const PROGRESSION = {
  'leg-press':   [100,105,110,115,115,120,125,125,130,135,135,140,140,140,140],
  'cable-row':   [45, 47.5,50,52.5,55,55,57.5,60,60,62.5,62.5,65,65,65,65],
  'lat-pd':      [40, 42.5,45,47.5,47.5,50,52.5,52.5,55,55,55,57.5,57.5,57.5,57.5],
  'smith':       [45, 47.5,50,50,52.5,55,55,57.5,57.5,60,60,60,60,60,60],
  'flat-bench':  [55, 57.5,60,60,62.5,65,65,67.5,70,70,72.5,72.5,72.5,72.5,72.5],
  'squat-rack':  [75, 80,80,82.5,85,85,87.5,90,90,92.5,92.5,95,95,95,95],
  'preacher':    [15, 17.5,17.5,17.5,20,20,20,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5],
  'chest-press': [35, 37.5,40,40,42.5,45,45,47.5,47.5,50,50,50,50,50,50],
};

// Sessions (newest first). Each session = machines touched + sets logged.
// Single user — user field removed. `gymId` tells us where the session happened.
function mkSet(w, r) { return { weight: w, reps: r }; }
const SESSIONS = [
  { id: 's-today', gymId: 'spenst-tonsberg', dayOffset: 0,  durationMin: 47, machines: [
      { id: 'flat-bench', sets: [mkSet(60,8), mkSet(70,6), mkSet(72.5,5), mkSet(72.5,4)] },
      { id: 'cable-row',  sets: [mkSet(60,10), mkSet(65,10), mkSet(65,8)] },
      { id: 'chest-press',sets: [mkSet(45,10), mkSet(50,10), mkSet(50,8)] },
      { id: 'leg-press',  sets: [mkSet(120,12), mkSet(140,10), mkSet(140,8)] },
    ] },
  { id: 's-2', gymId: 'spenst-tonsberg', dayOffset: 2, durationMin: 52, machines: [
      { id: 'squat-rack', sets: [mkSet(80,6), mkSet(90,5), mkSet(95,4), mkSet(95,4)] },
      { id: 'leg-press',  sets: [mkSet(120,10), mkSet(135,10), mkSet(140,10)] },
      { id: 'preacher',   sets: [mkSet(17.5,10), mkSet(22.5,10), mkSet(22.5,8)] },
    ] },
  { id: 's-4', gymId: 'spenst-tonsberg', dayOffset: 3, durationMin: 38, machines: [
      { id: 'lat-pd',     sets: [mkSet(50,10), mkSet(55,10), mkSet(57.5,8)] },
      { id: 'cable-row',  sets: [mkSet(55,10), mkSet(60,10), mkSet(60,8)] },
      { id: 'preacher',   sets: [mkSet(20,10), mkSet(22.5,10)] },
    ] },
  { id: 's-5', gymId: 'spenst-tonsberg', dayOffset: 5, durationMin: 45, machines: [
      { id: 'smith',      sets: [mkSet(50,8), mkSet(55,8), mkSet(60,8), mkSet(60,6)] },
      { id: 'flat-bench', sets: [mkSet(60,8), mkSet(65,8), mkSet(67.5,6)] },
      { id: 'chest-press',sets: [mkSet(42.5,10), mkSet(47.5,10)] },
    ] },
  { id: 's-7', gymId: 'spenst-tonsberg', dayOffset: 7, durationMin: 41, machines: [
      { id: 'leg-press',  sets: [mkSet(115,12), mkSet(130,10), mkSet(135,8)] },
      { id: 'preacher',   sets: [mkSet(17.5,10), mkSet(20,10), mkSet(22.5,8)] },
    ] },
  { id: 's-8', gymId: 'spenst-tonsberg', dayOffset: 9, durationMin: 48, machines: [
      { id: 'squat-rack', sets: [mkSet(75,8), mkSet(85,6), mkSet(90,4)] },
      { id: 'smith',      sets: [mkSet(50,8), mkSet(55,8), mkSet(55,6)] },
    ] },
  { id: 's-9', gymId: 'spenst-tonsberg', dayOffset: 11, durationMin: 36, machines: [
      { id: 'lat-pd',     sets: [mkSet(47.5,10), mkSet(52.5,10), mkSet(55,8)] },
      { id: 'cable-row',  sets: [mkSet(52.5,10), mkSet(57.5,10)] },
    ] },
  { id: 's-11', gymId: 'spenst-tonsberg', dayOffset: 14, durationMin: 50, machines: [
      { id: 'sats-hack',    sets: [mkSet(70,8), mkSet(75,8), mkSet(80,6)] },
      { id: 'sats-row',     sets: [mkSet(45,10), mkSet(50,8)] },
      { id: 'sats-incline', sets: [mkSet(20,10), mkSet(22.5,8)] },
    ], gymIdOverride: 'sats-sandefjord' },
  { id: 's-12', gymId: 'spenst-tonsberg', dayOffset: 16, durationMin: 42, machines: [
      { id: 'leg-press',  sets: [mkSet(110,12), mkSet(125,10), mkSet(130,8)] },
    ] },
  { id: 's-13', gymId: 'sats-sandefjord', dayOffset: 22, durationMin: 39, machines: [
      { id: 'sats-hack',    sets: [mkSet(65,10), mkSet(70,8), mkSet(75,6)] },
      { id: 'sats-incline', sets: [mkSet(18,10), mkSet(20,10)] },
    ] },
  { id: 's-14', gymId: 'home-garage', dayOffset: 35, durationMin: 32, machines: [
      { id: 'home-rack', sets: [mkSet(70,5), mkSet(75,5), mkSet(80,5)] },
      { id: 'home-dbs',  sets: [mkSet(22,10), mkSet(24,10)] },
    ] },
];
// Fix: s-11 was mislabeled — it's a SATS session
SESSIONS.forEach(s => { if (s.gymIdOverride) { s.gymId = s.gymIdOverride; delete s.gymIdOverride; } });

// Build heatmap: count sessions per day for last 84 days.
// `gymId` null/undefined = all gyms.
function heatmapFor(gymId) {
  const days = 84;
  const map = new Array(days).fill(0);
  SESSIONS.forEach(s => {
    if (gymId && s.gymId !== gymId) return;
    if (s.dayOffset < days) map[s.dayOffset] = (map[s.dayOffset] || 0) + 1;
  });
  // Add some older speckle for visual density
  const seed = 7;
  for (let i = 0; i < days; i++) {
    const r = Math.abs(Math.sin(i * seed + seed));
    if (map[i] === 0 && r > 0.82) map[i] = 1;
    if (r > 0.96) map[i] = 2;
  }
  return map;
}

Object.assign(window, { GYMS, EQUIPMENT, COMMON_WEIGHTS, PROGRESSION, SESSIONS, heatmapFor });
