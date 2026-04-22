/**
 * Speech-to-text hook for mobile, powered by expo-speech-recognition.
 *
 * Mirrors the shape of the web `useVoice` STT surface:
 *   - support.stt: whether the device+OS can transcribe
 *   - isListening: active STT session
 *   - interim: the in-flight partial transcript (for live display)
 *   - start(): begin listening; requests permissions on first run
 *   - stop(): stop listening early (the final event will still fire)
 *
 * Barge-in is the caller's responsibility — call stopTTS() before start().
 *
 * IMPORTANT: this module imports a native module via expo-speech-recognition.
 * It requires an EAS Build (dev client or preview/production). It will NOT
 * work inside Expo Go because Expo Go doesn't ship the native bits.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export interface UseSpeechRecognitionOpts {
  /** Fires once when the engine commits a final transcript. */
  onFinalTranscript?: (text: string) => void;
  /** Fires on every interim partial — lightweight, many per second. */
  onInterimTranscript?: (text: string) => void;
  /** Fires on permission denial or engine error. */
  onError?: (message: string) => void;
}

export function useSpeechRecognition(opts: UseSpeechRecognitionOpts = {}) {
  // Pin opts in a ref so we never tear down the listener on re-render.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  // Cache support detection — synchronous, safe to call once.
  const supportRef = useRef(
    // Only iOS + Android ship the native module; web falls back to useVoice.
    typeof ExpoSpeechRecognitionModule?.isRecognitionAvailable === "function"
      ? ExpoSpeechRecognitionModule.isRecognitionAvailable()
      : false
  );

  // ---- Engine event wiring -------------------------------------------------

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setInterim("");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    // Don't clear interim here — the `result` with isFinal handles promotion.
  });

  useSpeechRecognitionEvent("result", (ev) => {
    const transcript = ev.results?.[0]?.transcript ?? "";
    if (!transcript) return;
    if (ev.isFinal) {
      setInterim("");
      optsRef.current.onFinalTranscript?.(transcript);
    } else {
      setInterim(transcript);
      optsRef.current.onInterimTranscript?.(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (ev) => {
    // Common codes: "not-allowed" (permission denied), "network", "no-speech".
    // Fail soft — the caller can decide whether to surface a toast.
    setIsListening(false);
    optsRef.current.onError?.(`${ev.error}: ${ev.message ?? ""}`);
  });

  // ---- Public controls -----------------------------------------------------

  const start = useCallback(async () => {
    if (!supportRef.current) {
      optsRef.current.onError?.("Speech recognition isn't available on this device.");
      return;
    }

    // Request mic + speech recognition permissions. First call triggers the
    // native dialog; subsequent calls return the cached decision.
    const perm =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      optsRef.current.onError?.(
        "Microphone or speech recognition permission was denied."
      );
      return;
    }

    // On-device when possible (iOS 13+, Android w/ Google services).
    // interimResults: stream partials so the composer can show typing-style feedback.
    // continuous: false — one utterance per tap; caller can restart for more.
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });
  }, []);

  const stop = useCallback(() => {
    // stop() lets the engine finish and emit a final result. abort() would
    // cut immediately — we prefer the gentle path.
    ExpoSpeechRecognitionModule.stop();
  }, []);

  // Safety net: if the component unmounts mid-listen, don't leak the session.
  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Module may already be idle — ignore.
      }
    };
  }, []);

  return {
    support: { stt: supportRef.current },
    isListening,
    interim,
    start,
    stop,
  };
}
