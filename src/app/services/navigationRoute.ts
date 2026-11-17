import {
  BACKEND_ENDPOINTS,
  getBackendErrorMessage,
  getBackendSetupHint,
} from "./backendConfig";
import {
  resolveCampusLocationId,
  resolveCampusLocationName,
} from "./campusLocations";

export type CoordinatePayload = {
  latitude: number;
  longitude: number;
};

export type RouteStepPayload = {
  step_number?: number | null;
  instruction: string;
  distance_meters: number;
  heading_degrees?: number | null;
  waypoint: CoordinatePayload;
};

export type RoutePayload = {
  origin: CoordinatePayload;
  destination: {
    id: number;
    name: string;
    coordinate?: CoordinatePayload | null;
  };
  geofence?: {
    enabled: boolean;
    inside: boolean;
    center: CoordinatePayload;
    radius_meters: number;
    distance_from_center_meters: number;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  route_preview: CoordinatePayload[];
  steps: RouteStepPayload[];
  total_distance_meters: number;
  estimated_duration_seconds: number;
  simulated: boolean;
};

export async function fetchRouteFromBackend(
  origin: CoordinatePayload | undefined,
  destination: string,
): Promise<RoutePayload> {
  if (!BACKEND_ENDPOINTS.routeUrl) {
    throw new Error(getBackendSetupHint());
  }

  if (!origin) {
    throw new Error("Current location is unavailable. Wait for GPS and try again.");
  }

  const destination_name = await resolveCampusLocationName(destination);
  const destination_id = await resolveCampusLocationId(destination);

  const response = await fetch(BACKEND_ENDPOINTS.routeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin,
      destination_id,
      destination_name,
    }),
  });

  if (!response.ok) {
    const message = await getBackendErrorMessage(
      response,
      `Route request failed (${response.status})`,
    );
    throw new Error(message);
  }


  const data = (await response.json());
  return data as RoutePayload;
}

// Short-lived reuse of the preview route so navigation screens don't pay for
// a second Google Routes call right after the user confirms.
let previewRoute: { destination: string; payload: RoutePayload; at: number } | null = null;

export function rememberPreviewRoute(destination: string, payload: RoutePayload) {
  previewRoute = { destination, payload, at: Date.now() };
}

export function getPreviewRoute(destination: string, maxAgeMs = 120_000): RoutePayload | null {
  return previewRoute &&
    previewRoute.destination === destination &&
    Date.now() - previewRoute.at <= maxAgeMs
    ? previewRoute.payload
    : null;
}
