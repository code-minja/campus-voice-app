/**
 * Footstep Navigation Audio Service
 * 
 * All functions resolve ONLY when audio finishes playing
 */

import { playAudio, stopAudio } from "./preRecordedAudio";
import { quickSpeak, stopSpeaking } from "./quickSpeaker";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Static Announcements (Pre-recorded)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function announceGreeting(): Promise<void> {
  try {
    await playAudio("listening");
  } catch (error) {
    console.error("Failed to announce greeting:", error);
  }
}

export async function announceListening(): Promise<void> {
  try {
    await playAudio("listening");
  } catch (error) {
    console.error("Failed to announce listening:", error);
  }
}

export async function announceMicStartBeep(): Promise<void> {
  try {
    await playAudio("listening");
  } catch (error) {
    console.error("Failed to announce mic start beep:", error);
  }
}

export async function announceMicStopBeep(): Promise<void> {
  try {
    await playAudio("understood");
  } catch (error) {
    console.error("Failed to announce mic stop beep:", error);
  }
}

export async function announceProcessing(): Promise<void> {
  try {
    await playAudio("processing");
  } catch (error) {
    console.error("Failed to announce processing:", error);
  }
}

export async function announceDestinationQuestion(): Promise<void> {
  try {
    await playAudio("understood");
  } catch (error) {
    console.error("Failed to announce destination question:", error);
  }
}

export async function announceNavigationStarted(): Promise<void> {
  try {
    await playAudio("navigationStart");
  } catch (error) {
    console.error("Failed to announce navigation started:", error);
  }
}

export async function announceArrived(buildingName?: string): Promise<void> {
  try {
    await playAudio("arrived");
    if (buildingName) {
      await quickSpeak(buildingName);
    }
  } catch (error) {
    console.error("Failed to announce arrival:", error);
  }
}

export async function announcePostArrival(): Promise<void> {
  try {
    await playAudio("understood");
  } catch (error) {
    console.error("Failed to announce post-arrival:", error);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dynamic Announcements (TTS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function announceFootsteps(
  type: "ahead" | "continue" | "approaching",
  footsteps: number,
): Promise<void> {
  let prefix = "";

  switch (type) {
    case "ahead":
      prefix = "Walk straight for about";
      break;
    case "continue":
      prefix = "Keep going straight for";
      break;
    case "approaching":
      prefix = "In about";
      break;
  }

  const message = `${prefix} ${footsteps} footsteps`;

  try {
    await quickSpeak(message);
  } catch (error) {
    console.error("Failed to announce footsteps:", error);
  }
}

export async function announceTurning(
  footsteps: number,
  direction: "left" | "right",
): Promise<void> {
  try {
    if (footsteps <= 0) {
      if (direction === "left") {
        await playAudio("turnLeft");
      } else {
        await playAudio("turnRight");
      }
    } else {
      const directionText = direction === "left" ? "left" : "right";
      const message = `In about ${footsteps} footsteps, turn ${directionText}`;
      await quickSpeak(message);
    }
  } catch (error) {
    console.error("Failed to announce turning:", error);
  }
}

export async function announceDistance(
  footsteps: number,
  destination?: string,
): Promise<void> {
  let message = `You're about ${footsteps} footsteps away`;
  if (destination) {
    message += ` from the ${destination}`;
  }

  try {
    await quickSpeak(message);
  } catch (error) {
    console.error("Failed to announce distance:", error);
  }
}

export async function announceFinalApproach(
  footsteps: number,
  destination: string,
  side: "left" | "right",
): Promise<void> {
  const message = `Walk ${footsteps} more footsteps. The ${destination} will be on your ${side}`;

  try {
    await quickSpeak(message);
  } catch (error) {
    console.error("Failed to announce final approach:", error);
  }
}

export async function announceError(message?: string): Promise<void> {
  try {
    await playAudio("error");
    if (message) {
      await quickSpeak(message);
    }
  } catch (error) {
    console.error("Failed to announce error:", error);
  }
}

export async function stopAllAudio(): Promise<void> {
  try {
    await stopAudio();
    await stopSpeaking();
  } catch (error) {
    console.error("Failed to stop audio:", error);
  }
}
