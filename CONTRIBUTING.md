# Contributing

Trajectory is a single-author, opinionated project. Drive-by bug fixes and small improvements are very welcome. For anything larger — new features, schema changes, dependency swaps, structural refactors — please [open an issue](https://github.com/jumpingmushroom/Trajectory/issues) first so we can talk about scope before you spend time on a PR.

## Running the code

```sh
git clone https://github.com/jumpingmushroom/Trajectory.git
cd Trajectory
cp .env.example .env
docker compose up
```

The container is the only supported dev workflow — there is no `pnpm dev` on the host. See `README.md` for details.

## Running the checks

```sh
pnpm check                 # svelte-check + typecheck
pnpm build                 # production build
pnpm test:smoke            # node-fetch smoke against the running container
pnpm test:e2e              # Playwright full-flow (manual safety net)
```

The CI workflow runs `check`, `build`, and `test:smoke` on every PR. Playwright is not gated in CI; run it locally if your change touches a user-facing flow.

## Commits and PRs

- **Commit style:** small, frequent, present-tense imperative ("add equipment glyph chooser"). [Conventional Commits](https://www.conventionalcommits.org/) prefixes (`feat:`, `fix:`, `docs:`, `chore:`) are encouraged.
- **Schema changes** must go through Drizzle migrations — never hand-edit an applied migration file. Run `pnpm db:generate` after editing `src/lib/server/db/schema.ts` and commit the generated SQL alongside the schema change.
- **Browser-test before pushing.** Boot the container, click through your change in the browser, and confirm the console is clean. UI regressions land easily and the smoke test won't catch them.
- **Keep PRs focused.** One logical change per PR; refactors get their own PR separate from feature work.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include the version (Setup screen footer), browser, steps, expected vs. actual behaviour, and any console output.

For security issues, see [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
