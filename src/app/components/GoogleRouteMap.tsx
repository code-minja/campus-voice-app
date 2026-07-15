import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { LatLng, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Navigation } from "lucide-react-native";
import type { GeoCoordinates } from "../types";
import {
  getCampusLocations,
  type CampusLocation,
} from "../services/campusLocations";

type GoogleRouteMapProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  routeWaypoints?: LatLng[];
  destinationCoordinateOverride?: LatLng;
  mode?: "preview" | "active";
  showBadge?: boolean;
};

const fallbackStartCoordinate: LatLng = {
  latitude: 7.481843099892803,
  longitude: 5.741945337431659,
};

function coordinatesMatch(left: LatLng, right: LatLng) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.00001 &&
    Math.abs(left.longitude - right.longitude) < 0.00001
  );
}

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

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDestinationCoordinate(destination: string, start: LatLng): LatLng {
  const hash = hashString(destination);
  const latOffset = ((hash % 25) - 12) * 0.0007;
  const lngOffset = (((hash >> 3) % 25) - 12) * 0.0007;

  return {
    latitude: start.latitude + latOffset,
    longitude: start.longitude + lngOffset,
  };
}

function buildRouteCoordinates(start: LatLng, end: LatLng): LatLng[] {
  const midA: LatLng = {
    latitude: start.latitude + (end.latitude - start.latitude) * 0.35 + 0.0004,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.3,
  };

  const midB: LatLng = {
    latitude: start.latitude + (end.latitude - start.latitude) * 0.68,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.72 - 0.00025,
  };

  return [start, midA, midB, end];
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

export function GoogleRouteMap({
  destination,
  currentLocation,
  currentCoordinate,
  routeWaypoints,
  destinationCoordinateOverride,
  mode = "preview",
  showBadge = true,
}: GoogleRouteMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>([]);

  const startCoordinate = useMemo<LatLng>(
    () =>
      currentCoordinate
        ? {
            latitude: currentCoordinate.latitude,
            longitude: currentCoordinate.longitude,
          }
        : fallbackStartCoordinate,
    [currentCoordinate],
  );

  const destinationCoordinate = useMemo(() => {
    if (destinationCoordinateOverride) {
      return destinationCoordinateOverride;
    }
    return getDestinationCoordinate(destination, startCoordinate);
  }, [destinationCoordinateOverride, destination, startCoordinate]);
  const routeCoordinates = useMemo(
    () =>
      routeWaypoints && routeWaypoints.length >= 2
        ? routeWaypoints
        : buildRouteCoordinates(startCoordinate, destinationCoordinate),
    [destinationCoordinate, routeWaypoints, startCoordinate],
  );

  const region = useMemo(() => getRegionFromRoute(routeCoordinates), [routeCoordinates]);

  const [isUserTracking, setIsUserTracking] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0);
  const prevCoordRef = useRef<GeoCoordinates | undefined>(undefined);

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
    let cancelled = false;

    void getCampusLocations()
      .then((locations) => {
        if (!cancelled) {
          setCampusLocations(locations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampusLocations([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

    if (mode === "preview" && routeCoordinates && routeCoordinates.length >= 2) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 90, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }
  }, [currentCoordinate, mode, routeCoordinates, currentHeading, isUserTracking, isMapReady]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "web" ? undefined : PROVIDER_GOOGLE}
        initialRegion={region}
        mapType="standard"
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        showsUserLocation={!!currentCoordinate}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
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
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={mode === "active" ? 7 : 6}
          strokeColor="#22d3ee"
          lineCap="round"
          lineJoin="round"
        />

        <Marker coordinate={startCoordinate} title="Current location" description={currentLocation}>
          <View style={styles.userMarkerOuter}>
            <View style={styles.userMarkerInner} />
          </View>
        </Marker>

        <Marker
          coordinate={destinationCoordinate}
          title={destination}
          description="Destination"
          pinColor="#22d3ee"
        />

        {campusLocations.map((location) => {
          const markerCoordinate: LatLng = {
            latitude: location.latitude,
            longitude: location.longitude,
          };
          if (
            coordinatesMatch(markerCoordinate, startCoordinate) ||
            coordinatesMatch(markerCoordinate, destinationCoordinate)
          ) {
            return null;
          }

          return (
            <Marker
              key={location.id}
              coordinate={markerCoordinate}
              title={location.name}
              description={location.aliases.slice(0, 3).join(", ")}
              pinColor="#60a5fa"
            />
          );
        })}
      </MapView>

      <View pointerEvents="none" style={styles.mapOverlayTop} />
      <View
        pointerEvents="none"
        style={[
          styles.mapOverlayBottom,
          mode === "active" && styles.mapOverlayBottomActive,
        ]}
      />

      {mode === "active" && !isUserTracking && (
        <Pressable
          style={styles.recenterButton}
          onPress={() => {
            setIsUserTracking(true);
            if (currentCoordinate && mapRef.current) {
              mapRef.current.animateCamera({
                center: {
                  latitude: currentCoordinate.latitude,
                  longitude: currentCoordinate.longitude,
                },
                heading: currentHeading,
                pitch: 45,
                zoom: 19,
              }, { duration: 250 });
            }
          }}
        >
          <Navigation size={13} color="#22d3ee" fill="#22d3ee" style={styles.recenterIcon} />
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      )}

      {showBadge && (
        <View pointerEvents="none" style={styles.googleBadge}>
          <Text style={styles.googleBadgeText}>Google-style map</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a",
  },
  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.5)",
  },
  userMarkerInner: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
    borderWidth: 2,
    borderColor: "#ecfeff",
  },
  mapOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(2, 6, 23, 0.12)",
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
