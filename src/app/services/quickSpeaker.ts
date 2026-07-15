/**
 * Quick Speaker using Device TTS - FIXED for recording
 * 
 * Does NOT interfere with voice recording
 */

import * as Speech from "expo-speech";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

let lastAnnouncementAt = 0;
let isSpeaking = false;

/**
 * Speak text using device TTS
 * 
 * Does NOT call setAudioModeAsync()
 * Speech API manages its own audio session
 */
export async function quickSpeak(message: string): Promise<void> {
  const text = message.trim();
  if (!text) return;

  // Stop any ongoing speech
  try {
    await Speech.stop();
  } catch (e) {
    // Ignore
  }

  // Rate limit
  const now = Date.now();
  if (now - lastAnnouncementAt < 250) {
    await wait(250);
  }

  lastAnnouncementAt = Date.now();

  return new Promise<void>((resolve) => {
    try {
      if (isSpeaking) {
        Speech.stop().catch(() => {});
      }

      isSpeaking = true;
      console.log(`🔊 Speaking: ${text.substring(0, 50)}`);

      // Use Speech.speak - it manages its own audio session
      // We don't need to call setAudioModeAsync
      Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          console.log("✅ Speech done");
          isSpeaking = false;
          resolve();
        },
        onError: (error: any) => {
          console.warn("⚠️  Speech error:", error);
          isSpeaking = false;
          resolve();
        },
      });

      // Safety timeout
      const safetyTimeout = setTimeout(() => {
        if (isSpeaking) {
          console.warn("⚠️  Speech timeout, forcing resolution");
          isSpeaking = false;
          resolve();
        }
      }, 30000);
    } catch (error) {
      console.warn("quickSpeak error:", error);
      isSpeaking = false;
      resolve();
    }
  });
}

/**
 * Speak without waiting
 */
export function quickSpeakAsync(message: string): void {
  quickSpeak(message).catch((error) => {
    console.warn("quickSpeakAsync failed:", error);
  });
}

/**
 * Stop speaking immediately
 */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
    isSpeaking = false;
  } catch (error) {
    console.warn("Failed to stop speaking:", error);
  }
}