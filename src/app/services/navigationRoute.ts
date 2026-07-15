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
  };
  route_preview: CoordinatePayload[];
  steps: RouteStepPayload[];
  total_distance_meters: number;
  estimated_duration_seconds: number;
  simulated: boolean;
};

export const AAUA_OBJ_COORDINATE: CoordinatePayload = {
  latitude: 7.479601,
  longitude: 5.7394032,
};

export const SIMULATED_LOCATION_LABEL = "Simulated start: OBJ Multipurpose Hall";

export const shouldForceSimulatedOrigin =
  process.env.EXPO_PUBLIC_SIMULATE_LOCATION === "true";

export function getEffectiveRouteOrigin(
  origin?: CoordinatePayload,
): { origin?: CoordinatePayload; simulate_origin?: CoordinatePayload } {
  if (shouldForceSimulatedOrigin) {
    return {
      origin: origin ?? AAUA_OBJ_COORDINATE,
      simulate_origin: AAUA_OBJ_COORDINATE,
    };
  }

  return origin ? { origin } : {};
}

export async function fetchRouteFromBackend(
  origin: CoordinatePayload | undefined,
  destination: string,
): Promise<RoutePayload> {
  if (!BACKEND_ENDPOINTS.routeUrl) {
    throw new Error(getBackendSetupHint());
  }

  if (!origin && !shouldForceSimulatedOrigin) {
    throw new Error("Current location is unavailable. Enable simulation or wait for GPS.");
  }

  const destination_name = await resolveCampusLocationName(destination);
  const destination_id = await resolveCampusLocationId(destination);

  const response = await fetch(BACKEND_ENDPOINTS.routeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...getEffectiveRouteOrigin(origin),
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
console.log(data);

  return data as RoutePayload;
}
