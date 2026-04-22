import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

// Strip markdown + list dashes so the spoken version sounds natural.
function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\s]*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const speak = useCallback((text: string) => {
    const clean = cleanForSpeech(text);
    if (!clean) return;
    // Always stop whatever's in flight — we don't queue.
    Speech.stop();
    speakingRef.current = true;
    setIsSpeaking(true);
    Speech.speak(clean, {
      language: "en-US",
      rate: 1.05,
      pitch: 1.0,
      onDone: () => {
        speakingRef.current = false;
        setIsSpeaking(false);
      },
      onStopped: () => {
        speakingRef.current = false;
        setIsSpeaking(false);
      },
      onError: () => {
        speakingRef.current = false;
        setIsSpeaking(false);
      },
    });
  }, []);

  const silence = useCallback(() => {
    Speech.stop();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount: don't leave a phantom voice reading the last message
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return { isSpeaking, speak, silence };
}
