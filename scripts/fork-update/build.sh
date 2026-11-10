#!/bin/bash
# Builds the fork's macOS app for Apple silicon into release/, then signs it with the fork's
# self-signed certificate (see sign.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/share/vite-plus/bin:$HOME/.cargo/bin:$PATH"

# Upstream's release CI stamps the version at build time, so a release tag still carries the
# previous version in package.json. Stamp the newest stable release this checkout contains.
release="$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD)"
export T3CODE_DESKTOP_VERSION="${release#v}"

rm -rf -- release
vp run dist:desktop:artifact --platform mac --target dir --arch arm64
scripts/fork-update/sign.sh
