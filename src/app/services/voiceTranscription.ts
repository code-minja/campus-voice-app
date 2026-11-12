import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import {
  BACKEND_ENDPOINTS,
  getBackendErrorMessage,
  getBackendSetupHint,
} from "./backendConfig";

export type TranscriptionResult = {
  text: string;
};

type TranscriptionStreamCallback = (partialText: string) => void;

const TRANSCRIPTION_ENDPOINT = BACKEND_ENDPOINTS.transcribeUrl;

function parseTranscriptionResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybeText = (
    payload as { text?: unknown; transcript?: unknown; data?: unknown }
  ).text;
  if (typeof maybeText === "string") {
    return maybeText;
  }

  const maybeTranscript = (payload as { transcript?: unknown }).transcript;
  if (typeof maybeTranscript === "string") {
    return maybeTranscript;
  }

  const maybeData = (payload as { data?: unknown }).data;
  if (maybeData && typeof maybeData === "object") {
    const nestedText = (maybeData as { text?: unknown; transcript?: unknown }).text;
    if (typeof nestedText === "string") {
      return nestedText;
    }
    const nestedTranscript = (maybeData as { transcript?: unknown }).transcript;
    if (typeof nestedTranscript === "string") {
      return nestedTranscript;
    }
  }

  return "";
}

function buildAudioFormData(recordingUri: string) {
  const formData = new FormData();
  formData.append("file", new File(recordingUri), "voice-input.m4a");

  return formData;
}

export async function sendRecordingForTranscription(
  recordingUri: string,
): Promise<TranscriptionResult> {
  if (!TRANSCRIPTION_ENDPOINT) {
    throw new Error(getBackendSetupHint());
  }

  const response = await fetch(TRANSCRIPTION_ENDPOINT, {
    method: "POST",
    body: buildAudioFormData(recordingUri),
  });

  if (!response.ok) {
    const message = await getBackendErrorMessage(
      response,
      `Transcription request failed (${response.status})`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as unknown;
  const text = parseTranscriptionResponse(payload);
  if (!text.trim() || text === "No speech detected.") {
    return { text: "No speech detected." };
  }

  return { text };
}

export async function streamRecordingForTranscription(
  recordingUri: string,
  onPartial: TranscriptionStreamCallback,
): Promise<TranscriptionResult> {
  if (!TRANSCRIPTION_ENDPOINT) {
    throw new Error(getBackendSetupHint());
  }

  onPartial("Uploading audio to speech server...");
  onPartial("Transcribing your speech...");
  const result = await sendRecordingForTranscription(recordingUri);
  return result;
}
