import pkg from '../../package.json' with { type: 'json' };

export function load() {
	return {
		version: pkg.version
	};
}
