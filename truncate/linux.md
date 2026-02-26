# Truncate IDE - Linux Setup Guide

This guide details how to set up and run Truncate IDE on Linux.

## System Dependencies

Truncate IDE uses Tauri v2, which requires WebKit2GTK and other development tools.

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### Arch Linux
```bash
sudo pacman -Syu
sudo pacman -S webkit2gtk \
    base-devel \
    curl \
    wget \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg
```

### Fedora
```bash
sudo dnf check-update
sudo dnf install webkit2gtk3-devel.x86_64 \
    openssl-devel \
    curl \
    wget \
    perl-FindBin \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

## Binary Dependencies

Truncate IDE relies on external binaries for certain features. **You must manually provide these for Linux.**

### 1. Graphviz (dot)

Required for database schema visualization.

1.  Download a precompiled `dot` binary for Linux (static build recommended) or build it yourself.
    -   *Option A (Easy)*: If you have `graphviz` installed (`sudo apt install graphviz`), you can try copying the system binary, but a static portable binary is safer for distribution.
2.  Rename the binary to: `dot-unknown-linux-gnu`
3.  Place it in:
    ```
    src-tauri/bin/dot-unknown-linux-gnu
    ```

### 2. Ollama (AI Copilot)

Required for the AI coding assistant.

1.  Download the Linux binary from [ollama.com](https://ollama.com/download/linux).
2.  Rename the binary to: `ollama-unknown-linux-gnu`
3.  Place it in:
    ```
    src-tauri/binaries/ollama-unknown-linux-gnu
    ```

## Running the App

Once dependencies are installed and binaries are placed:

1.  **Install NPM packages**:
    ```bash
    npm install
    ```

2.  **Run in Development Mode**:
    ```bash
    npm run tauri dev
    ```

3.  **Build for Production**:
    ```bash
    npm run tauri build
    ```
    The `.deb` or `.AppImage` will be in `src-tauri/target/release/bundle/`.
