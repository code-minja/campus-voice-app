type BackendEndpointConfig = {
  baseUrl: string;
  healthUrl: string;
  modelsUrl: string;
  transcribeUrl: string;
  ttsUrl: string;
  routeUrl: string;
};

function trimAndNormalizeUrl(value: string | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function withBase(baseUrl: string, path: string) {
  if (!baseUrl) {
    return "";
  }

  return `${baseUrl}${path}`;
}

const explicitBaseUrl = trimAndNormalizeUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const explicitTranscribeUrl = trimAndNormalizeUrl(
  process.env.EXPO_PUBLIC_TRANSCRIBE_URL,
);
const explicitTtsUrl = trimAndNormalizeUrl(process.env.EXPO_PUBLIC_TTS_URL);

export const BACKEND_ENDPOINTS: BackendEndpointConfig = {
  baseUrl: explicitBaseUrl,
  healthUrl: withBase(explicitBaseUrl, "/health"),
  modelsUrl: withBase(explicitBaseUrl, "/v1/models"),
  transcribeUrl:
    explicitTranscribeUrl || withBase(explicitBaseUrl, "/v1/stt/transcribe"),
  ttsUrl: explicitTtsUrl || withBase(explicitBaseUrl, "/v1/tts/synthesize"),
  routeUrl: withBase(explicitBaseUrl, "/v1/route"),
};

export function getBackendSetupHint() {
  return (
    "Backend is not configured. Set EXPO_PUBLIC_API_BASE_URL " +
    "or EXPO_PUBLIC_TRANSCRIBE_URL / EXPO_PUBLIC_TTS_URL."
  );
}

export async function getBackendErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const payload = (await response.json()) as {
      detail?: unknown;
      message?: unknown;
    };

    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const detailMessage = payload.detail
        .map((item) => {
          if (item && typeof item === "object") {
            const record = item as { loc?: unknown; msg?: unknown };
            const loc = Array.isArray(record.loc)
              ? record.loc.join(".")
              : "";
            const msg = typeof record.msg === "string" ? record.msg : "";
            if (loc && msg) return `${loc}: ${msg}`;
            return msg || loc;
          }

          return typeof item === "string" ? item : "";
        })
        .filter(Boolean)
        .join("; ");

      if (detailMessage.trim()) {
        return detailMessage;
      }
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // noop
  }

  try {
    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch {
    // noop
  }

  return fallbackMessage;
}
