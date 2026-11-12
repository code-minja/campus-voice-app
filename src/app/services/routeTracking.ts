import type { GeoCoordinates } from "../types";

const EARTH_RADIUS_METERS = 6_371_000;

export type RouteProgress = {
  distanceToRouteMeters: number;
  remainingMeters: number;
  nearestPoint: GeoCoordinates;
};

function positiveConfigValue(
  value: string | undefined,
  fallback: number,
  integer = false,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return integer ? Math.max(1, Math.round(parsed)) : parsed;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceBetweenCoordinates(
  from: GeoCoordinates,
  to: GeoCoordinates,
): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function measureRouteProgress(
  coordinate: GeoCoordinates,
  route: GeoCoordinates[],
): RouteProgress {
  if (route.length < 2) {
    return {
      distanceToRouteMeters: Number.POSITIVE_INFINITY,
      remainingMeters: 0,
      nearestPoint: coordinate,
    };
  }

  const latitudeScale = Math.cos(toRadians(coordinate.latitude));
  let totalRouteMeters = 0;
  const segmentLengths = route.slice(1).map((point, index) => {
    const length = distanceBetweenCoordinates(route[index], point);
    totalRouteMeters += length;
    return length;
  });

  let distanceToRouteMeters = Number.POSITIVE_INFINITY;
  let distanceAlongRouteMeters = 0;
  let nearestPoint = route[0];
  let distanceBeforeSegment = 0;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index];
    const end = route[index + 1];
    const startX =
      EARTH_RADIUS_METERS *
      toRadians(start.longitude - coordinate.longitude) *
      latitudeScale;
    const startY =
      EARTH_RADIUS_METERS *
      toRadians(start.latitude - coordinate.latitude);
    const endX =
      EARTH_RADIUS_METERS *
      toRadians(end.longitude - coordinate.longitude) *
      latitudeScale;
    const endY =
      EARTH_RADIUS_METERS *
      toRadians(end.latitude - coordinate.latitude);
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const fraction =
      segmentLengthSquared === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              -(startX * segmentX + startY * segmentY) /
                segmentLengthSquared,
            ),
          );
    const projectedX = startX + fraction * segmentX;
    const projectedY = startY + fraction * segmentY;
    const distance = Math.hypot(projectedX, projectedY);

    if (distance < distanceToRouteMeters) {
      const segmentLength = segmentLengths[index];
      distanceToRouteMeters = distance;
      distanceAlongRouteMeters =
        distanceBeforeSegment + fraction * segmentLength;
      nearestPoint = {
        latitude:
          start.latitude + fraction * (end.latitude - start.latitude),
        longitude:
          start.longitude + fraction * (end.longitude - start.longitude),
      };
    }

    distanceBeforeSegment += segmentLengths[index];
  }

  return {
    distanceToRouteMeters,
    remainingMeters: Math.max(0, totalRouteMeters - distanceAlongRouteMeters),
    nearestPoint,
  };
}

export function estimateRemainingDurationSeconds(
  routeDurationSeconds: number | undefined,
  routeDistanceMeters: number | undefined,
  remainingMeters: number,
): number | undefined {
  if (
    !routeDurationSeconds ||
    routeDurationSeconds <= 0 ||
    !routeDistanceMeters ||
    routeDistanceMeters <= 0
  ) {
    return undefined;
  }

  return Math.ceil(
    routeDurationSeconds *
      Math.min(1, Math.max(0, remainingMeters / routeDistanceMeters)),
  );
}

export const NAVIGATION_TRACKING_CONFIG = {
  stepAnnouncementDistanceMeters: 30,
  announcementIntervalMeters: positiveConfigValue(
    process.env.EXPO_PUBLIC_NAVIGATION_ANNOUNCEMENT_INTERVAL_METERS,
    25,
  ),
  arrivalRadiusMeters: positiveConfigValue(
    process.env.EXPO_PUBLIC_NAVIGATION_ARRIVAL_RADIUS_METERS,
    15,
  ),
  maxGpsAccuracyMeters: positiveConfigValue(
    process.env.EXPO_PUBLIC_NAVIGATION_MAX_GPS_ACCURACY_METERS,
    10,
  ),
  offRouteConfirmations: positiveConfigValue(
    process.env.EXPO_PUBLIC_NAVIGATION_OFF_ROUTE_CONFIRMATIONS,
    3,
    true,
  ),
  offRouteThresholdMeters: positiveConfigValue(
    process.env.EXPO_PUBLIC_NAVIGATION_OFF_ROUTE_THRESHOLD_METERS,
    5,
  ),
  rerouteTargetMilliseconds: 2400,
} as const;
