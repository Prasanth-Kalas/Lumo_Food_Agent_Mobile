# Lumo Mobile (Expo)

Native iOS + Android client for Lumo, built with Expo SDK 52 + React Native 0.76
(New Architecture on). Talks to the same `/api/chat` endpoint as the web app
(`../lumo-food-agent`), so the agent lives in one place.

---

## What's here

```
lumo-food-agent-mobile/
├── app/
│   ├── _layout.tsx          # Root stack (expo-router), SafeAreaProvider
│   └── index.tsx            # Chat screen (header, messages, composer)
├── components/
│   ├── MessageBubble.tsx
│   ├── ToolResultRenderer.tsx   # Same 8 tool kinds, native cards
│   ├── TypingIndicator.tsx
│   └── SuggestionRow.tsx
├── hooks/
│   ├── useLumoChat.ts          # Local stream parser, no ai/react dependency
│   ├── useSpeech.ts            # expo-speech TTS wrapper (Lumo speaks back)
│   ├── useSpeechRecognition.ts # expo-speech-recognition STT wrapper
│   └── useVoiceModePref.ts     # AsyncStorage-backed voice-mode toggle
├── lib/
│   ├── api.ts               # streamChat() — parses the Vercel AI SDK data stream
│   ├── types.ts             # Domain types (mirror of backend)
│   ├── colors.ts            # Brand palette (mirrors tailwind.config.ts)
│   └── format.ts            # formatPrice / formatEta
├── app.json                 # Expo config (bundle ids, splash, icons, plugins)
├── eas.json                 # EAS build profiles: development / preview / production
├── babel.config.js
├── tsconfig.json
└── .env.example
```

---

## Run it locally

Prereqs: Node 18.18+, Xcode (for iOS simulator) or Android Studio (for Android
emulator), and the Expo Go app on your phone if you want to scan the QR.

```bash
cd lumo-food-agent-mobile
npm install
cp .env.example .env
# edit .env: point EXPO_PUBLIC_API_BASE_URL at a reachable backend
#   - deployed Vercel URL works from anywhere
#   - local Next.js dev server works if you use your laptop's LAN IP
npx expo start
```

Press `i` for iOS simulator, `a` for Android, or scan the QR from Expo Go.

> **Heads up on Expo Go:** voice input (STT) relies on `expo-speech-recognition`,
> which is a native module that ships only in a dev client or EAS build. In
> Expo Go the mic button detects the missing module and stays inert — the rest
> of the app (chat, TTS, tool cards) works fine. For real voice testing, use
> `npx expo prebuild && npx expo run:ios` locally, or ship a preview EAS build.

### Pointing at the local Next.js server

If you're running `npm run dev` in `../lumo-food-agent` and testing on a real
phone, the phone can't reach `localhost`. Use your laptop's LAN IP:

```bash
# On macOS:
ipconfig getifaddr en0
# e.g. 192.168.1.42
```

Then set `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000` in `.env` and
restart `npx expo start`.

---

## Assets you need to drop in

Before `eas build` will succeed, create `assets/` with:

- `icon.png` — 1024×1024, flat (no rounded corners, Apple adds them)
- `adaptive-icon.png` — 1024×1024 foreground, will be masked by Android
- `splash.png` — 1284×2778 (or any aspect; `resizeMode: "contain"` handles it)
- `favicon.png` — 48×48 for the web bundle (optional)

Quick path: take `../lumo-food-agent/public/icon.svg`, render it to PNG at
1024×1024 with a `#4361ee` background via any SVG-to-PNG tool.

---

## Shipping to testers (the 50 friends)

We use EAS internal distribution — no App Store review, builds are installable
via a link.

### One-time setup

```bash
npm install -g eas-cli
eas login
eas init        # this fills in the projectId in app.json
```

### iOS (TestFlight-style internal distribution)

```bash
eas build --profile preview --platform ios
```

EAS walks you through signing. On first run, let it manage certificates for
you (answer "yes" to everything). When the build finishes, EAS gives you a
link — testers install via TestFlight (you'll add their Apple IDs in App
Store Connect under **Users and Access → TestFlight**).

For true no-App-Store-Connect distribution (ad hoc), add `"ios": {
"enterpriseProvisioning": "adhoc" }` under the preview profile and register
each tester's UDID with `eas device:create`.

### Android (.apk direct install)

```bash
eas build --profile preview --platform android
```

The preview profile is already configured to produce an **.apk** (not an
`.aab`), so testers can install directly from the download link. No Play
Store review needed.

Share the resulting link in a Slack channel or text thread. Testers just tap
it on their phone.

### Over-the-air updates (EAS Update)

Once you're shipping fixes faster than EAS can rebuild:

```bash
eas update:configure
eas update --branch preview --message "fix cart confirm button"
```

The installed app pulls the JS bundle on next cold start — no re-install.

---

## What lives where (vs. the web app)

- **Agent brain** — only in `../lumo-food-agent/lib/system-prompt.ts` and
  `lib/tools.ts`. Never duplicate here.
- **Types** — `lib/types.ts` is a manual mirror of the backend's types. Keep
  them in sync; when the backend adds a new tool result `kind`, add it here
  and extend `ToolResultRenderer.tsx`.
- **Brand colors** — `lib/colors.ts` mirrors the Tailwind palette. Same
  values in both places.
- **Stream parser** — `lib/api.ts` parses the Vercel AI SDK data stream
  protocol manually (no `ai/react` on RN). If the backend upgrades its AI
  SDK major version and changes the protocol, update `handleChunk()` there.

---

## Known limitations (MVP scope)

- No persistent auth — the backend pins everything to session `"demo"` for now.
- No push notifications — ETA updates arrive only while the app is open. Add
  `expo-notifications` + the Apple Push/FCM wiring for v0.2.
- **Device voice** — fully wired in **EAS / dev-client builds**, inert in Expo
  Go. TTS uses `expo-speech`; STT uses `expo-speech-recognition` (config plugin
  already registered in `app.json`, with mic + speech-recognition permission
  strings). The Voice toggle in the header is persisted across launches via
  `AsyncStorage` (key `lumo.voiceMode`, same semantics as the web app). To
  enable STT locally: `npx expo prebuild && npx expo run:ios` (or `:android`).
- Order history now persists in Postgres when `DATABASE_URL` is set on the
  backend (Sprint B). Falls back to in-memory Maps in local dev without env.

---

## Troubleshooting

- **`EXPO_PUBLIC_API_BASE_URL is not set`** — copy `.env.example` to `.env`,
  fill it in, and restart `npx expo start` (it only reads env at startup).
- **"Network request failed" on iOS simulator** — make sure your URL uses
  `https://` if pointing to Vercel; local `http://` URLs need an ATS
  exception, but Expo's default Info.plist permits arbitrary loads in dev.
- **Tool result cards don't render** — check the Metro logs for the
  `handleChunk` path. The Vercel AI SDK's data stream protocol codes (`0`, `9`,
  `a`, `d`, `e`) are what we parse; if you see unknown codes, the SDK has
  probably upgraded.

---

© Lumo Technologies, Inc.
