#!/usr/bin/env bash
#
# rebuild-ios.sh — clean rebuild for local iOS device builds.
#
# Idempotent sequence that:
#   1) Wipes native projects + Xcode DerivedData for this app (so no stale
#      headers or object files from a previous failed build bleed through).
#   2) Runs `expo prebuild --clean` so our local config plugin
#      (plugins/withPodfileTweaks.js) runs and patches the fmt pod headers
#      to dodge Xcode 26's stricter consteval enforcement.
#   3) Sanity-checks the patch actually landed before spending 5+ minutes
#      on a compile that we already know will fail.
#   4) Kicks off `expo run:ios --device`.
#
# Usage:
#   ./scripts/rebuild-ios.sh            # full clean rebuild
#   ./scripts/rebuild-ios.sh --no-wipe  # skip nuke+prebuild; build only
#
# If the patch sanity check fails, the script exits before calling xcodebuild
# and prints the offending file so you can inspect the plugin output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "==> Project: $PROJECT_DIR"

# --- 1. Wipe ---------------------------------------------------------------
if [[ "${1:-}" != "--no-wipe" ]]; then
  echo "==> Wiping ios/, android/, and Lumo DerivedData"
  rm -rf ios android
  # DerivedData dir is per-scheme; glob catches Lumo-<hash> variants.
  rm -rf ~/Library/Developer/Xcode/DerivedData/Lumo-* 2>/dev/null || true

  # --- 2. Prebuild -------------------------------------------------------
  echo "==> Running expo prebuild --clean"
  npx expo prebuild --clean
fi

# --- 3. Sanity-check the fmt patch ----------------------------------------
FMT_BASE="ios/Pods/fmt/include/fmt/base.h"
if [[ ! -f "$FMT_BASE" ]]; then
  echo "!! $FMT_BASE not found — did pod install run?"
  exit 1
fi

# After the plugin runs, the unpatched line should be GONE and the Lumo
# sentinel should be present. If not, abort loudly.
if grep -q '^#  *define FMT_CONSTEVAL consteval\b' "$FMT_BASE"; then
  echo "!! fmt consteval macro is still ACTIVE in $FMT_BASE — plugin did not run."
  echo "   Check ios/Podfile for '# LUMO_PODFILE_TWEAKS_v4'. If missing,"
  echo "   delete ios/ and re-run 'npx expo prebuild --clean'."
  exit 1
fi

if ! grep -q 'Lumo: neutralized for Xcode 26' "$FMT_BASE"; then
  echo "!! fmt header doesn't show the Lumo neutralization marker."
  echo "   Expected patched macro in $FMT_BASE."
  exit 1
fi

echo "==> fmt patch confirmed in $FMT_BASE"

# --- 4. Build --------------------------------------------------------------
echo "==> Running expo run:ios --device"
exec npx expo run:ios --device
