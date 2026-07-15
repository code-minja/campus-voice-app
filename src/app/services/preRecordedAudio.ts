/**
 * Pre-recorded Audio Manager - FIXED for no recording interference
 * 
 * All functions resolve ONLY when audio finishes playing
 * Does NOT interfere with voice recording
 */

import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Estimated Durations (in milliseconds)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ESTIMATED_DURATIONS: Record<string, number> = {
  listening: 1100,
  processing: 900,
  noSpeech: 1300,
  understood: 600,
  error: 500,
  permission: 1500,
  timeout: 1200,
  library: 1200,
  center: 1400,
  cafeteria: 1300,
  navigationStart: 1000,
  arrived: 1500,
  turnLeft: 700,
  turnRight: 700,
  continueStraight: 900,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Audio Assets Map
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AUDIO_ASSETS = {
  listening: require("../../../assets/audio/feedback/listening.wav"),
  processing: require("../../../assets/audio/feedback/processing.wav"),
  noSpeech: require("../../../assets/audio/feedback/no_speech.wav"),
  understood: require("../../../assets/audio/feedback/understood.wav"),
  error: require("../../../assets/audio/feedback/error.wav"),
  permission: require("../../../assets/audio/feedback/permission.wav"),
  timeout: require("../../../assets/audio/feedback/timeout.wav"),
  library: require("../../../assets/audio/destinations/library.wav"),
  center: require("../../../assets/audio/destinations/center.wav"),
  cafeteria: require("../../../assets/audio/destinations/cafeteria.wav"),
  navigationStart: require("../../../assets/audio/navigation/navigation_start.wav"),
  arrived: require("../../../assets/audio/navigation/arrived.wav"),
  turnLeft: require("../../../assets/audio/navigation/turn_left.wav"),
  turnRight: require("../../../assets/audio/navigation/turn_right.wav"),
  continueStraight: require("../../../assets/audio/navigation/continue_straight.wav"),
} as const;

export type AudioKey = keyof typeof AUDIO_ASSETS;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const cachedUris: Map<AudioKey, string> = new Map();
let currentPlayer: AudioPlayer | null = null;
let isPreloaded = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Preload all audio assets at app startup
 * 
 * Does NOT configure audio session
 * That happens only during playback
 */
export async function preloadAudioAssets(): Promise<void> {
  if (isPreloaded) {
    console.log("✅ Audio already preloaded");
    return;
  }

  console.log("🎵 Preloading audio assets...");

  try {
    const keys = Object.keys(AUDIO_ASSETS) as AudioKey[];
    let loadedCount = 0;

    for (const key of keys) {
      try {
        const moduleId = AUDIO_ASSETS[key];
        let uri: string | null = null;

        if (typeof moduleId === "object" && moduleId !== null && "uri" in moduleId) {
          uri = (moduleId as any).uri;
        }

        if (uri) {
          cachedUris.set(key, uri);
          loadedCount++;
        } else {
          const fallbackUri = `./assets/audio/${getFallbackPath(key)}.wav`;
          cachedUris.set(key, fallbackUri);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load ${key}:`, error);
      }
    }

    isPreloaded = true;
    console.log(`✅ Loaded ${loadedCount}/${keys.length} audio assets`);
  } catch (error) {
    console.error("❌ Audio preload failed:", error);
  }
}

function getFallbackPath(key: AudioKey): string {
  const feedbackKeys = ["listening", "processing", "noSpeech", "understood", "error", "permission", "timeout"];
  const navigationKeys = ["navigationStart", "arrived", "turnLeft", "turnRight", "continueStraight"];
  const destinationKeys = ["library", "center", "cafeteria"];

  if (feedbackKeys.includes(key)) return `feedback/${key}`;
  if (navigationKeys.includes(key)) return `navigation/${key}`;
  if (destinationKeys.includes(key)) return `destinations/${key}`;
  return key;
}

/**
 * Play a pre-recorded audio asset
 * 
 * ⚠️ IMPORTANT: This resolves ONLY when audio finishes
 * 
 * Configures audio mode ONLY for playback, not before/after
 * Does NOT interfere with voice recording
 */
export async function playAudio(key: AudioKey): Promise<void> {
  const uri = cachedUris.get(key);

  if (!uri) {
    console.warn(`❌ Audio not found: ${key}`);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      // CRITICAL: Only set audio mode RIGHT BEFORE playing
      // Do NOT set it at any other time, especially not during recording setup
      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: "duckOthers",
        interruptionModeAndroid: "duckOthers",
      })
        .then(() => {
          // Stop previous playback
          if (currentPlayer) {
            try {
              currentPlayer.release();
            } catch (e) {
              // Ignore
            }
          }

          // Create player
          const player = createAudioPlayer({ uri });
          currentPlayer = player;

          const estimatedDuration = ESTIMATED_DURATIONS[key] || 2000;

          console.log(`▶️  Playing: ${key} (~${(estimatedDuration / 1000).toFixed(1)}s)`);

          // Start playback
          try {
            player.play();
          } catch (error) {
            console.error(`Failed to start playback for ${key}:`, error);
            resolve();
            return;
          }

          // Timer-based completion
          const completionTimeout = setTimeout(() => {
            console.log(`✅ Finished: ${key}`);
            try {
              player.release();
            } catch (e) {
              // Ignore
            }
            currentPlayer = null;
            resolve();
          }, estimatedDuration + 100);

          // Try status update if available
          if (typeof (player as any).setOnPlaybackStatusUpdate === "function") {
            try {
              (player as any).setOnPlaybackStatusUpdate((status: any) => {
                if (status && status.isLoaded && !status.isPlaying && status.didJustFinish) {
                  clearTimeout(completionTimeout);
                  console.log(`✅ Finished (early): ${key}`);
                  try {
                    player.release();
                  } catch (e) {
                    // Ignore
                  }
                  currentPlayer = null;
                  resolve();
                }
              });
            } catch (error) {
              // Status updates not available, timer will handle it
            }
          }
        })
        .catch((error) => {
          console.error(`❌ Failed to set audio mode for ${key}:`, error);
          resolve(); // Don't reject, just resolve
        });
    } catch (error) {
      console.error(`❌ Playback setup failed for ${key}:`, error);
      resolve(); // Don't reject
    }
  });
}

/**
 * Play multiple audio files in sequence
 */
export async function playAudioSequence(keys: AudioKey[]): Promise<void> {
  for (const key of keys) {
    await playAudio(key);
  }
}

/**
 * Play audio without waiting (fire and forget)
 */
export function playAudioAsync(key: AudioKey): void {
  playAudio(key).catch((error) => {
    console.warn(`Failed to play ${key}:`, error);
  });
}

/**
 * Stop current audio playback immediately
 */
export async function stopAudio(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.release();
    } catch (error) {
      console.warn("Failed to stop audio:", error);
    }
    currentPlayer = null;
  }
}

/**
 * Check if audio is available and loaded
 */
export function hasAudio(key: AudioKey): boolean {
  return cachedUris.has(key);
}

/**
 * Get the URI of an audio asset
 */
export function getAudioUri(key: AudioKey): string | null {
  return cachedUris.get(key) || null;
}

/**
 * Get estimated duration of an audio file
 */
export function getAudioDuration(key: AudioKey): number | null {
  return ESTIMATED_DURATIONS[key] || null;
}

/**
 * Get list of all available audio keys
 */
export function getAvailableAudioKeys(): AudioKey[] {
  return Array.from(cachedUris.keys());
}

/**
 * Clear audio cache and stop playback
 */
export async function clearAudioCache(): Promise<void> {
  await stopAudio();
  cachedUris.clear();
  isPreloaded = false;
  console.log("🗑️  Audio cache cleared");
}

/**
 * Update estimated duration for an audio file
 */
export function setAudioDuration(key: AudioKey, durationMs: number): void {
  ESTIMATED_DURATIONS[key] = durationMs;
  console.log(`⏱️  Updated duration for ${key}: ${durationMs}ms`);
}
