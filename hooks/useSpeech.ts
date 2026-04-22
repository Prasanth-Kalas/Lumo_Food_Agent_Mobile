/**
 * Neural TTS for mobile — streams MP3 from /api/tts (OpenAI
 * gpt-4o-mini-tts) via expo-av's native player.
 *
 * Why expo-av's Audio.Sound over expo-speech:
 *   - expo-speech uses the system TTS (Siri on iOS, Google on Android),
 *     which sounds like a GPS unit from 2014. gpt-4o-mini-tts sounds
 *     like a person.
 *   - Audio.Sound accepts a URI and progressively streams MP3 via the
 *     platform native player (AVPlayer / ExoPlayer), so time-to-first-
 *     audio stays sub-second without us building a streaming decoder.
 *
 * Why GET on /api/tts instead of POST:
 *   - Audio.Sound.createAsync only takes a URI. It can't POST a body.
 *     We added a GET handler server-side that accepts text as a query
 *     string. Keeps the mobile path dead simple.
 *
 * Barge-in: silence() unloads the current sound. The next start() call
 * does the same before loading, so a rapid tap can cut Lumo mid-word.
 *
 * Graceful degradation: any failure (network, bad upstream, unloadable
 * audio) falls back silently. Text is still in the chat — the user
 * just doesn't hear the reply this turn.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { getApiBaseUrl } from "@/lib/api";

// Same shape as the web's /api/tts payload — keep sanitization symmetric.
// The server does the heavy stripping too (lib/tts-sanitize); this is
// just a cheap pre-pass so we don't pay round-trip for empty text.
function looksSpeakable(text: string): boolean {
  return !!text && text.trim().length > 0;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  // Monotonic generation counter: each speak() bumps it. If a stale
  // status callback fires for an old sound (e.g. unload race), we can
  // recognize and drop it.
  const genRef = useRef(0);

  // Configure iOS/Android audio mode once: play in silent mode (iOS
  // ringer switch off shouldn't mute agent replies) and duck other
  // audio so a user's music lowers while Lumo talks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        // Audio mode is a nice-to-have; if it fails we still try to play.
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
      // Make sure we don't leave a phantom player attached on unmount.
      void unloadCurrent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unloadCurrent = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
  }, []);

  const silence = useCallback(() => {
    // Bump the generation so any pending status callbacks on the old
    // sound know they're stale and shouldn't flip isSpeaking back on.
    genRef.current += 1;
    setIsSpeaking(false);
    void unloadCurrent();
  }, [unloadCurrent]);

  const speak = useCallback(
    async (text: string) => {
      if (!looksSpeakable(text)) return;

      // Barge-in on ourselves: kill anything in flight before starting.
      genRef.current += 1;
      const myGen = genRef.current;
      await unloadCurrent();

      // CRITICAL: reassert playback audio mode before every speak().
      // expo-speech-recognition flips the iOS AVAudioSession category to
      // .playAndRecord / .record when the user dictates, and doesn't flip
      // it back when STT stops. If we don't force allowsRecordingIOS: false
      // here, the MP3 routes to the ear speaker (or gets suppressed
      // entirely), which reads as "I can't hear the agent after I speak."
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        // Non-fatal — we still attempt to play.
      }

      let baseUrl: string;
      try {
        baseUrl = getApiBaseUrl();
      } catch (err) {
        console.warn("[tts] no API base URL configured", err);
        return;
      }

      const url =
        `${baseUrl}/api/tts` +
        `?text=${encodeURIComponent(text.slice(0, 4000))}`;

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 },
          (status) => {
            // Drop callbacks from a previous generation.
            if (myGen !== genRef.current) return;
            if (!status.isLoaded) {
              // Loading error path — e.g. 503 if OPENAI_API_KEY missing.
              const errored = (status as { error?: string }).error;
              if (errored) console.warn("[tts] load error", errored);
              setIsSpeaking(false);
              return;
            }
            if (status.didJustFinish) {
              setIsSpeaking(false);
              void unloadCurrent();
            }
          }
        );

        // Another speak() may have raced in and bumped the generation
        // while the fetch was in flight. If so, ditch this sound.
        if (myGen !== genRef.current) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }

        soundRef.current = sound;
        setIsSpeaking(true);
      } catch (err) {
        console.warn("[tts] createAsync failed", err);
        setIsSpeaking(false);
      }
    },
    [unloadCurrent]
  );

  return { isSpeaking, speak, silence };
}
