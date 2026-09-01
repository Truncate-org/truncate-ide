# Security Policy

Truncate IDE connects to databases, executes SQL, runs a bundled AI engine
(Ollama), and spawns local processes (a PTY-backed terminal, the `dot`
binary). We take the security of the application and the data it touches
seriously, and we appreciate responsible disclosure of vulnerabilities.

## Supported Versions

Security fixes are released for the latest published version. Older releases
are not patched — please upgrade before reporting an issue you can only
reproduce on an unsupported version.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

The current release series is `0.2.x`. See [truncate/CHANGELOG.md](truncate/CHANGELOG.md)
for release history.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email **arpit.sarang@truncateide.dev** with:

- A description of the vulnerability and its impact.
- The affected version(s), operating system, and database engine (if relevant).
- Step-by-step reproduction instructions or a proof of concept.
- Any suggested remediation, if you have one.

If you prefer, you may also use GitHub's
[private vulnerability reporting](https://github.com/Truncate-org/truncate-ide/security/advisories/new)
to open a confidential advisory.

Please encrypt sensitive details if possible, or ask us for a key before
sending them.

## What to Expect

| Stage                     | Target timeline                            |
| ------------------------- | ------------------------------------------ |
| Acknowledgement of report | Within 3 business days                     |
| Initial assessment        | Within 10 business days                    |
| Fix or mitigation plan    | Communicated after triage, severity-based  |
| Public disclosure         | Coordinated with you after a fix ships     |

We will keep you informed of progress throughout the process. Once a fix is
released, we are happy to credit you in the release notes and any advisory
unless you prefer to remain anonymous.

## Scope

In scope:

- The Truncate IDE desktop application (Tauri backend and React frontend) in
  this repository.
- The Tauri IPC command surface (`src-tauri/src/lib.rs` and adapters).
- Handling of credentials, connection strings, and secrets stored via the OS
  keychain (`keyring`).
- The bundled updater configuration and update verification.
- The local API proxy and device-auth / licensing flow.

Out of scope:

- Vulnerabilities in upstream dependencies that are already public and have no
  Truncate-specific exploit path (please report those upstream, but let us know
  so we can bump the dependency).
- Social engineering, physical attacks, or attacks requiring a already-fully-
  compromised host.
- Findings that require the user to connect to an untrusted database they
  control and then attack themselves, without crossing a privilege boundary.
- Denial of service caused by deliberately malformed local input to your own
  session.
- Reports from automated scanners without a demonstrated, reproducible impact.

## Handling of Credentials and Data

- Database credentials are intended to be stored in the operating system
  keychain via the `keyring` crate, not in plaintext config files. Report any
  path where secrets are written to disk, logs, or telemetry unencrypted.
- AI features are designed to run locally through Ollama; report any code path
  that sends schema, query text, or row data to a remote service without an
  explicit user opt-in.
- Never include real production credentials, personal data, or customer data in
  a vulnerability report, issue, or pull request. Use synthetic data.

Thank you for helping keep Truncate IDE and its users safe.
