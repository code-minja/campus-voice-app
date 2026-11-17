import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MapView, { LatLng, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Navigation } from "lucide-react-native";
import type { GeoCoordinates } from "../types";
import { getCampusLocations, type CampusLocation } from "../services/campusLocations";
import { AAUA_CAMPUS_BOUNDS } from "./campusMapBounds";

type GoogleRouteMapProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  routeWaypoints?: LatLng[];
  mode?: "preview" | "active";
  showBadge?: boolean;
};

const fallbackStartCoordinate: LatLng = {
  latitude: 7.481843099892803,
  longitude: 5.741945337431659,
};

function getBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const lon1 = (from.longitude * Math.PI) / 180;
  const lon2 = (to.longitude * Math.PI) / 180;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function getRegionFromRoute(points: LatLng[]) {
  const lats = points.map((item) => item.latitude);
  const lngs = points.map((item) => item.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.4, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 2.4, 0.008),
  };
}

// The preview sheet covers the lower part of the screen and the header the top,
// so the route is fitted into the space that is actually visible.
const PREVIEW_EDGE_PADDING = { top: 120, right: 100, bottom: 300, left: 100 };

function getPreviewCamera(
  points: LatLng[],
  heading: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;

  // Convert latitude span to "equator degrees" so both spans share the same
  // pixel scale in Web Mercator (this campus is close to the equator).
  const latScale = 1 / Math.max(Math.cos((midLat * Math.PI) / 180), 0.01);
  const widthDeg = Math.max(maxLng - minLng, 0.0001);
  const heightDeg = Math.max((maxLat - minLat) * latScale, 0.0001);

  // Account for the preview heading: rotating the route grows the axis-aligned
  // area that has to fit on screen.
  const radians = (heading * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotatedWidth = widthDeg * cos + heightDeg * sin;
  const rotatedHeight = widthDeg * sin + heightDeg * cos;

  const availableWidth = Math.max(
    viewportWidth - PREVIEW_EDGE_PADDING.left - PREVIEW_EDGE_PADDING.right,
    120,
  );
  const availableHeight = Math.max(
    viewportHeight - PREVIEW_EDGE_PADDING.top - PREVIEW_EDGE_PADDING.bottom,
    120,
  );

  // At zoom z, one degree spans (256 * 2^z) / 360 pixels.
  const zoomForWidth = Math.log2((availableWidth * 360) / (256 * rotatedWidth));
  const zoomForHeight = Math.log2((availableHeight * 360) / (256 * rotatedHeight));
  const zoom = Math.min(
    Math.min(zoomForWidth, zoomForHeight) - 0.25,
    20,
  );

  return {
    center: { latitude: midLat, longitude: (minLng + maxLng) / 2 },
    zoom: Math.max(zoom, 12),
  };
}

export function GoogleRouteMap({
  currentCoordinate,
  routeWaypoints,
  mode = "preview",
  showBadge = true,
}: GoogleRouteMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const routeOrigin = useMemo<LatLng | undefined>(
    () =>
      currentCoordinate ?? routeWaypoints?.[0],
    [currentCoordinate, routeWaypoints],
  );

  const startCoordinate = routeOrigin ?? fallbackStartCoordinate;
  const routeCoordinates = useMemo(
    () => routeWaypoints && routeWaypoints.length >= 2
      ? routeWaypoints
      : [startCoordinate],
    [routeWaypoints, startCoordinate],
  );

  const region = useMemo(() => getRegionFromRoute(routeCoordinates), [routeCoordinates]);

  const [isUserTracking, setIsUserTracking] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>([]);
  const [locationsError, setLocationsError] = useState("");
  const prevCoordRef = useRef<GeoCoordinates | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getCampusLocations().then((locations) => {
      if (!cancelled) {
        setCampusLocations(locations);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setLocationsError(
          error instanceof Error ? error.message : "Unable to load campus locations.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentCoordinate && prevCoordRef.current) {
      const prev = prevCoordRef.current;
      const dist = Math.sqrt(
        Math.pow(currentCoordinate.latitude - prev.latitude, 2) +
        Math.pow(currentCoordinate.longitude - prev.longitude, 2)
      );
      if (dist > 0.000005) {
        const bearing = getBearing(prev, {
          latitude: currentCoordinate.latitude,
          longitude: currentCoordinate.longitude,
        });
        setCurrentHeading(bearing);
      }
    }
    prevCoordRef.current = currentCoordinate;
  }, [currentCoordinate]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    mapRef.current.setMapBoundaries(
      {
        latitude: AAUA_CAMPUS_BOUNDS.north,
        longitude: AAUA_CAMPUS_BOUNDS.east,
      },
      {
        latitude: AAUA_CAMPUS_BOUNDS.south,
        longitude: AAUA_CAMPUS_BOUNDS.west,
      },
    );
  }, [isMapReady]);

  const previewHeading = useMemo(() => {
    if (routeCoordinates.length >= 2) {
      return getBearing(routeCoordinates[0], routeCoordinates[1]);
    }
    return 0;
  }, [routeCoordinates]);

  const fitRouteInView = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map || routeCoordinates.length < 2) {
        return;
      }

      // One camera update keeps the fitted zoom and the preview heading in
      // sync. Two separate animations race and can restore the pre-fit zoom.
      const camera = getPreviewCamera(
        routeCoordinates,
        previewHeading,
        viewportWidth,
        viewportHeight,
      );
      map.animateCamera(
        { ...camera, heading: previewHeading, pitch: 0 },
        // animateCamera maps duration 0 to 500 ms internally, so use 1 ms
        // when a snap is wanted.
        { duration: animated ? 350 : 1 },
      );
    },
    [routeCoordinates, previewHeading, viewportWidth, viewportHeight],
  );

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    if (mode === "active" && currentCoordinate) {
      if (isUserTracking) {
        mapRef.current.animateCamera({
          center: {
            latitude: currentCoordinate.latitude,
            longitude: currentCoordinate.longitude,
          },
          heading: currentHeading,
          pitch: 45, // 3D tilt perspective
          zoom: 19, // Close-up detail
        }, { duration: 150 });
      }
      return;
    }

    if (mode === "preview" && !isUserTracking) {
      return;
    }

    if (mode === "preview" && routeCoordinates.length >= 2) {
      fitRouteInView(true);
      return;
    }

    if (mode === "preview") {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: startCoordinate.latitude,
            longitude: startCoordinate.longitude,
          },
          heading: previewHeading,
          pitch: 0,
          zoom: 17,
        },
        { duration: 300 },
      );
    }
  }, [
    currentCoordinate,
    mode,
    routeCoordinates,
    currentHeading,
    isUserTracking,
    isMapReady,
    fitRouteInView,
    previewHeading,
    startCoordinate,
  ]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        mapType="satellite"
        minZoomLevel={12}
        maxZoomLevel={20}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={false}
        showsBuildings
        showsIndoors
        toolbarEnabled={Platform.OS === "android"}
        onMapReady={() => setIsMapReady(true)}
        onRegionChangeComplete={(r, details) => {
          if (details?.isGesture) {
            setIsUserTracking(false);
          }
        }}
      >
        {campusLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            title={location.name}
            tracksViewChanges={false}
          >
            <View style={styles.locationMarker}>
              <View style={styles.locationLabel}>
                <Text numberOfLines={1} style={styles.locationLabelText}>
                  {location.name}
                </Text>
              </View>
              <View style={styles.locationPointer} />
            </View>
          </Marker>
        ))}
        {routeWaypoints && routeWaypoints.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={mode === "active" ? 7 : 6}
            strokeColor="#22d3ee"
            lineCap="round"
            lineJoin="round"
          />
        )}

      </MapView>

      <View pointerEvents="none" style={styles.mapOverlayTop} />
      {!!locationsError && (
        <View style={styles.locationError}>
          <Text style={styles.locationErrorText}>
            Campus labels unavailable: {locationsError}
          </Text>
        </View>
      )}
      <View
        pointerEvents="none"
        style={[
          styles.mapOverlayBottom,
          mode === "active" && styles.mapOverlayBottomActive,
        ]}
      />

      {!isUserTracking && (
        <Pressable
          style={styles.recenterButton}
          onPress={() => {
            setIsUserTracking(true);
            if (!mapRef.current) return;

            if (mode === "active" && currentCoordinate) {
              mapRef.current.animateCamera(
                {
                  center: {
                    latitude: currentCoordinate.latitude,
                    longitude: currentCoordinate.longitude,
                  },
                  heading: currentHeading,
                  pitch: 45,
                  zoom: 19,
                },
                { duration: 250 },
              );
              return;
            }

            if (routeCoordinates.length >= 2) {
              fitRouteInView(true);
              return;
            }

            mapRef.current.animateCamera(
              {
                center: {
                  latitude: startCoordinate.latitude,
                  longitude: startCoordinate.longitude,
                },
                heading: previewHeading,
                pitch: 0,
                zoom: 17,
              },
              { duration: 250 },
            );
          }}
        >
          <Navigation size={13} color="#22d3ee" fill="#22d3ee" style={styles.recenterIcon} />
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      )}

      {showBadge && (
        <View pointerEvents="none" style={styles.googleBadge}>
          <Text style={styles.googleBadgeText}>Google Maps</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0f172a",
  },
  mapOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(2, 6, 23, 0.12)",
  },
  locationLabel: {
    maxWidth: 180,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.75)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
  },
  locationMarker: {
    alignItems: "center",
  },
  locationLabelText: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: "700",
  },
  locationPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(34, 211, 238, 0.95)",
  },
  locationError: {
    position: "absolute",
    top: 42,
    right: 12,
    maxWidth: "80%",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(127, 29, 29, 0.9)",
  },
  locationErrorText: {
    color: "#fee2e2",
    fontSize: 11,
  },
  mapOverlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: "rgba(2, 6, 23, 0.08)",
  },
  mapOverlayBottomActive: {
    height: 160,
    backgroundColor: "rgba(2, 6, 23, 0.12)",
  },
  googleBadge: {
    position: "absolute",
    right: 12,
    top: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },
  googleBadgeText: {
    color: "#cbd5e1",
    fontSize: 11,
  },
  recenterButton: {
    position: "absolute",
    bottom: 234,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.4)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterIcon: {
    transform: [{ rotate: "45deg" }],
  },
  recenterText: {
    color: "#22d3ee",
    fontSize: 12,
    fontWeight: "600",
  },
});
