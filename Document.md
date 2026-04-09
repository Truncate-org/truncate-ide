# Truncate Application Guide

Welcome to **Truncate**, a high-performance, developer-first SQL IDE. Truncate is designed to be a lightweight, secure, and intelligent companion for managing your databases and data workflows.

---

## 📥 Download Truncate

| Platform | Format | Download Link |
| :--- | :--- | :--- |
| **macOS** | `.dmg` | [Download for Mac](https://github.com/Truncate-org/truncate-ide/releases) |
| **Linux** | `.deb` / `.AppImage` | [Download for Linux](https://github.com/Truncate-org/truncate-ide/releases) |

---

## 🚀 Getting Started (macOS)

If you have just downloaded the application on macOS, you may encounter a security warning stating that the app "cannot be opened because the developer cannot be verified." 

To resolve this and start the application, follow these steps:

1. Move **Truncate.app** to your `/Applications` folder.
2. Open your **Terminal** app.
3. Copy and paste the following command and press Enter:
   ```bash
   xattr -cr "/Applications/Truncate.app"
   ```
4. You can now launch Truncate from your Applications folder or Spotlight.

---

## 🐧 Getting Started (Linux)

Truncate is available as a `.deb` package or a portable `.AppImage`.

1. **For Ubuntu/Debian**:
   ```bash
   sudo dpkg -i truncate_amd64.deb
   sudo apt-get install -f # Install missing dependencies
   ```
2. **For AppImage**:
   - Right-click the file -> **Properties** -> **Permissions** -> **Allow executing file as program**.
   - Or run: `chmod +x truncate.AppImage && ./truncate.AppImage`

---

## 🛠 Prerequisites

To get the most out of Truncate, ensure the following are available in your environment:

- **Database Access**: A running instance of MySQL, PostgreSQL, or a local SQLite file/CSV.
- **AI Intelligence (Ollama)**: For AI-powered query suggestions and copilot features, we recommend installing [Ollama](https://ollama.com/) on your machine.

---

## 🔌 Connecting to Your Data

Truncate supports multiple "Engines." Each requires specific fields to establish a secure connection:

### 1. PostgreSQL & MySQL
- **Host**: The server address (e.g., `localhost` or `123.45.67.89`).
- **Port**: 
  - Default for **MySQL**: `3306`
  - Default for **PostgreSQL**: `5432`
- **User**: Your database username.
- **Password**: Your database password.

### 2. SQLite
- **Path**: The full file path to your `.db` or `.sqlite` file. You can use the file picker to browse and select it.

### 3. CSV (Flat Files)
- **File Path**: The path to your `.csv` file. 
- Truncate will automatically inspect the file structure (columns, types, and separators) to treat it like a temporary database table.

---

## 🧠 Using the AI Copilot

Truncate features a built-in **Data Intelligence Engine** powered by local AI.

1. **Initialization**: On first launch, Truncate will attempt to synchronize with your local AI engine. Follow the prompts in the **Core Engine Initialization** screen.
2. **AI Shortcuts**: Use the AI button or specific shortcuts (coming soon) to generate SQL from natural language or explain complex queries.

---

## ⌨️ Shortcuts & Interaction

| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
| :--- | :--- | :--- |
| **Run Query** | `Cmd + Enter` | `Ctrl + Enter` |
| **Open Command Palette** | `Cmd + P` | `Ctrl + P` |
| **Clear Editor** | `Cmd + K` | `Ctrl + K` |

---

## 🛠 Advanced Features

### 💻 Integrated Terminal
Truncate contains a built-in terminal that matches your current database context. You can use this to run shell commands or interact with CLI tools without leaving the IDE.

### 📊 Data Profiling & Export
- **One-Click Export**: Export your database schema to **JSON**, **Markdown**, or **Graphviz (DOT)** formats.
- **Visual Schema**: If you have `dot` (Graphviz) installed, Truncate can generate visual SVG maps of your database relationships.
- **Profiling**: Inspect column distributions and data types directly from the Explorer.

---

## 🛡 Security & Safety

- **Stateless Execution**: Each query execution is isolated.
- **Destructive Protection**: By default, Truncate blocks high-risk operations (e.g., `DROP TABLE`) unless specifically configured otherwise.
- **Local-Only AI**: Your AI processing happens entirely on your machine. No data is sent to external servers unless you explicitly configure an external API proxy.

---

## ❓ Troubleshooting

- **Connection Failed**: Ensure your database server is reachable and your firewall allows the specified port.
- **AI Not Detected**: Ensure Ollama is running (`ollama serve`) and that the `ollama` binary is in your PATH.
- **App Won't Open**: Re-run the `xattr` command mentioned in the "Getting Started" section.
