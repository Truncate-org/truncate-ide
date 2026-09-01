<!--
Thanks for contributing to Truncate IDE!
Please read CONTRIBUTING.md before opening this PR.
Keep the PR focused on a single concern. Fill in every section below.
-->

## Summary

<!-- What does this PR do, and why? -->

## Related issue

<!-- e.g. "Closes #123". If there is no issue, explain the motivation above. -->
Closes #

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor / internal change (no user-facing behavior change)
- [ ] Documentation
- [ ] Build / CI / tooling

## Areas touched

- [ ] Frontend — React / TypeScript (`truncate/src/`)
- [ ] Backend — Rust / Tauri (`truncate/src-tauri/`)
- [ ] Tauri command surface (`lib.rs` + `src/lib/api.ts` + types)
- [ ] Database adapter(s) (`adapter.rs`, `*_adapter.rs`)
- [ ] SQL parsing / validation / safety (`analyzer/`, `sql_utils.rs`)
- [ ] Capabilities / permissions (`src-tauri/capabilities/`)
- [ ] Packaging / updater (`tauri.conf.json`, workflows)
- [ ] Docs

## How was this tested?

<!-- Describe the manual testing you did. Include OS and database engine + version. -->

- OS:
- Database engine / version:
- Steps:

## Checklist

- [ ] The PR targets `main` and is scoped to one concern.
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- [ ] **Frontend**: `npm run build` passes from `truncate/` with no type errors. *(or n/a)*
- [ ] **Backend**: `cargo fmt --all -- --check` passes from `truncate/src-tauri/`. *(or n/a)*
- [ ] **Backend**: `cargo clippy -- -D warnings` passes from `truncate/src-tauri/`. *(or n/a)*
- [ ] `npm run tauri dev` runs and the affected feature works end to end.
- [ ] New/changed Tauri commands are registered in `lib.rs`, typed on both sides, and wired through `src/lib/api.ts`.
- [ ] New process / filesystem / network access has a matching `capabilities/` entry.
- [ ] Existing safety guardrails (stateless execution, destructive-statement protection, `LIMIT` injection) are preserved or the change is explained.
- [ ] No secrets, credentials, real data, or personal data in code, fixtures, commits, or screenshots.
- [ ] No generated artifacts committed (`dist/`, `target/`, `node_modules/`, `.DS_Store`, logs).
- [ ] Documentation updated where relevant (`README.md`, `Document.md`, `document/`, `truncate/FEATURES.md`, `truncate/USE.md`, `truncate/CHANGELOG.md`).

## Screenshots / recordings

<!-- For UI changes. Delete this section if not applicable. -->

## Additional notes for reviewers

<!-- Anything that will help the review: tricky spots, follow-ups, known limitations. -->
