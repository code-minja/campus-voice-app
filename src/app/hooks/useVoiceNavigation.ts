import { useCallback, useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { speakToUser, clearSpeechQueue } from "../services/voiceFeedback";
import { streamRecordingForTranscription } from "../services/voiceTranscription";
import {
  announceError,
  announceMicStartBeep,
  announceMicStopBeep,
  announceProcessing,
} from "../services/footstepAudio";
import {
  rankCampusLocations,
  resolveCampusLocation,
} from "../services/campusLocations";

type UseVoiceNavigationArgs = {
  onStartVoiceNavigation: (destination: string) => void;
};

type UseVoiceNavigationResult = {
  isListening: boolean;
  transcript: string;
  beginVoiceSession: () => Promise<void>;
  handleVoicePress: () => void;
  handleSuggestionPress: (suggestion: string) => void;
};

const AUTO_STOP_RECORDING_MS = 6000;

type VoiceStage = "awaitingDestination" | "confirmingDestination" | "choosingDestination";

type PendingDestinationChoice = {
  location: { id: number; name: string };
  score: number;
};

function normalizeUtterance(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function extractDestinationFromText(value: string): Promise<string | null> {
  const normalized = normalizeUtterance(value);
  if (!normalized) return null;

  const location = await resolveCampusLocation(normalized);
  return location?.name ?? null;
}

function isAffirmativeIntent(value: string): boolean {
  const normalized = normalizeUtterance(value);
  return [
    "yes",
    "yeah",
    "yep",
    "sure",
    "correct",
    "right",
    "go ahead",
    "ok",
    "okay",
  ].some((cue) => normalized.includes(cue));
}

function isNegativeIntent(value: string): boolean {
  const normalized = normalizeUtterance(value);
  return ["no", "nope", "wrong", "cancel", "stop"].some((cue) => normalized.includes(cue));
}

function parseChoiceIndex(value: string): number | null {
  const normalized = normalizeUtterance(value);
  const match = normalized.match(/\b([1-3])\b/);
  if (match) {
    return Number(match[1]) - 1;
  }

  const words = new Map([
    ["one", 0],
    ["first", 0],
    ["two", 1],
    ["second", 1],
    ["three", 2],
    ["third", 2],
  ]);

  for (const [word, index] of words.entries()) {
    if (normalized.includes(word)) {
      return index;
    }
  }

  return null;
}

function formatChoices(choices: PendingDestinationChoice[]): string {
  return choices
    .map((choice, index) => `${index + 1}. ${choice.location.name}`)
    .join(", ");
}

export function useVoiceNavigation({
  onStartVoiceNavigation,
}: UseVoiceNavigationArgs): UseVoiceNavigationResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const previousListeningRef = useRef(false);
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isProcessingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const voiceStageRef = useRef<VoiceStage>("awaitingDestination");
  const pendingChoicesRef = useRef<PendingDestinationChoice[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isMountedRef = useRef(true);

  const clearPendingTimeouts = useCallback(() => {
    timeoutHandles.current.forEach((handle) => clearTimeout(handle));
    timeoutHandles.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const handle = setTimeout(() => {
      timeoutHandles.current = timeoutHandles.current.filter(
        (item) => item !== handle,
      );
      fn();
    }, delay);
    timeoutHandles.current.push(handle);
  }, []);

  const setAssistantFeedback = useCallback(
    (message: string, shouldSpeak = true) => {
      setTranscript(message);
      if (shouldSpeak) {
        void speakToUser(message);
      }
    },
    [],
  );

  const safeIsRecording = useCallback(() => {
    try {
      return recorder.isRecording;
    } catch {
      return false;
    }
  }, [recorder]);

  const safeStopRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // recorder may be stale during screen transitions
    }
  }, [recorder]);

  const safeGetRecordingUri = useCallback(() => {
    try {
      return recorder.uri;
    } catch {
      return null;
    }
  }, [recorder]);

  const startRecording = useCallback(async (playListeningCue = true) => {
    if (isTransitioningRef.current) {
      return;
    }
    isTransitioningRef.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setAssistantFeedback("Microphone permission denied.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      setIsListening(true);
      if (playListeningCue) {
        void announceMicStartBeep();
      }

      schedule(() => {
        if (!isMountedRef.current || !safeIsRecording() || isProcessingRef.current) {
          return;
        }

        isProcessingRef.current = true;
        void stopRecordingAndTranscribe()
          .catch((error) => {
            setIsListening(false);
            announceError(
              error instanceof Error
                ? error.message
                : "Unable to process voice recording.",
            );
          })
          .finally(() => {
            isProcessingRef.current = false;
          });
      }, AUTO_STOP_RECORDING_MS);
    } finally {
      isTransitioningRef.current = false;
    }
  }, [recorder, safeIsRecording, schedule, setAssistantFeedback]);

  const requestAnotherDestination = useCallback(async () => {
    voiceStageRef.current = "awaitingDestination";
    pendingChoicesRef.current = [];
    setIsListening(false);
    setTranscript("Where would you like to go?");
    await speakToUser("Where would you like to go?");
    // Defer mic restart to the next tick so we don't race with transition locks.
    setTimeout(() => {
      void startRecording(true);
    }, 0);
  }, [startRecording]);

  const beginVoiceSession = useCallback(async () => {
    clearSpeechQueue();
    clearPendingTimeouts();
    voiceStageRef.current = "awaitingDestination";
    pendingChoicesRef.current = [];
    setTranscript("Hi! I'm CampusVoice. Where would you like to go?");
    await speakToUser("Hi! I'm CampusVoice. Where would you like to go?");
    await startRecording(true);
  }, [clearPendingTimeouts, startRecording]);

  const handleTranscriptionIntent = useCallback(
    async (text: string) => {
      if (voiceStageRef.current === "awaitingDestination") {
        const matches = await rankCampusLocations(text, 3);
        if (!matches.length) {
          await speakToUser(
            "I couldn't find that location. Please say a destination like Engineering Building or Library.",
          );
          await requestAnotherDestination();
          return;
        }

        const strongMatch = matches[0];
        const secondMatch = matches[1];
        const isConfident =
          matches.length === 1 || strongMatch.score >= 0.92 || (secondMatch ? strongMatch.score - secondMatch.score >= 0.12 : true);

        if (isConfident) {
          voiceStageRef.current = "confirmingDestination";
          pendingChoicesRef.current = [strongMatch];
          const prompt = `I heard ${strongMatch.location.name}. Say yes to continue or no to try again.`;
          setTranscript(prompt);
          await speakToUser(prompt);
          await startRecording(true);
          return;
        }

        voiceStageRef.current = "choosingDestination";
        pendingChoicesRef.current = matches;
        const prompt = `I heard multiple possible destinations: ${formatChoices(matches)}. Say 1, 2, or 3.`;
        setTranscript(prompt);
        await speakToUser(prompt);
        await startRecording(true);
        return;
      }

      if (voiceStageRef.current === "confirmingDestination") {
        const pending = pendingChoicesRef.current[0];
        if (!pending) {
          await requestAnotherDestination();
          return;
        }

        if (isAffirmativeIntent(text)) {
          const prompt = `Great. Opening route preview for ${pending.location.name}.`;
          setTranscript(prompt);
          await speakToUser(prompt);
          onStartVoiceNavigation(pending.location.name);
          return;
        }

        if (isNegativeIntent(text)) {
          await requestAnotherDestination();
          return;
        }

        const prompt = `Please say yes to confirm ${pending.location.name}, or no to try again.`;
        setTranscript(prompt);
        await speakToUser(prompt);
        await startRecording(true);
        return;
      }

      if (voiceStageRef.current === "choosingDestination") {
        const pending = pendingChoicesRef.current;
        const index = parseChoiceIndex(text);
        if (index !== null && pending[index]) {
          const chosen = pending[index];
          const prompt = `Great. Opening route preview for ${chosen.location.name}.`;
          setTranscript(prompt);
          await speakToUser(prompt);
          onStartVoiceNavigation(chosen.location.name);
          return;
        }

        const prompt = `Please say 1, 2, or 3 to choose from ${formatChoices(pending)}.`;
        setTranscript(prompt);
        await speakToUser(prompt);
        await startRecording(true);
      }
    },
    [onStartVoiceNavigation, requestAnotherDestination, startRecording],
  );

  const stopRecordingAndTranscribe = useCallback(async () => {
    if (isTransitioningRef.current) {
      return;
    }
    isTransitioningRef.current = true;
    try {
      if (!safeIsRecording()) {
        setIsListening(false);
        return;
      }

      await safeStopRecording();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });
      setIsListening(false);
      await announceMicStopBeep();
      await announceProcessing();

      const recordingUri = safeGetRecordingUri();

      if (!recordingUri) {
        setAssistantFeedback("No audio was captured. Please try again.");
        return;
      }

      const result = await streamRecordingForTranscription(
        recordingUri,
        (partialText) => {
          setTranscript("");
          setTranscript(partialText);
        },
      );

      const finalText = result.text || "No speech detected.";
      setTranscript(finalText);
      isTransitioningRef.current = false;
      await handleTranscriptionIntent(finalText);
    } finally {
      isTransitioningRef.current = false;
    }
  }, [handleTranscriptionIntent, safeGetRecordingUri, safeIsRecording, safeStopRecording, setAssistantFeedback]);
  useEffect(() => {
    const wasListening = previousListeningRef.current;
    if (!wasListening && isListening) {
      // Mic started
      Vibration.vibrate(35);
    } else if (wasListening && !isListening) {
      // Mic stopped
      Vibration.vibrate([0, 20, 40, 20]);
    }
    previousListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPendingTimeouts();
      clearSpeechQueue();
      if (safeIsRecording()) {
        void safeStopRecording();
      }
    };
  }, [clearPendingTimeouts, safeIsRecording, safeStopRecording]);

  // Replace your entire handleVoicePress() with this version.

  const handleVoicePress = useCallback(async () => {
    // If we're already transcribing, ignore additional presses
    if (isProcessingRef.current) {
      return;
    }

    clearPendingTimeouts();

    try {
      if (isListening) {
        // User pressed again to stop and transcribe
        isProcessingRef.current = true;
        await stopRecordingAndTranscribe();
        isProcessingRef.current = false;
        return;
      }

      // Start recording ONLY.
      // Do NOT set isProcessingRef.current here.
      await startRecording(true);
    } catch (error) {
      setIsListening(false);
      announceError(
        error instanceof Error
          ? error.message
          : "Unable to process voice recording.",
      );
      isProcessingRef.current = false;
    }
  }, [
    clearPendingTimeouts,
    isListening,
    startRecording,
    stopRecordingAndTranscribe,
  ]);

  const handleSuggestionPress = useCallback(
    async (suggestion: string) => {
      clearPendingTimeouts();
      if (safeIsRecording()) {
        try {
          await safeStopRecording();
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          });
        } catch {
          // noop
        }
      }

      const message = `Take me to the ${suggestion}`;
      setTranscript(message);
      void speakToUser(message);
      setIsListening(true);

      schedule(() => {
        setIsListening(false);
        setTranscript("");
        onStartVoiceNavigation(suggestion);
      }, 1700);
    },
    [clearPendingTimeouts, onStartVoiceNavigation, safeIsRecording, safeStopRecording, schedule],
  );

  return {
    isListening,
    transcript,
    beginVoiceSession,
    handleVoicePress,
    handleSuggestionPress,
  };
}
