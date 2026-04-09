# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-04-06

### Added
- Created this `CHANGELOG.md` to track project evolution.
- Integrated `ollama` as a bundled dependency for offline AI capabilities.
- Added specialized `dot` binary logic for database schema visualization.

### Fixed
- **Terminal Real-Time Refresh**: Fixed a critical issue where dropping tables in the terminal didn't update the sidebar in real-time.
- **Profile Sign-In/Out**: Stabilized the user profile lifecycle and sign-out logic.
- **CLI Discovery**: Improved automatic discovery of database binaries (`mysql`, `psql`, `sqlite3`) across different operating systems.
- **Auto-Sync Logic**: Enhanced synchronization between terminal execution and the UI data grid.

## [0.1.0] - Pre-release

### Initial Features
- Basic database connectivity for MySQL, PostgreSQL, and SQLite.
- Interactive SQL terminal with PTY support.
- Database explorer and table preview grid.
- Integrated AI Copilot for SQL assistance.
