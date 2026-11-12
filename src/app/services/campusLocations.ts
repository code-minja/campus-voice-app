import { BACKEND_ENDPOINTS, getBackendSetupHint } from "./backendConfig";

export type CampusLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

export type CampusLocationMatch = {
  location: CampusLocation;
  score: number;
};

type CampusLocationsResponse = {
  locations: CampusLocation[];
};

let cachedPromise: Promise<CampusLocation[]> | null = null;
let cachedLocations: CampusLocation[] | null = null;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function levenshteinScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = Array(cols).fill(0);
    row[0] = i;
    return row;
  });

  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = dp[rows - 1][cols - 1];
  return 1 - distance / Math.max(left.length, right.length);
}

function candidatePhrases(value: string): string[] {
  const base = normalizeName(value);
  const stripped = base
    .replace(
      /^(take me to|i am going to|i'm going to|go to|navigate to|bring me to|head to|walk me to)\s+/i,
      "",
    )
    .trim();

  const toParts = base.split(/\bto\b/i).map((part) => part.trim()).filter(Boolean);
  const afterTo = toParts.length > 1 ? toParts[toParts.length - 1] : "";
  const words = base.split(" ").filter(Boolean);
  const embeddedPhrases: string[] = [];

  for (let start = 0; start < words.length; start += 1) {
    const maxLength = Math.min(8, words.length - start);
    for (let length = 1; length <= maxLength; length += 1) {
      embeddedPhrases.push(words.slice(start, start + length).join(" "));
    }
  }

  return Array.from(
    new Set([base, stripped, afterTo, ...embeddedPhrases].filter(Boolean)),
  );
}

function scoreMatch(input: string, candidate: string): number {
  const normalizedInput = normalizeName(input);
  const normalizedCandidate = normalizeName(candidate);
  const compactInput = compactName(input);
  const compactCandidate = compactName(candidate);
  const inputDigits = digitsOnly(input);
  const candidateDigits = digitsOnly(candidate);

  if (!normalizedInput || !normalizedCandidate) return 0;
  if (normalizedInput === normalizedCandidate) return 1;
  if (compactInput === compactCandidate) return 0.99;
  if (inputDigits && inputDigits === candidateDigits) return 0.97;
  if (inputDigits && compactCandidate.includes(inputDigits)) return 0.94;
  if (
    compactInput &&
    (compactCandidate.includes(compactInput) || compactInput.includes(compactCandidate))
  ) {
    return 0.92;
  }

  const ratio = levenshteinScore(compactInput, compactCandidate);
  const inputTokens = new Set(normalizedInput.split(" "));
  const candidateTokens = new Set(normalizedCandidate.split(" "));
  const union = new Set([...inputTokens, ...candidateTokens]);
  const overlap =
    inputTokens.size && candidateTokens.size
      ? new Set([...inputTokens].filter((token) => candidateTokens.has(token))).size /
        union.size
      : 0;

  return Math.max(ratio, overlap);
}

export async function getCampusLocations(): Promise<CampusLocation[]> {
  if (cachedLocations) {
    return cachedLocations;
  }

  if (!cachedPromise) {
    if (!BACKEND_ENDPOINTS.baseUrl) {
      throw new Error(getBackendSetupHint());
    }

    cachedPromise = fetch(`${BACKEND_ENDPOINTS.baseUrl}/v1/locations`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load campus locations (${response.status})`);
        }

        const payload = (await response.json()) as CampusLocationsResponse;
        cachedLocations = payload.locations ?? [];
        return cachedLocations;
      })
      .catch((error) => {
        cachedPromise = null;
        throw error;
      });
  }

  return cachedPromise;
}

export async function resolveCampusLocation(destination: string): Promise<CampusLocation | null> {
  const [best] = await rankCampusLocations(destination, 1);
  return best && best.score >= 0.78 ? best.location : null;
}

export async function resolveCampusLocationId(destination: string): Promise<number | undefined> {
  return (await resolveCampusLocation(destination))?.id;
}

export async function resolveCampusLocationName(destination: string): Promise<string> {
  return (await resolveCampusLocation(destination))?.name ?? destination.trim();
}

export async function rankCampusLocations(
  destination: string,
  limit = 3,
): Promise<CampusLocationMatch[]> {
  const locations = await getCampusLocations();
  const scored = locations.flatMap((location) => {
    const names = [location.name, ...location.aliases];
    const matches = candidatePhrases(destination).flatMap((phrase) =>
      names.map((name) => scoreMatch(phrase, name)),
    );
    const score = Math.max(...matches, 0);
    return score > 0 ? [{ location, score }] : [];
  });

  scored.sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name));
  return scored.slice(0, Math.max(1, limit));
}

export function invalidateCampusLocationsCache(): void {
  cachedPromise = null;
  cachedLocations = null;
}
