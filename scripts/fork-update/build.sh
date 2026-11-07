#!/bin/bash
# Builds the fork's macOS app, unsigned and for Apple silicon, into release/.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$HOME/.cargo/bin:$PATH"

rm -rf -- release
vp run dist:desktop:artifact --platform mac --target dir --arch arm64
