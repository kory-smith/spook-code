#!/bin/bash
# Builds the fork's macOS app for Apple silicon into release/, then signs it with the fork's
# self-signed certificate (see sign.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$HOME/.cargo/bin:$PATH"

rm -rf -- release
vp run dist:desktop:artifact --platform mac --target dir --arch arm64
scripts/fork-update/sign.sh
