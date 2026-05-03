<!-- Thanks for sending a PR! A few quick checks before you submit:

- For anything bigger than a bug fix or typo, please open an issue
  first so we can talk about scope. See CONTRIBUTING.md.
- Run `pnpm lint && pnpm check && pnpm test:smoke` locally and confirm
  they pass — CI runs the same gates and will block on failures.
- For UI changes, verify in a real browser via the dev container
  (`docker compose up`) before pushing. Screenshots/short recordings
  in the description help reviewers a lot.
-->

## What's changing

<!-- One or two sentences. Lead with the why; the what is in the diff. -->

## Why

<!-- The problem this PR solves. Link the issue if there is one
(`Fixes #123`, `Closes #45`). -->

## How to test

<!-- Concrete steps a reviewer can run to confirm the change works.
Boot the container, navigate to X, click Y, expect Z. -->

## Notes for the reviewer

<!-- Trade-offs you considered, things you're unsure about, follow-ups
you've intentionally left out. Optional. -->

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm check` passes
- [ ] `pnpm test:smoke` passes (if the change touches the server)
- [ ] Verified in a real browser (if the change touches the UI)
- [ ] Schema changes go through `pnpm db:generate`; migration file is
      committed alongside the schema diff
- [ ] CHANGELOG.md updated under the `## Unreleased` section (skip for
      pure refactors / docs)
