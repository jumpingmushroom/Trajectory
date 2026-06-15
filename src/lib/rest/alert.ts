// Rest-done alert: a short two-tone Web Audio beep plus an optional
// vibration. No assets; works offline. iOS only allows audio after a user
// gesture, so primeAudio() must be called from the set-log click handler.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const Ctor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	if (!ctx) ctx = new Ctor();
	return ctx;
}

// Call from a user gesture (logging a set) to unlock audio on iOS.
export function primeAudio(): void {
	const c = audioCtx();
	if (c && c.state === 'suspended') void c.resume();
}

function beep(c: AudioContext, freq: number, startSec: number, durSec: number): void {
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	const t = c.currentTime + startSec;
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
	osc.connect(gain).connect(c.destination);
	osc.start(t);
	osc.stop(t + durSec);
}

export function playRestDone(opts: { sound: boolean; vibrate: boolean }): void {
	if (opts.sound) {
		const c = audioCtx();
		if (c) {
			if (c.state === 'suspended') void c.resume();
			beep(c, 880, 0, 0.18);
			beep(c, 1175, 0.2, 0.22);
		}
	}
	if (opts.vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		navigator.vibrate([200, 100, 200]);
	}
}
