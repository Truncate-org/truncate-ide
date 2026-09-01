# Truncate IDE

**Truncate IDE** is a modern, high-performance SQL client built for speed, safety, and developer experience. Designed as a lightweight alternative to heavy database tools, it leverages the power of **Tauri (Rust)** for a native backend and **React** for a responsive frontend.



## Key Features

- **Lightning-Fast Execution**: Built on Rust `sqlx`, offering near-instant query performance.
- **Professional SQL Editor**: 
  - Powered by **Monaco Editor** (VS Code engine).
  - Real-time syntax highlighting with a custom "Truncate Dark" theme.
  - Bracket matching, line numbers, and intelligent wrapping.
- **Safety First**:
  - **Stateless Execution**: Each run is isolated; no context bleeding between queries.
  - **Destructive Query Protection**: Blocks `DELETE`, `DROP`, `UPDATE` in MVP mode.
  - **Smart Validation**: Validates SQL structure (e.g., `SELECT` requires `FROM`) before execution.
- **IDE-Grade Experience**:
  - **Comment-Aware**: Strips comments automatically; treats comments-only input as a no-op.
  - **Execution Feedback**: Immediate status feedback with execution duration.
  - **Auto-Limit**: Smartly applies `LIMIT 1000` to large queries without modifying your original SQL.
- **Database Explorer**: 
  - Manage connections (Host, Port, User).
  - Browse databases and tables.
  - Live context switching via UI or SQL `USE` commands.

## Tech Stack

- **Frontend**:
  - [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Zustand](https://github.com/pmndrs/zustand) (State Management)
  - [Monaco Editor](https://microsoft.github.io/monaco-editor/)
  - [Radix UI](https://www.radix-ui.com/) / Lucide Icons

- **Backend**:
  - [Tauri v2](https://tauri.app/) (Rust)
  - [SQLx](https://github.com/launchbadge/sqlx) (MySQL Async Driver)
  - [Tokio](https://tokio.rs/) (Async Runtime)

## Getting Started

### Prerequisites

- **Node.js**: v18+
- **Rust**: Latest stable (via `rustup`)
- **MySQL Database**: Local or remote instance

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/truncate-ide.git
   cd truncate-ide
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run tauri dev
   ```
   This will start the Vite frontend and compile the Rust backend. The application window should appear shortly.

## Usage Guide

### Connecting to a Database
1. Launch the app.
2. In the "Explorer" panel, enter your MySQL credentials (Host, Port, User, Password).
3. Click "Connect".
4. Select a database from the list to make it active.

### Running Queries
- Type your SQL in the main editor.
- Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Windows/Linux) to run.
- Or click the **Run** button in the top right.
- View results in the bottom panel.

### Shortcuts
- `Cmd+Enter`: Run Query
- `Cmd+P` (Planned): Command Palette

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our development workflow, coding standards, and how to submit pull requests.

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md) before participating. Need help? Check [SUPPORT.md](SUPPORT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.




