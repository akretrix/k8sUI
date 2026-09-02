#!/usr/bin/env bash
# ==============================================================================
# k9sUI Release Helper Script
# Synchronously updates versions across package.json, Cargo.toml, and tauri.conf.json,
# ensures DCO sign-off, and tags the release.
# ==============================================================================

set -euo pipefail

BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

echo "==> Verifying working tree is clean..."
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working directory has uncommitted changes. Stash or commit first."
  exit 1
fi

echo "==> Running security checks and build verification..."
npm run build

echo "==> Bumping version ($BUMP_TYPE)..."
npm version "$BUMP_TYPE" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v$NEW_VERSION"

echo "==> Syncing Cargo.toml to $NEW_VERSION..."
sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

echo "==> Syncing tauri.conf.json to $NEW_VERSION..."
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json'));
  conf.version = '$NEW_VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

echo "==> Committing with DCO Signed-off-by..."
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json package-lock.json 2>/dev/null || true
git commit -s -m "chore(release): prepare $TAG_NAME"

echo "==> Creating Git tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release $TAG_NAME"

echo "================================================================="
echo "✅ Release $TAG_NAME created locally with DCO compliance."
echo ""
echo "To publish and trigger the multiplatform build pipeline, run:"
echo "   git push origin main && git push origin $TAG_NAME"
echo "================================================================="
