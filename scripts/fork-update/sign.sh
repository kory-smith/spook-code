#!/bin/bash
# Signs the fork's built app (release/ by default, or the .app given) with a self-signed
# certificate in the login keychain. macOS ties privacy grants such as Local Network access and
# keychain approvals to the signing identity; an unsigned build gets a fresh ad-hoc identity every
# time, so those grants never match. A stable certificate keeps them across fork updates.
# The first run creates the certificate, and macOS asks for your password to trust it.
set -euo pipefail
cd "$(dirname "$0")/../.."
identity="Spook Code Signing"
keychain="$HOME/Library/Keychains/login.keychain-db"

has_identity() {
  security find-identity -v -p codesigning "$keychain" | grep -qF "\"$identity\""
}

create_identity() {
  local password
  dir="$(mktemp -d)"
  trap 'rm -rf -- "$dir"' EXIT
  password="$(uuidgen)"
  cat >"$dir/openssl.cnf" <<EOF
[req]
distinguished_name = dn
prompt = no
x509_extensions = ext
[dn]
CN = $identity
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
EOF
  # macOS's own LibreSSL writes a PKCS#12 that `security import` can read; Homebrew's OpenSSL does not.
  /usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 7300 -config "$dir/openssl.cnf" \
    -keyout "$dir/key.pem" -out "$dir/cert.pem" 2>/dev/null
  /usr/bin/openssl pkcs12 -export -inkey "$dir/key.pem" -in "$dir/cert.pem" \
    -out "$dir/identity.p12" -passout "pass:$password"
  security import "$dir/identity.p12" -k "$keychain" -P "$password" -T /usr/bin/codesign >/dev/null
  echo "Trusting \"$identity\" for code signing; macOS will ask for your password…"
  security add-trusted-cert -r trustRoot -p codeSign -k "$keychain" "$dir/cert.pem"
}

app="${1:-$(find release -maxdepth 2 -name '*.app' -print -quit)}"
if [[ -z "$app" || ! -d "$app" ]]; then
  echo "No app to sign; run build.sh first or pass an .app path." >&2
  exit 1
fi

if ! has_identity; then
  echo "Creating the \"$identity\" certificate in your login keychain…"
  create_identity
  has_identity || { echo "\"$identity\" is still not a valid signing identity." >&2; exit 1; }
fi

# Give the app's and helpers' executables UUIDs of their own (see set-macho-uuid.py), seeded by
# bundle ID and path so they stay the same from build to build.
bundle_id="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Contents/Info.plist")"
for executable in "$app"/Contents/MacOS/* "$app"/Contents/Frameworks/*.app/Contents/MacOS/*; do
  python3 scripts/fork-update/set-macho-uuid.py "$executable" "$bundle_id/${executable#"$app"/}"
done

# codesign seals each bundle over its already-signed contents, so sign inside out: loose Mach-O
# files, then bundles deepest first, which ends with the app itself.
while IFS= read -r -d '' file; do
  if [[ "$(file -b "$file")" == Mach-O* ]]; then
    codesign --force --sign "$identity" "$file"
  fi
done < <(find "$app/Contents" -type f \( -perm -u+x -o -name '*.dylib' -o -name '*.node' -o -name '*.so' \) -print0)

while IFS= read -r -d '' bundle; do
  codesign --force --sign "$identity" "$bundle"
done < <(find "$app" -depth -type d \( -name '*.app' -o -name '*.framework' \) -print0)

codesign --verify --deep --strict "$app"
echo "Signed $(basename "$app") as \"$identity\"."
