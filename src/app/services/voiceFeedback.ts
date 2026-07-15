import { AccessibilityInfo } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { BACKEND_ENDPOINTS, getBackendErrorMessage } from "./backendConfig";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

let backendTtsPlayer: AudioPlayer | null = null;
let backendTtsRequestVersion = 0;
type QueueItem = {
  text: string;
  resolve: () => void;
};

const speechQueue: QueueItem[] = [];
let isSpeaking = false;

export type VoiceSpeaker = (message: string) => Promise<void>;

const clearBackendTtsPlayer = () => {
  backendTtsPlayer?.remove();
  backendTtsPlayer = null;
};

export function clearSpeechQueue() {
  speechQueue.forEach(item => item.resolve());
  speechQueue.length = 0;
  isSpeaking = false;
  clearBackendTtsPlayer();
  void Speech.stop().catch(() => undefined);
}

const ttsCache = new Map<string, string>();

function getMessageHash(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function cleanPronunciation(message: string): string {
  let cleaned = message;
  // Spell out acronyms for perfect TTS pronunciation
  cleaned = cleaned.replace(/\bAAUA\b/gi, "A A U A");
  cleaned = cleaned.replace(/\bETF\s*750\b/gi, "E T F seven fifty");
  cleaned = cleaned.replace(/\bETF\b/gi, "E T F");
  cleaned = cleaned.replace(/\bOBJ\b/gi, "O B J");
  cleaned = cleaned.replace(/\bLT\s*A\b/gi, "L T A");
  cleaned = cleaned.replace(/\bLT\b/gi, "L T");
  cleaned = cleaned.replace(/\bRC\b/gi, "R C");
  return cleaned;
}

export async function prefetchAudio(message: string): Promise<void> {
  const text = cleanPronunciation(message.trim());
  if (!text || !BACKEND_ENDPOINTS.ttsUrl) {
    return;
  }

  const key = getMessageHash(text);
  if (ttsCache.has(text)) {
    return;
  }

  try {
    const response = await expoFetch(BACKEND_ENDPOINTS.ttsUrl, {
      method: "POST",
      headers: {
        Accept: "audio/wav",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice: "af_bella"
      }),
    });

    if (response.ok) {
      const bytes = await response.bytes();
      const file = new File(Paths.cache, "campus-voice", `tts-cache-${key}.wav`);
      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);
      ttsCache.set(text, file.uri);
    }
  } catch (e) {
    console.warn("Failed to prefetch TTS:", e);
  }
}

async function playBackendTts(message: string): Promise<boolean> {
  if (!BACKEND_ENDPOINTS.ttsUrl) {
    return false;
  }

  const currentRequestVersion = ++backendTtsRequestVersion;
  await Speech.stop().catch(() => undefined);

  let fileUri = ttsCache.get(message);

  if (!fileUri) {
    const response = await expoFetch(BACKEND_ENDPOINTS.ttsUrl, {
      method: "POST",
      headers: {
        Accept: "audio/wav",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
        voice: "af_bella"
      }),
    });

    if (!response.ok) {
      const backendErrorMessage = await getBackendErrorMessage(
        response,
        `Text-to-speech request failed (${response.status})`,
      );
      throw new Error(backendErrorMessage);
    }

    const bytes = await response.bytes();

    if (currentRequestVersion !== backendTtsRequestVersion) {
      return true;
    }

    const file = new File(Paths.cache, "campus-voice", "tts-latest.wav");
    file.create({ intermediates: true, overwrite: true });
    file.write(bytes);
    fileUri = file.uri;
  }

  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: "doNotMix",
  });

  clearBackendTtsPlayer();
  const player = createAudioPlayer({ uri: fileUri });
  backendTtsPlayer = player;
  player.play();

  const words = message.trim().split(/\s+/).filter(Boolean).length;
  const estimatedMs = Math.min(12000, Math.max(900, Math.round((words / 2.8) * 1000) + 400));
  await wait(estimatedMs);

  return true;
}

async function speakWithDeviceTts(message: string) {
  await Speech.stop().catch(() => undefined);

  await new Promise<void>((resolve, reject) => {
    Speech.speak(message, {
      rate: 0.95,
      pitch: 1.0,
      useApplicationAudioSession: true,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) => reject(error),
    });
  }).catch(() => {
    AccessibilityInfo.announceForAccessibility(message);
  });
}

const defaultSpeaker: VoiceSpeaker = async (message: string) => {
  clearBackendTtsPlayer();

  try {
    const playedFromBackend = await playBackendTts(message);
    if (playedFromBackend) {
      return;
    }
  } catch {
    // noop: fallback to device TTS below
  }

  await speakWithDeviceTts(message);
};

let activeSpeaker: VoiceSpeaker = defaultSpeaker;

export function setVoiceSpeaker(speaker: VoiceSpeaker | null) {
  activeSpeaker = speaker ?? defaultSpeaker;
}

async function processQueue() {
  if (isSpeaking || speechQueue.length === 0) {
    return;
  }

  isSpeaking = true;
  const nextItem = speechQueue.shift();
  if (nextItem) {
    try {
      await activeSpeaker(nextItem.text);
    } catch (err) {
      console.warn("Speech queue playback error:", err);
    } finally {
      nextItem.resolve();
    }
  }

  isSpeaking = false;
  // Process the next item in the queue
  void processQueue();
}

export async function speakToUser(message: string): Promise<void> {
  const text = cleanPronunciation(message.trim());
  if (!text) {
    return;
  }

  return new Promise<void>((resolve) => {
    speechQueue.push({ text, resolve });
    void processQueue();
  });
}
