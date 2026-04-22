#!/usr/bin/env bash
#
# Lumo mobile bootstrap — run once from your Mac.
#
# What this does:
#   1. Refuses to run unless prerequisites are satisfied.
#   2. Scaffolds .env from .env.example if it doesn't exist.
#   3. Prompts you for the Stripe publishable key (or detects it from
#      the sibling web folder's .env.local if present).
#   4. npm install.
#   5. expo prebuild --clean (generates ios/ and android/ with the
#      Stripe config plugin applied and CocoaPods installed).
#   6. Leaves you one command away from launching the app.
#
# Usage:
#   bash bootstrap-mobile.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

say() { printf "\n\033[1;34m▶\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;33m!\033[0m %s\n" "$*"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------- prereqs ----
say "Checking prerequisites"

if [[ "$(uname -s)" != "Darwin" ]]; then
  die "Must run on macOS (this builds for iOS)."
fi

command -v node >/dev/null || die "node not installed. brew install node@20"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
(( NODE_MAJOR >= 18 )) || die "node 18.18+ required; found $(node -v)"
ok "node $(node -v)"

command -v npm >/dev/null || die "npm not installed."
ok "npm $(npm -v)"

if command -v xcodebuild >/dev/null; then
  ok "Xcode $(xcodebuild -version | head -1 | awk '{print $2}')"
else
  warn "Xcode CLI not found. iOS build will fail until you install Xcode + 'sudo xcodebuild -license accept'."
fi

if command -v pod >/dev/null; then
  ok "CocoaPods $(pod --version)"
else
  warn "CocoaPods not found. Install: sudo gem install cocoapods"
fi

# ----------------------------------------------------------------- .env -----
say "Setting up .env"

if [[ ! -f .env ]]; then
  cp .env.example .env
  ok "Created .env from .env.example"
else
  ok ".env already exists"
fi

# Try to pull the web .env.local's Stripe publishable key if present
WEB_ENV="../lumo-food-agent/.env.local"
if [[ -f "$WEB_ENV" ]]; then
  WEB_KEY=$(grep -E '^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=' "$WEB_ENV" | head -1 | cut -d= -f2- || true)
  if [[ -n "${WEB_KEY:-}" && "$WEB_KEY" != "pk_test_your_key_here" ]]; then
    # Replace the mobile key if it's still the placeholder
    if grep -q 'pk_test_your_key_here' .env; then
      # BSD sed on macOS needs an empty -i arg
      sed -i '' "s|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*|EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$WEB_KEY|" .env
      ok "Copied Stripe publishable key from the web .env.local"
    else
      ok "Stripe publishable key already set in mobile .env"
    fi
  fi
fi

# Check if user still has the placeholder
if grep -q 'pk_test_your_key_here' .env; then
  warn "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is still the placeholder."
  echo "   Open .env and paste your pk_test_... from https://dashboard.stripe.com/test/apikeys"
  echo "   The secret key (sk_test_...) must be on Vercel as STRIPE_SECRET_KEY for the backend."
  read -r -p "   Paste the publishable key now (or press Enter to skip): " USER_KEY
  if [[ -n "$USER_KEY" ]]; then
    sed -i '' "s|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*|EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$USER_KEY|" .env
    ok "Saved publishable key to .env"
  else
    warn "Skipped. The app will show a 'Stripe publishable key missing' card at checkout until you fill this in."
  fi
fi

# ------------------------------------------------------------- npm install --
say "Installing npm dependencies"
npm install --no-audit --no-fund
ok "npm install complete"

# ------------------------------------------------------------- prebuild ----
say "Running expo prebuild (iOS + Android native projects)"
warn "This generates ios/ and android/ folders and runs pod install. Takes ~3-5 min first time."
npx expo prebuild --clean
ok "Prebuild complete"

# ---------------------------------------------------------------- ready ----
say "Ready to run"

cat <<'EOF'

Next steps — pick ONE:

  iOS Simulator:
    npx expo run:ios

  iOS on a connected iPhone:
    npx expo run:ios --device

  Android emulator / connected device:
    npx expo run:android

After the app opens, type "pizza for dinner" (or any food order), confirm
the cart, and tap the Pay button. Use test card:

    4242 4242 4242 4242   any future date   any CVC   any ZIP

You should see the PaymentIntent appear in your Stripe dashboard at:
    https://dashboard.stripe.com/test/payments

Troubleshooting:
  - "No such module 'Stripe'"  → rerun: npx expo prebuild --clean
  - PaymentSheet errors "Invalid API key" → EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
    mismatch with backend. Check .env and Vercel env.
  - Agent shows "Paying on delivery" → backend is in demo mode; set
    STRIPE_SECRET_KEY on Vercel and redeploy.

EOF
