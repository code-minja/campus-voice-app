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

  formData.append(
    "file",
    {
      uri: recordingUri,
      name: "voice-input.m4a",
      type: "audio/m4a",
    } as unknown as Blob,
  );

  return formData;
}

export async function sendRecordingForTranscription(
  recordingUri: string,
): Promise<TranscriptionResult> {
  if (!TRANSCRIPTION_ENDPOINT) {
    return {
      text: getBackendSetupHint(),
    };
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

  return {
    text: text || "No speech detected.",
  };
}

export async function streamRecordingForTranscription(
  recordingUri: string,
  onPartial: TranscriptionStreamCallback,
): Promise<TranscriptionResult> {
  if (!TRANSCRIPTION_ENDPOINT) {
    return {
      text: getBackendSetupHint(),
    };
  }

  onPartial("Uploading audio to speech server...");
  onPartial("Transcribing your speech...");
  const result = await sendRecordingForTranscription(recordingUri);
  return result;
}
