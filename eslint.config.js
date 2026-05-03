import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		rules: {
			// Allow `_`-prefixed identifiers (positional throwaways in
			// destructuring, deliberately discarded each-block index, the
			// `_lastTs` rest-spread idiom). Standard typescript-eslint pattern.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
			// SvelteKit 2.26 added `resolve()` for type-safe internal nav. The
			// migration is a separate sweep — turning it on now would block
			// every PR on a 36-call rewrite that doesn't change runtime
			// behavior. Re-enable once the codebase is migrated end-to-end.
			'svelte/no-navigation-without-resolve': 'off',
			// Off because the rule fires on transient locals (Date inside a
			// helper, Map/Set inside a `$derived.by`) where reactive variants
			// would actually be wrong. Re-evaluate per-site when we have a
			// real reactive-state case to migrate, then narrow the rule
			// instead of disabling it wholesale.
			'svelte/prefer-svelte-reactivity': 'off'
		}
	}
);
