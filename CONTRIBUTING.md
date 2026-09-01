# Contributing to Truncate IDE

Thanks for your interest in improving Truncate IDE — a high-performance,
developer-first SQL client built on **Tauri (Rust)** and **React**. This guide
covers how to set up your environment, the workflow for each part of the stack,
and what we look for in a pull request.

By participating in this project you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Tech Stack Workflow](#tech-stack-workflow)
  - [Frontend (React / TypeScript / Vite)](#frontend-react--typescript--vite)
  - [Backend (Rust / Tauri)](#backend-rust--tauri)
  - [Adding or Changing a Tauri Command](#adding-or-changing-a-tauri-command)
  - [Database Adapters](#database-adapters)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Branching & Pull Requests](#branching--pull-requests)
- [Pull Request Checklist](#pull-request-checklist)
- [Reporting Bugs & Requesting Features](#reporting-bugs--requesting-features)
- [Security Issues](#security-issues)
- [License](#license)

---

## Ways to Contribute

- **Report bugs** and **request features** through our
  [issue templates](https://github.com/Truncate-org/truncate-ide/issues/new/choose).
- **Improve documentation** — the `README.md`, `Document.md`, and the files
  under `document/` and `truncate/` (`FEATURES.md`, `USE.md`, `linux.md`).
- **Fix bugs or build features** — comment on the issue you'd like to take so we
  can avoid duplicate work.
- **Triage** — reproduce reported bugs, add detail, or suggest labels.

For anything larger than a small fix, please open an issue first to discuss the
approach before you invest significant time.

---

## Repository Layout

```
truncate-ide/
├── .github/                  # Issue templates, PR template, CI workflows
├── document/                 # Design notes, API spec, migration/progress docs
├── README.md / Document.md   # Project overview and application guide
└── truncate/                 # The application (run all npm/cargo commands from here)
    ├── src/                  # React + TypeScript frontend
    │   ├── components/       # UI (Layout, Panels, Modals, UI, auth, settings)
    │   ├── hooks/            # useAuth, useUpdater
    │   ├── lib/              # api client, keychain, logger
    │   ├── store/            # Zustand stores (ai, auth, database, ui)
    │   ├── types/ utils/     # Shared types and data/table helpers
    │   └── main.tsx App.tsx  # Entry points
    ├── src-tauri/            # Rust backend (Tauri v2)
    │   ├── src/
    │   │   ├── lib.rs        # Tauri builder + command registration
    │   │   ├── adapter.rs    # DbAdapter trait
    │   │   ├── mysql_adapter.rs / postgres_adapter.rs / sqlite_adapter.rs / csv_adapter.rs
    │   │   ├── analyzer/ services/   # SQL analysis + supporting services
    │   │   ├── ai_copilot.rs api_proxy.rs device_auth.rs subscription.rs
    │   │   ├── data_profiling.rs schema.rs sql_utils.rs terminal.rs
    │   │   └── db_state.rs error.rs types.rs keychain.rs
    │   ├── capabilities/     # Tauri capability (permission) definitions
    │   ├── binaries/ bin/    # Bundled Ollama + Graphviz `dot` (see linux.md)
    │   └── tauri.conf.json   # App config, bundle targets, updater
    └── package.json          # Frontend + Tauri CLI scripts
```

---

## Prerequisites

| Tool             | Version                        | Notes                                          |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| **Node.js**      | 18+ (an active LTS is best)    | CI builds against `lts/*`.                     |
| **npm**          | Ships with Node                | Lockfile is `truncate/package-lock.json`.      |
| **Rust**         | Latest stable via `rustup`     | Needs `rustfmt` and `clippy` components.       |
| **A database**   | MySQL, PostgreSQL, or SQLite   | Local instance or file for manual testing.     |

### Platform dependencies

- **macOS** — Xcode Command Line Tools (`xcode-select --install`).
- **Linux** — WebKit2GTK and related `-dev` packages. Follow
  [`truncate/linux.md`](truncate/linux.md), which also explains how to place the
  Linux `dot` and `ollama` binaries that are not checked in.
- **Windows** — Microsoft C++ Build Tools and the WebView2 runtime (see the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

The **AI Copilot** features need [Ollama](https://ollama.com/). It is bundled on
macOS; on Linux you provide the binary yourself (see `linux.md`). Schema
visualization uses Graphviz `dot`.

---

## Development Setup

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/truncate-ide.git
cd truncate-ide/truncate            # all commands run from the truncate/ folder

# 2. Add the upstream remote so you can stay in sync
git remote add upstream https://github.com/Truncate-org/truncate-ide.git

# 3. Install frontend dependencies
npm install

# 4. Run the app in development (starts Vite + compiles the Rust backend)
npm run tauri dev
```

The first `npm run tauri dev` compiles the entire Rust dependency tree and can
take several minutes. Subsequent runs are incremental.

Useful scripts (from `truncate/`):

| Command                | What it does                                                |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Vite dev server only (no native shell).                    |
| `npm run tauri dev`    | Full desktop app with hot-reloading frontend.              |
| `npm run build`        | `tsc` type-check + `vite build` (the frontend CI check).   |
| `npm run tauri build`  | Production bundle in `src-tauri/target/release/bundle/`.   |

---

## Tech Stack Workflow

### Frontend (React / TypeScript / Vite)

- **React 19** with function components and hooks. No class components.
- **TypeScript** in `strict` mode — no `any` unless there is a documented reason,
  and no `@ts-ignore` without an explanatory comment.
- **State**: [Zustand](https://github.com/pmndrs/zustand) stores in `src/store/`.
  Keep component state local; reach for a store only when state is shared across
  the tree or must survive unmount. Add selectors rather than subscribing to the
  whole store.
- **Styling**: Tailwind CSS v4 utility classes. Use `clsx` / `tailwind-merge`
  (`src/utils`) for conditional classes. Match the existing "Truncate Dark"
  visual language.
- **Editor**: Monaco via `@monaco-editor/react`. Terminal: `xterm` +
  `xterm-addon-fit`. Icons: `lucide-react`.
- **Talking to the backend**: call `@tauri-apps/api`'s `invoke` through the
  helpers in `src/lib/api.ts` — don't scatter raw `invoke` calls through
  components. Types for command arguments and results live in `src/types/`.
- Before pushing: `npm run build` must pass with no type errors.

### Backend (Rust / Tauri)

- **Edition 2021**, latest stable toolchain.
- Run these from `truncate/src-tauri/` before every push — they are exactly what
  CI enforces:

  ```bash
  cargo fmt --all -- --check      # formatting
  cargo clippy -- -D warnings     # lint; warnings fail the build
  cargo build                     # or `cargo check` for a faster loop
  ```

  Run `cargo fmt --all` (without `--check`) to auto-format.
- **Async**: the runtime is Tokio (`tokio = { features = ["full"] }`). Database
  access is async via `sqlx` 0.8. Don't block the async executor with sync I/O.
- **Errors**: return the crate's error type (`src-tauri/src/error.rs`) from
  commands rather than `unwrap()` / `expect()` / `panic!` on anything that can
  fail at runtime. Panics crash the user's app.
- **Serialization**: types crossing the IPC boundary derive
  `serde::Serialize` / `Deserialize` and live in or near `types.rs`.
- **Secrets**: credentials go through the `keyring`-backed keychain module —
  never log them, never write them to `tauri.conf.json` or other files.
- **Permissions**: new shell commands, filesystem paths, or plugins usually need
  an entry under `src-tauri/capabilities/`. Keep capabilities as narrow as
  possible.
- **Safety model**: preserve the existing guardrails — stateless execution,
  destructive-statement protection, and `LIMIT` injection for large result sets.
  If a change touches SQL parsing/validation (`analyzer/`, `sql_utils.rs`,
  `sqlparser`), describe the new behavior in the PR.

### Adding or Changing a Tauri Command

1. Implement the function in the appropriate module under `src-tauri/src/` and
   annotate it with `#[tauri::command]`.
2. Register it in the `invoke_handler` / `generate_handler!` list in
   [`truncate/src-tauri/src/lib.rs`](truncate/src-tauri/src/lib.rs).
3. Add or update the argument/result types and mirror them in
   `truncate/src/types/`.
4. Expose it through a helper in `truncate/src/lib/api.ts`.
5. If it spawns a process or touches the filesystem/network, update
   `src-tauri/capabilities/`.
6. Update `document/api.md` if the change affects the auth/licensing surface.
7. Manually exercise the happy path and at least one failure path.

### Database Adapters

Each engine implements the `DbAdapter` trait (`src-tauri/src/adapter.rs`).
When adding engine support or changing behavior:

- Keep engine-specific SQL quirks inside the adapter, not in shared code.
- Test against a real instance of that engine and note in the PR which
  version(s) you used.
- Update `README.md` / `Document.md` connection docs if the connection fields
  change.

---

## Coding Standards

- **Formatting is not a review topic** — `cargo fmt` and the frontend build
  settle it. Run them before you push.
- Keep changes focused. Unrelated refactors, dependency bumps, or reformatting
  belong in separate PRs.
- Match the style, naming, and structure of the surrounding code.
- Comment the *why*, not the *what*. Don't leave commented-out code.
- Don't add a dependency for something small you can write in a few lines.
  New dependencies should be justified in the PR description.
- Don't commit generated or local artifacts: `node_modules/`, `dist/`,
  `src-tauri/target/`, `.DS_Store`, `*.log`, build logs, or downloaded binaries.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional body explaining what and why>

<optional footer, e.g. "Closes #123">
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`.

Examples from this repo:

```
fix: resolve clippy and compilation errors in Rust
style: fix formatting in Rust and update api.md
chore: bump version to 0.2.6
```

Write in the imperative mood ("add", not "added"). Keep the summary under ~72
characters.

---

## Branching & Pull Requests

1. Sync your fork:
   ```bash
   git fetch upstream
   git checkout main
   git merge --ff-only upstream/main
   ```
2. Create a topic branch: `git checkout -b feat/short-description` (or
   `fix/…`, `docs/…`).
3. Make your changes in small, logical commits.
4. Run the full check suite (see the checklist below).
5. Push to your fork and open a PR against `Truncate-org/truncate-ide:main`.
6. Fill in the PR template completely. Link the issue it addresses.
7. Keep the PR up to date with `main`; prefer rebasing over merge commits when
   resolving conflicts.
8. A maintainer will review. Address feedback with additional commits (we squash
   on merge, so you don't need to rewrite history during review).

Keep PRs reviewable — if a change is getting large, split it.

---

## Pull Request Checklist

Before marking your PR ready for review, confirm:

- [ ] The PR targets `main` and is scoped to a single concern.
- [ ] There is a linked issue, or the PR description explains the motivation.
- [ ] **Frontend**: `npm run build` passes from `truncate/` with no type errors.
- [ ] **Backend**: `cargo fmt --all -- --check` passes from `truncate/src-tauri/`.
- [ ] **Backend**: `cargo clippy -- -D warnings` passes from `truncate/src-tauri/`.
- [ ] `npm run tauri dev` runs and the affected feature works end to end.
- [ ] New/changed Tauri commands are registered in `lib.rs`, typed on both
      sides, and wired through `src/lib/api.ts`.
- [ ] New process/filesystem/network access has a matching `capabilities/` entry.
- [ ] No secrets, credentials, real data, or personal data in code, fixtures,
      commits, or screenshots.
- [ ] No generated artifacts committed (`dist/`, `target/`, `node_modules/`,
      `.DS_Store`, logs).
- [ ] Docs updated where relevant (`README.md`, `Document.md`, `document/`,
      `truncate/FEATURES.md`, `truncate/USE.md`, `truncate/CHANGELOG.md`).
- [ ] Commits follow Conventional Commits.
- [ ] Manual test steps and platforms tested are described in the PR.

CI runs the frontend build and the Rust `fmt` + `clippy` checks on every PR; a
green CI run is required before merge.

---

## Reporting Bugs & Requesting Features

Use the templates at
<https://github.com/Truncate-org/truncate-ide/issues/new/choose>. Good reports
include the Truncate version, your OS, the database engine and version, exact
steps to reproduce, and what you expected versus what happened. Redact
credentials and data.

For usage questions and troubleshooting, see [SUPPORT.md](SUPPORT.md).

---

## Security Issues

**Do not report security vulnerabilities in public issues.** Follow the process
in [SECURITY.md](SECURITY.md).

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.
