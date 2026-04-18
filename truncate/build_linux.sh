#!/bin/bash
set -e

# 1. Install System Dependencies
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsquashfs-dev

# 2. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# 3. Build Frontend
npm install
npm run build

# 4. Build Tauri (Bundles .deb and .AppImage)
npm run tauri build
