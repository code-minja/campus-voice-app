import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import type { GeoCoordinates } from "../types";

type PermissionState = "loading" | "granted" | "denied" | "unavailable";

type LiveLocationResult = {
  currentLocationLabel: string;
  currentCoordinates?: GeoCoordinates;
  accuracyMeters?: number;
  permissionState: PermissionState;
  isTracking: boolean;
  errorMessage?: string;
  retryLocation: () => void;
};

const DEFAULT_LOCATION_LABEL = "Getting current location...";

function toMetersDistance(a: GeoCoordinates, b: GeoCoordinates) {
  const R = 6371e3;
  const phi1 = (a.latitude * Math.PI) / 180;
  const phi2 = (b.latitude * Math.PI) / 180;
  const dPhi = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLambda = ((b.longitude - a.longitude) * Math.PI) / 180;

  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function formatFallbackLabel(coords: GeoCoordinates) {
  return `Lat ${coords.latitude.toFixed(4)}, Lng ${coords.longitude.toFixed(4)}`;
}

function formatReverseGeocodeResult(
  result: Location.LocationGeocodedAddress | undefined,
  coords: GeoCoordinates,
) {
  if (!result) {
    return formatFallbackLabel(coords);
  }

  const primary = [result.name, result.street].filter(Boolean).join(", ");
  const secondary = [result.district, result.city].filter(Boolean).join(", ");

  if (primary && secondary) {
    return `${primary} • ${secondary}`;
  }
  if (primary || secondary) {
    return primary || secondary;
  }

  return formatFallbackLabel(coords);
}

export function useLiveLocation(): LiveLocationResult {
  const [currentCoordinates, setCurrentCoordinates] = useState<GeoCoordinates>();
  const [accuracyMeters, setAccuracyMeters] = useState<number>();
  const [currentLocationLabel, setCurrentLocationLabel] =
    useState(DEFAULT_LOCATION_LABEL);
  const [permissionState, setPermissionState] =
    useState<PermissionState>("loading");
  const [isTracking, setIsTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [retryVersion, setRetryVersion] = useState(0);

  const lastGeocodedRef = useRef<GeoCoordinates | undefined>(undefined);
  const lastGeocodedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    const maybeUpdateLocationLabel = async (
      coords: GeoCoordinates,
      force = false,
    ) => {
      const now = Date.now();
      const lastCoords = lastGeocodedRef.current;
      const movedEnough =
        !lastCoords || toMetersDistance(lastCoords, coords) >= 40;
      const staleEnough = now - lastGeocodedAtRef.current >= 30_000;

      if (!force && !movedEnough && !staleEnough) {
        return;
      }

      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        if (cancelled) {
          return;
        }

        setCurrentLocationLabel(formatReverseGeocodeResult(result, coords));
        lastGeocodedRef.current = coords;
        lastGeocodedAtRef.current = now;
      } catch {
        if (!cancelled) {
          setCurrentLocationLabel(formatFallbackLabel(coords));
        }
      }
    };

    const startTracking = async () => {
      try {
        setPermissionState("loading");
        setIsTracking(false);
        setErrorMessage(undefined);
        setCurrentCoordinates(undefined);
        setAccuracyMeters(undefined);
        setCurrentLocationLabel(DEFAULT_LOCATION_LABEL);

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (cancelled) {
          return;
        }

        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionState("denied");
          const message = "Location permission denied. Enable GPS and allow location access.";
          setCurrentLocationLabel(message);
          setErrorMessage(message);
          setIsTracking(false);
          return;
        }

        setPermissionState("granted");
        setErrorMessage(undefined);

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (cancelled) {
          return;
        }

        const initialCoords: GeoCoordinates = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };

        setCurrentCoordinates(initialCoords);
        setAccuracyMeters(initial.coords.accuracy ?? undefined);
        setCurrentLocationLabel(formatFallbackLabel(initialCoords));
        await maybeUpdateLocationLabel(initialCoords, true);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 2,
            timeInterval: 2000,
            mayShowUserSettingsDialog: true,
          },
          (location) => {
            const coords: GeoCoordinates = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            setCurrentCoordinates(coords);
            setAccuracyMeters(location.coords.accuracy ?? undefined);
            void maybeUpdateLocationLabel(coords);
          },
        );

        if (!cancelled) {
          setIsTracking(true);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPermissionState("unavailable");
        setIsTracking(false);
        const message =
          error instanceof Error
            ? error.message
            : "Unable to access current location.";
        setErrorMessage(message);
        setCurrentLocationLabel(`Unable to access current location: ${message}`);
      }
    };

    void startTracking();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [retryVersion]);

  return {
    currentLocationLabel,
    currentCoordinates,
    accuracyMeters,
    permissionState,
    isTracking,
    errorMessage,
    retryLocation: () => setRetryVersion((version) => version + 1),
  };
}
