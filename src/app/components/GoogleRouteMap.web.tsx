import { createElement, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GeoCoordinates } from "../types";
import { AAUA_CAMPUS_BOUNDS } from "./campusMapBounds";

type GoogleRouteMapProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  routeWaypoints?: GeoCoordinates[];
  mode?: "preview" | "active";
  showBadge?: boolean;
};

type GoogleMapsPoint = {
  lat: number;
  lng: number;
};

type GoogleMapsBounds = {
  extend: (point: GoogleMapsPoint) => void;
};

type GoogleMapsMap = {
  fitBounds: (bounds: GoogleMapsBounds) => void;
  panTo: (point: GoogleMapsPoint) => void;
};

type GoogleMapsPolyline = {
  setMap: (map: GoogleMapsMap | null) => void;
  setPath: (path: GoogleMapsPoint[]) => void;
};

type GoogleMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: GoogleMapsPoint;
      zoom: number;
      mapTypeId: "satellite";
      mapId: string;
      restriction: {
        latLngBounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
        strictBounds: boolean;
      };
    },
  ) => GoogleMapsMap;
  LatLngBounds: new () => GoogleMapsBounds;
  Polyline: new (options: {
    map: GoogleMapsMap;
    path: GoogleMapsPoint[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => GoogleMapsPolyline;
};

type LoadedGoogleMaps = {
  maps: GoogleMapsApi;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    __campusVoiceMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const googleMapsMapId =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";
const defaultCenter: GeoCoordinates = {
  latitude: 7.481843099892803,
  longitude: 5.741945337431659,
};
const toGoogleMapsPoint = ({ latitude, longitude }: GeoCoordinates): GoogleMapsPoint => ({
  lat: latitude,
  lng: longitude,
});
const authFailureEvent = "campus-voice-google-maps-auth-failure";

let googleMapsApiPromise: Promise<LoadedGoogleMaps> | undefined;

function loadGoogleMapsApi(apiKey: string): Promise<LoadedGoogleMaps> {
  const existingMaps = window.google?.maps;
  if (existingMaps) {
    return Promise.resolve({ maps: existingMaps });
  }
  if (googleMapsApiPromise) {
    return googleMapsApiPromise;
  }

  googleMapsApiPromise = new Promise<LoadedGoogleMaps>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = (message: string) => {
      window.clearTimeout(timeout);
      reject(new Error(message));
    };
    const timeout = window.setTimeout(
      () => fail("Timed out while loading Google Maps. Check your connection and API key."),
      15000,
    );

    window.__campusVoiceMapsReady = () => {
      const maps = window.google?.maps;
      if (!maps) {
        fail("Google Maps loaded without its map API.");
        return;
      }
      window.clearTimeout(timeout);
      resolve({ maps });
    };
    window.gm_authFailure = () => {
      window.dispatchEvent(new Event(authFailureEvent));
      fail(
        "Google Maps rejected the key. Enable Maps JavaScript API, enable billing, and allow this website in the key's referrer restrictions.",
      );
    };

    const params = new URLSearchParams({
      key: apiKey,
      callback: "__campusVoiceMapsReady",
      loading: "async",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () =>
      fail("Could not load Google Maps. Check your internet connection and API key.");
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    googleMapsApiPromise = undefined;
    throw error;
  });

  return googleMapsApiPromise;
}

export function GoogleRouteMap({
  destination,
  currentLocation,
  currentCoordinate,
  routeWaypoints,
  mode = "preview",
  showBadge = true,
}: GoogleRouteMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapsMap | null>(null);
  const routeLineRef = useRef<GoogleMapsPolyline | null>(null);
  const mapsApiRef = useRef<LoadedGoogleMaps | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const origin = currentCoordinate ?? routeWaypoints?.[0];

  useEffect(() => {
    let cancelled = false;
    const handleAuthFailure = () => {
      setMapError(
        "Google Maps rejected the key. Enable Maps JavaScript API, enable billing, and allow this website in the key's referrer restrictions.",
      );
    };

    window.addEventListener(authFailureEvent, handleAuthFailure);

    if (!googleMapsApiKey) {
      setMapError("Google Maps API key is not configured.");
    } else {
      setMapError("");
      void loadGoogleMapsApi(googleMapsApiKey)
        .then((loadedMaps) => {
          if (cancelled || !mapElementRef.current) {
            return;
          }
          mapsApiRef.current = loadedMaps;
          mapRef.current = new loadedMaps.maps.Map(mapElementRef.current, {
            center: toGoogleMapsPoint(origin ?? defaultCenter),
            zoom: 16,
            mapTypeId: "satellite",
            mapId: googleMapsMapId,
            restriction: {
              latLngBounds: AAUA_CAMPUS_BOUNDS,
              strictBounds: true,
            },
          });
          setIsMapReady(true);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setMapError(
              error instanceof Error ? error.message : "Unable to load Google Maps.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener(authFailureEvent, handleAuthFailure);
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      mapsApiRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const loadedMaps = mapsApiRef.current;
    if (!isMapReady || !map || !loadedMaps) {
      return;
    }

    const { maps } = loadedMaps;
    const routePoints = routeWaypoints?.map(toGoogleMapsPoint);
    if (routeWaypoints && routeWaypoints.length > 1) {
      if (!routeLineRef.current) {
        routeLineRef.current = new maps.Polyline({
          map,
          path: routePoints ?? [],
          strokeColor: "#0891b2",
          strokeOpacity: 0.95,
          strokeWeight: 6,
        });
      } else {
        routeLineRef.current.setPath(routePoints ?? []);
      }

      if (mode === "preview") {
        const bounds = new maps.LatLngBounds();
        routePoints?.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds);
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }

    if (origin) {
      const mapOrigin = toGoogleMapsPoint(origin);
      if (mode === "active" || !routeWaypoints?.length) {
        map.panTo(mapOrigin);
      }
    }
  }, [
    isMapReady,
    mode,
    origin,
    routeWaypoints,
  ]);

  return (
    <View
      style={styles.root}
      accessibilityLabel={`Google Maps route from ${currentLocation} to ${destination}`}
    >
      {createElement("div", {
        ref: mapElementRef,
        role: "img",
        "aria-label": "Google map",
        style: {
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: "100%",
          height: "100%",
        },
      })}
      {!!mapError && <Text style={styles.message}>{mapError}</Text>}
      {!mapError && !isMapReady && (
        <Text style={styles.message}>Loading Google Maps...</Text>
      )}
      {showBadge && (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>Google Maps</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: "#121826",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    position: "absolute",
    zIndex: 1,
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  badgeText: {
    color: "#cbd5e1",
    fontSize: 11,
  },
});
