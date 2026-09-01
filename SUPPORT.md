# Support

Thanks for using **Truncate IDE**. This page explains where to get help and
walks through the most common issues.

## Where to Get Help

| I want to…                                   | Go to                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Ask a usage question or share an idea        | [GitHub Discussions](https://github.com/Truncate-org/truncate-ide/discussions)          |
| Report a reproducible bug                    | [Bug report](https://github.com/Truncate-org/truncate-ide/issues/new?template=bug_report.yml) |
| Request a feature                            | [Feature request](https://github.com/Truncate-org/truncate-ide/issues/new?template=feature_request.yml) |
| Report a security vulnerability              | Follow [SECURITY.md](SECURITY.md) — **do not** open a public issue                       |
| Contribute code or docs                      | [CONTRIBUTING.md](CONTRIBUTING.md)                                                       |
| Report Code of Conduct concerns              | conduct@truncateide.dev — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)                    |

Please **search existing issues and discussions** before opening a new one —
your question may already be answered.

This is a community-supported open-source project. There is no paid support
channel or SLA; maintainers and contributors respond on a best-effort basis.

## Before You Ask

Have this information ready — it makes questions far faster to answer:

- **Truncate version** (see the app's About / settings, or the release you
  downloaded).
- **Operating system** and version (macOS 14, Ubuntu 24.04, Windows 11, …).
- **Database engine and version** (MySQL 8.0, PostgreSQL 16, SQLite, CSV).
- **Exact steps to reproduce**, what you expected, and what happened.
- Any error text from the app or, for dev builds, the terminal running
  `npm run tauri dev`.

> **Never paste real credentials, connection strings with passwords, or
> personal/customer data** into an issue or discussion. Redact them.

## Documentation

| Document                                     | Contents                                             |
| -------------------------------------------- | --------------------------------------------------- |
| [README.md](README.md)                       | Overview, features, quick start                     |
| [Document.md](Document.md)                    | Application guide: install, connect, AI copilot     |
| [truncate/USE.md](truncate/USE.md)            | Use cases and workflows                             |
| [truncate/FEATURES.md](truncate/FEATURES.md)  | Full feature list                                   |
| [truncate/linux.md](truncate/linux.md)        | Linux system dependencies and bundled binaries      |
| [truncate/CHANGELOG.md](truncate/CHANGELOG.md)| Release history                                     |
| [document/api.md](document/api.md)            | Auth / licensing API reference                      |

---

## Troubleshooting

### Installation & Launch

**macOS: "Truncate cannot be opened because the developer cannot be verified"**

The app is not notarized. Move `Truncate.app` to `/Applications`, then in
Terminal run:

```bash
xattr -cr "/Applications/Truncate.app"
```

Launch it again from Applications or Spotlight.

**Linux: the app won't start / missing library errors**

Install the WebKit2GTK and related development packages for your distribution.
See [truncate/linux.md](truncate/linux.md) for the exact package lists
(Ubuntu/Debian, Arch, Fedora).

**Linux: schema visualization or AI features don't work**

The Linux builds do not ship the `dot` (Graphviz) and `ollama` binaries. Follow
the "Binary Dependencies" section of [truncate/linux.md](truncate/linux.md) to
place them under `src-tauri/bin/` and `src-tauri/binaries/`.

**The app updated and now won't open (macOS)**

Re-run the `xattr -cr` command above against the app bundle.

---

### Database Connections

**"Connection failed" / "Connection refused"**

1. Confirm the database server is running and reachable from this machine
   (`ping`, `telnet host port`, or the engine's own CLI).
2. Check the **host** and **port**. Defaults: MySQL `3306`, PostgreSQL `5432`.
3. Make sure the database user is allowed to connect from your host and that a
   firewall isn't blocking the port.
4. For remote servers, verify the DB is bound to a reachable address (not only
   `127.0.0.1`) and that any required TLS settings are in place.

**Authentication fails even though the password is correct**

- Re-enter the password — trailing spaces and shell history artifacts are a
  common cause.
- Some MySQL 8 servers use `caching_sha2_password`; ensure your user's auth
  plugin is supported by the client.
- On PostgreSQL, check `pg_hba.conf` for the auth method expected from your
  host.

**SQLite: "unable to open database file"**

Provide the **full absolute path** to the `.db` / `.sqlite` file and make sure
the file (and its parent directory) is readable/writable by your user.

**CSV: columns or types look wrong**

Truncate infers structure (columns, types, separator) from the file. Ensure the
file has a header row and a consistent delimiter. Re-open the file after fixing
it.

**A saved connection's password isn't remembered**

Credentials are stored in the OS keychain via the `keyring` integration. If your
OS keychain is locked, unavailable, or denied access to the app, saving will
fail — unlock it (macOS Keychain Access, GNOME Keyring / KWallet on Linux,
Windows Credential Manager) and reconnect.

---

### Running Queries

**My `DELETE` / `DROP` / `UPDATE` is blocked**

Destructive-statement protection is intentional in the default (MVP) safety
mode. This is a guardrail, not a bug.

**Results seem truncated at 1000 rows**

Truncate auto-applies a `LIMIT 1000` to large result sets for performance
without modifying your SQL. Add your own explicit `LIMIT`/`OFFSET` (or an
aggregate) to page through more data.

**"SELECT requires FROM" or similar validation errors**

The editor validates SQL structure before execution. Check the statement — a
comments-only editor is treated as a no-op and will not run.

**`Cmd/Ctrl+Enter` doesn't run the query**

Click inside the Monaco editor first so it has focus, then use the shortcut or
the **Run** button.

---

### AI Copilot (Ollama)

**"AI not detected" / copilot features disabled**

1. Install [Ollama](https://ollama.com/) and start it: `ollama serve`.
2. Make sure the `ollama` binary is on your `PATH`.
3. Pull at least one model (for example `ollama pull llama3`).
4. Restart Truncate so it re-runs the Core Engine initialization.

**AI responses are slow or time out**

Local inference speed depends on your hardware and the model size. Try a smaller
model. All AI processing stays on your machine unless you have explicitly
configured an external API proxy.

---

### Integrated Terminal

**The terminal doesn't reflect schema changes in the sidebar**

The sidebar syncs with terminal activity, but if it drifts, trigger a manual
refresh of the explorer or reconnect. If it's reproducible, please file a bug
with steps.

**`mysql` / `psql` / `sqlite3` "command not found" in the terminal**

Truncate discovers these CLIs on your `PATH`. Install the client tools for your
engine and ensure they're on the `PATH` of the shell Truncate launches.

---

### Still Stuck?

Open a [Discussion](https://github.com/Truncate-org/truncate-ide/discussions)
(questions) or a [bug report](https://github.com/Truncate-org/truncate-ide/issues/new?template=bug_report.yml)
(reproducible defects) with the details listed in
[Before You Ask](#before-you-ask).
