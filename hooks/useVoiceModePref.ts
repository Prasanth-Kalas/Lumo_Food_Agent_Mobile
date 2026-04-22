/**
 * Persist the "voice mode" toggle across app launches.
 *
 * Parallels the web behavior in app/page.tsx (VOICE_MODE_KEY = "lumo.voiceMode").
 * We reuse the same storage key so if we ever share state across platforms
 * (e.g. via a sync layer), the semantics already line up.
 *
 * Storage write is fire-and-forget; we don't block the UI on a disk flush.
 * Read happens once on mount, after which state lives in React.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const VOICE_MODE_KEY = "lumo.voiceMode";

export function useVoiceModePref(): {
  voiceMode: boolean;
  setVoiceMode: (next: boolean) => void;
  toggleVoiceMode: () => void;
  /** True once the initial AsyncStorage read has completed. */
  hydrated: boolean;
} {
  const [voiceMode, setVoiceModeState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Guard against the hydrate-effect racing with a user toggle that happens
  // before AsyncStorage returns. If the user flips before we load, respect them.
  const userTouchedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(VOICE_MODE_KEY);
        if (cancelled || userTouchedRef.current) return;
        if (saved === "1") setVoiceModeState(true);
      } catch {
        // AsyncStorage can fail on first install or corrupted state — fall
        // back to the default (off) silently. Not worth a toast.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: boolean) => {
    AsyncStorage.setItem(VOICE_MODE_KEY, next ? "1" : "0").catch(() => {
      // Swallow — we can't meaningfully recover, and the in-memory value
      // is already correct for this session.
    });
  }, []);

  const setVoiceMode = useCallback(
    (next: boolean) => {
      userTouchedRef.current = true;
      setVoiceModeState(next);
      persist(next);
    },
    [persist]
  );

  const toggleVoiceMode = useCallback(() => {
    userTouchedRef.current = true;
    setVoiceModeState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return { voiceMode, setVoiceMode, toggleVoiceMode, hydrated };
}
