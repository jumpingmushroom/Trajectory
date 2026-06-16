import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	it('renders the image with a cache-bust query when image is set', () => {
		const { body } = render(Avatar, {
			props: { name: 'Alice', image: '/uploads/avatars/u1.webp', version: 1700 }
		});
		expect(body).toContain('src="/uploads/avatars/u1.webp?v=1700"');
		expect(body).not.toContain('>A<');
	});

	it('falls back to the uppercased initial when no image', () => {
		const { body } = render(Avatar, {
			props: { name: 'alice', image: null, version: 0 }
		});
		expect(body).not.toContain('<img');
		expect(body).toContain('A');
	});

	it('renders empty initial without throwing when name is empty', () => {
		const { body } = render(Avatar, { props: { name: '', image: null, version: 0 } });
		expect(body).not.toContain('<img');
	});
});
