// client/hooks/useSpeechSynthesis.ts
// React hook wrapping the browser SpeechSynthesis API for the AI Voice
// Explanation feature. Loads available voices on mount and on the
// `voiceschanged` event, cancels any in-flight speech on unmount, and
// cancels before each new speak() call so only one session runs at a time.
//
// SpeechSynthesisVoice / SpeechSynthesisUtterance are DOM lib types already
// enabled by tsconfig (lib includes "dom"); no npm package is required.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechSynthesis {
  /** True when the current environment exposes window.speechSynthesis. */
  supported: boolean;
  /** Voices reported by the browser (may be empty until voiceschanged fires). */
  voices: SpeechSynthesisVoice[];
  /** Whether speech is currently active (utterance has started and not ended). */
  speaking: boolean;
  /** Whether the current utterance is paused (but not stopped). */
  paused: boolean;
  /** Begin speaking `text`. Cancels any prior speech first. */
  speak: (text: string, voiceURI?: string, rate?: number) => void;
  /** Pause the current speech. */
  pause: () => void;
  /** Resume paused speech. */
  resume: () => void;
  /** Immediately stop speech and reset playback state. */
  cancel: () => void;
  /** Stop the current speech and start it again from the beginning. */
  replay: (text: string, voiceURI?: string, rate?: number) => void;
}

function clampRate(rate: number | undefined): number {
  return Math.min(2.0, Math.max(0.5, rate ?? 1));
}

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  // Holds the currently-speaking utterance so its handlers can be replaced
  // cleanly when a new speak() cancels the previous one.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Read the browser's current voice list into state (no-op if unsupported).
  const loadVoices = useCallback(() => {
    if (!supported) return;
    const available = window.speechSynthesis.getVoices();
    if (available.length > 0) {
      setVoices(available);
    }
  }, [supported]);

  // Load voices on mount, keep listening for async population, and poll a
  // few times as a fallback for browsers where voiceschanged never fires.
  useEffect(() => {
    if (!supported) return;

    loadVoices();

    let polls = 0;
    const poll = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      } else if (polls < 3) {
        polls += 1;
        window.setTimeout(poll, 150 * polls);
      }
    };
    const initialTimer = window.setTimeout(poll, 150);

    window.speechSynthesis.onvoiceschanged = () => loadVoices();

    return () => {
      window.clearTimeout(initialTimer);
      window.speechSynthesis.onvoiceschanged = null;
      // Ensure no speech outlives the component.
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setPaused(false);
    };
  }, [supported, loadVoices]);

  const speak = useCallback(
    (text: string, voiceURI?: string, rate?: number) => {
      if (!supported) return;
      // Only one utterance at a time: cancel anything still queued/playing.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = clampRate(rate);

      if (voiceURI) {
        const match = voices.find((v) => v.voiceURI === voiceURI);
        if (match) {
          utterance.voice = match;
          utterance.lang = match.lang;
        }
      }

      utterance.onstart = () => {
        setSpeaking(true);
        setPaused(false);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setPaused(false);
      };
      utterance.onpause = () => setPaused(true);
      utterance.onresume = () => setPaused(false);
      utterance.onerror = () => {
        setSpeaking(false);
        setPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, voices]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const replay = useCallback(
    (text: string, voiceURI?: string, rate?: number) => {
      cancel();
      speak(text, voiceURI, rate);
    },
    [cancel, speak]
  );

  return {
    supported,
    voices,
    speaking,
    paused,
    speak,
    pause,
    resume,
    cancel,
    replay
  };
}
