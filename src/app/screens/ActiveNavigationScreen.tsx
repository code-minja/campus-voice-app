import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EyeOff,
  Mic,
  Volume2,
  X,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  MapPin,
} from "lucide-react-native";
import type { LatLng } from "react-native-maps";
import { GoogleRouteMap } from "../components/GoogleRouteMap";
import { VoiceButton } from "../components/VoiceButton";
import {
  fetchRouteFromBackend,
  getPreviewRoute,
  type RoutePayload,
} from "../services/navigationRoute";
import type { GeoCoordinates } from "../types";
import { speakToUser, clearSpeechQueue, prefetchAudio } from "../services/voiceFeedback";
import { getDirectionIcon, cleanAccessibilityInstruction } from "./RoutePreviewScreen";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../types";
import {
  estimateRemainingDurationSeconds,
  measureRouteProgress,
  NAVIGATION_TRACKING_CONFIG,
} from "../services/routeTracking";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";

type ActiveNavigationScreenProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  locationAccuracyMeters?: number;
  onEndNavigation: () => void;
  onSwitchToVoiceOnly: () => void;
};
const METERS_TO_FEET = 3.28084;
const METERS_PER_STEP = 0.75;

function formatDistanceInFeet(meters: number): string {
  const feet = Math.max(1, Math.round(meters * METERS_TO_FEET));
  return `${feet} ft`;
}

function formatFootstepsAndMeters(meters: number): string {
  const safeMeters = Math.max(0, Math.round(meters));
  const footsteps = Math.max(1, Math.round(safeMeters / METERS_PER_STEP));
  return `${footsteps} footsteps (${safeMeters}m)`;
}

function formatArrivalTime(
  routeDurationSeconds: number | undefined,
  remainingMeters: number,
  routeDistanceMeters: number | undefined,
  now: Date,
): string {
  if (
    !routeDurationSeconds ||
    routeDurationSeconds <= 0 ||
    !routeDistanceMeters ||
    routeDistanceMeters <= 0
  ) {
    return "--";
  }

  const remainingDuration = Math.ceil(
    routeDurationSeconds *
      Math.min(1, Math.max(0, remainingMeters / routeDistanceMeters)),
  );
  return new Date(now.getTime() + remainingDuration * 1000).toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" },
  );
}

function toMeters(a: GeoCoordinates, b: { latitude: number; longitude: number }): number {
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

export function ActiveNavigationScreen({
  destination,
  currentLocation,
  currentCoordinate,
  locationAccuracyMeters,
  onEndNavigation,
  onSwitchToVoiceOnly,
}: ActiveNavigationScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isListening, handleVoicePress } = useVoiceNavigation({
    onStartVoiceNavigation: (nextDestination) => {
      navigation.navigate("RoutePreview", { destination: nextDestination });
    },
  });
  const [routePayload, setRoutePayload] = useState<RoutePayload | null>(null);
  const [routeLoadError, setRouteLoadError] = useState("");
  const [routeRetryCount, setRouteRetryCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const routeRequestRef = useRef({ destination: "", started: false });
  const isMountedRef = useRef(true);
  const offRouteReadingsRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const lastAnnouncedRemainingRef = useRef<number | undefined>(undefined);
  const hasAnnouncedArrivalRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [showStepsList, setShowStepsList] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const lastSpokenStepIndex = useRef<number>(-1);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const destinationCoordinateOverride = useMemo<LatLng | undefined>(() => {
    const coordinate = routePayload?.destination?.coordinate;
    if (!coordinate) return undefined;
    return {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  }, [routePayload]);

  // Compute polyline metrics
  const segmentDistances = useMemo(() => {
    if (!routePayload?.route_preview || routePayload.route_preview.length < 2) {
      return [];
    }
    const dists = [0];
    let acc = 0;
    for (let i = 0; i < routePayload.route_preview.length - 1; i++) {
      const d = toMeters(routePayload.route_preview[i], routePayload.route_preview[i + 1]);
      acc += d;
      dists.push(acc);
    }
    return dists;
  }, [routePayload]);

  const totalDistance = useMemo(() => {
    if (segmentDistances.length === 0) return 0;
    return segmentDistances[segmentDistances.length - 1];
  }, [segmentDistances]);

  const activeCoordinate = useMemo(() => {
    return currentCoordinate ?? routePayload?.origin;
  }, [currentCoordinate, routePayload?.origin]);

  const measuredRouteProgress = useMemo(() => {
    if (!activeCoordinate || !routePayload?.route_preview?.length) {
      return undefined;
    }
    return measureRouteProgress(activeCoordinate, routePayload.route_preview);
  }, [activeCoordinate, routePayload?.route_preview]);

  // Update the current instruction based on the live GPS location.
  useEffect(() => {
    if (!routePayload?.steps?.length || !activeCoordinate) {
      return;
    }

    let nearestIdx = currentStepIndex;
    let nearestDist = Number.POSITIVE_INFINITY;
    routePayload.steps.forEach((step, idx) => {
      if (idx < currentStepIndex) {
        return;
      }
      const d = toMeters(activeCoordinate, step.waypoint);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    if (
      nearestIdx > currentStepIndex &&
      toMeters(
        activeCoordinate,
        routePayload.steps[currentStepIndex].waypoint,
      ) < NAVIGATION_TRACKING_CONFIG.stepAnnouncementDistanceMeters
    ) {
      setCurrentStepIndex(nearestIdx);
    }
  }, [activeCoordinate, routePayload, currentStepIndex]);

  // Voice steps guidance
  useEffect(() => {
    if (!routePayload?.steps || currentStepIndex < 0 || currentStepIndex >= routePayload.steps.length) {
      return;
    }
    if (currentStepIndex !== lastSpokenStepIndex.current) {
      const step = routePayload.steps[currentStepIndex];
      const cleanInstruction = cleanAccessibilityInstruction(step.instruction);
      void speakToUser(cleanInstruction);
      lastSpokenStepIndex.current = currentStepIndex;

      routePayload.steps
        .slice(currentStepIndex + 1, currentStepIndex + 3)
        .forEach((nextStep) =>
          void prefetchAudio(
            cleanAccessibilityInstruction(nextStep.instruction),
          ),
        );
    }
  }, [currentStepIndex, routePayload]);

  useEffect(() => {
    if (!routePayload || !measuredRouteProgress || routePayload.simulated) {
      lastAnnouncedRemainingRef.current = undefined;
      return;
    }

    const remaining = measuredRouteProgress.remainingMeters;
    const previous = lastAnnouncedRemainingRef.current;
    if (previous === undefined) {
      lastAnnouncedRemainingRef.current = remaining;
    } else if (
      previous - remaining >=
      NAVIGATION_TRACKING_CONFIG.announcementIntervalMeters
    ) {
      lastAnnouncedRemainingRef.current = remaining;
      void speakToUser(
        `About ${Math.max(0, Math.round(remaining))} meters remain to ${destination}.`,
      );
    }
  }, [destination, measuredRouteProgress, routePayload]);

  // Arrival detection uses the live GPS location.
  useEffect(() => {
    if (
      !routePayload ||
      !activeCoordinate ||
      !destinationCoordinateOverride ||
      routePayload.simulated ||
      locationAccuracyMeters === undefined ||
      locationAccuracyMeters > NAVIGATION_TRACKING_CONFIG.maxGpsAccuracyMeters ||
      hasAnnouncedArrivalRef.current
    ) {
      return;
    }
    const dist = toMeters(activeCoordinate, destinationCoordinateOverride);
    if (dist < NAVIGATION_TRACKING_CONFIG.arrivalRadiusMeters) {
      hasAnnouncedArrivalRef.current = true;
      void speakToUser(`You have arrived at your destination, ${destination}.`);
      navigation.replace("Arrival", {
        destination,
        durationSeconds: routePayload.estimated_duration_seconds,
        distanceMeters: totalDistance,
      });
    }
  }, [activeCoordinate, routePayload, destinationCoordinateOverride, destination, totalDistance, navigation, locationAccuracyMeters]);

  // Find the minimum distance to any point on the route polyline
  const distanceToRoute = useMemo(() => {
    return measuredRouteProgress?.distanceToRouteMeters ?? 0;
  }, [measuredRouteProgress]);

  // Handle route deviation recalculation
  const isRecalculatingRef = useRef(false);
  useEffect(() => {
    if (
      routePayload?.simulated ||
      !activeCoordinate ||
      !routePayload ||
      locationAccuracyMeters === undefined ||
      locationAccuracyMeters > NAVIGATION_TRACKING_CONFIG.maxGpsAccuracyMeters
    ) {
      offRouteReadingsRef.current = 0;
      return;
    }

    if (distanceToRoute <= NAVIGATION_TRACKING_CONFIG.offRouteThresholdMeters) {
      offRouteReadingsRef.current = 0;
      return;
    }

    offRouteReadingsRef.current += 1;
    const now = Date.now();
    if (
      offRouteReadingsRef.current >=
        NAVIGATION_TRACKING_CONFIG.offRouteConfirmations &&
      !isRecalculatingRef.current &&
      now - lastRerouteAtRef.current >= 5000
    ) {
      offRouteReadingsRef.current = 0;
      isRecalculatingRef.current = true;
      lastRerouteAtRef.current = now;
      void (async () => {
        const requestStartedAt = Date.now();
        try {
          void speakToUser(`You are off route. Recalculating a path to ${destination}.`);
          const newPayload = await fetchRouteFromBackend(activeCoordinate, destination);
          if (
            isMountedRef.current &&
            routeRequestRef.current.destination === destination
          ) {
            setRoutePayload(newPayload);
            setCurrentStepIndex(0);
            lastSpokenStepIndex.current = -1;
            lastAnnouncedRemainingRef.current = undefined;
          }
          const elapsedMilliseconds = Date.now() - requestStartedAt;
          console.info("[navigation] reroute completed", {
            duration_ms: elapsedMilliseconds,
            target_ms: NAVIGATION_TRACKING_CONFIG.rerouteTargetMilliseconds,
            within_target:
              elapsedMilliseconds <=
              NAVIGATION_TRACKING_CONFIG.rerouteTargetMilliseconds,
          });
        } catch (err) {
          console.warn("[navigation] reroute failed", {
            duration_ms: Date.now() - requestStartedAt,
            error: err instanceof Error ? err.message : "Unknown reroute error",
          });
          if (
            isMountedRef.current &&
            routeRequestRef.current.destination === destination
          ) {
            void speakToUser(
              "I couldn't recalculate the route. I will try again when your location updates.",
            );
          }
        } finally {
          isRecalculatingRef.current = false;
        }
      })();
    }
  }, [distanceToRoute, activeCoordinate, destination, routePayload, locationAccuracyMeters]);

  useEffect(() => {
    return () => clearSpeechQueue();
  }, []);

  const mapRouteWaypoints = useMemo<LatLng[] | undefined>(() => {
    if (!routePayload?.route_preview?.length || !activeCoordinate) {
      return undefined;
    }

    // Find the index of the nearest point in route_preview to activeCoordinate
    let nearestIdx = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    routePayload.route_preview.forEach((point, idx) => {
      const d = toMeters(activeCoordinate, point);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    // Slice the remaining waypoints
    const remaining = routePayload.route_preview.slice(nearestIdx + 1).map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));

    return [
      { latitude: activeCoordinate.latitude, longitude: activeCoordinate.longitude },
      ...remaining
    ];
  }, [routePayload, activeCoordinate]);

  const mapOriginCoordinate = activeCoordinate;
  const mapCurrentLocation = currentLocation;



  const routeProgress = useMemo(() => {
    if (!routePayload?.steps?.length || !activeCoordinate) {
      return {
        currentStepInstruction: routeLoadError
          ? "Route unavailable"
          : "Loading live Google route...",
        distanceToNextMeters: 0,
        remainingMeters: routePayload?.total_distance_meters ?? 0,
      };
    }

    const nextStep = routePayload.steps[currentStepIndex];
    const distanceToNextMeters = nextStep ? toMeters(activeCoordinate, nextStep.waypoint) : 0;
    const remainingMeters =
      distanceToNextMeters +
      routePayload.steps
        .slice(currentStepIndex + 1)
        .reduce((sum, step) => sum + step.distance_meters, 0);
    const cleanInstruction = nextStep ? cleanAccessibilityInstruction(nextStep.instruction) : "Arriving...";

    return {
      currentStepInstruction: cleanInstruction,
      distanceToNextMeters,
      remainingMeters,
    };
  }, [activeCoordinate, currentStepIndex, routeLoadError, routePayload]);

  useEffect(() => {
    if (routeRequestRef.current.destination !== destination) {
      routeRequestRef.current = { destination, started: false };
      setRoutePayload(null);
      setRouteLoadError("");
      setCurrentStepIndex(0);
      lastSpokenStepIndex.current = -1;
      offRouteReadingsRef.current = 0;
      lastRerouteAtRef.current = 0;
      lastAnnouncedRemainingRef.current = undefined;
      hasAnnouncedArrivalRef.current = false;
    }

    if (!destination.trim()) {
      return;
    }
    if (!currentCoordinate || routeRequestRef.current.started) {
      return;
    }
    routeRequestRef.current.started = true;

    void (async () => {
      try {
        setRouteLoadError("");
        const payload =
          (routeRetryCount === 0 ? getPreviewRoute(destination) : null) ??
          (await fetchRouteFromBackend(currentCoordinate, destination));
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          setRoutePayload(payload);
        }
      } catch (error) {
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          routeRequestRef.current.started = false;
          const message =
            error instanceof Error ? error.message : "Unable to load route";
          setRouteLoadError(message);
          void speakToUser(message);
        }
      }
    })();
  }, [
    currentCoordinate?.latitude,
    currentCoordinate?.longitude,
    destination,
    routeRetryCount,
  ]);

  return (
    <View style={styles.root}>
      <GoogleRouteMap
        destination={destination}
        currentLocation={mapCurrentLocation}
        currentCoordinate={mapOriginCoordinate}
        routeWaypoints={mapRouteWaypoints}
        mode="active"
        showBadge={false}
      />

      <SafeAreaView
        style={styles.safeArea}
        edges={["left", "right"]}
        pointerEvents="box-none"
      >
        <View style={[styles.topWrap, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.locationHintWrap}>
            <View style={styles.locationDot} />
            <Text style={styles.locationHintText}>{mapCurrentLocation}</Text>
          </View>

          <View style={styles.destinationBar}>
            <View>
              <Text style={styles.destinationLabel}>Navigating to</Text>
              <Text style={styles.destinationValue}>{destination}</Text>
            </View>
            <View>
              <Text style={styles.destinationLabel}>ETA</Text>
              <Text style={styles.etaValue}>
                {formatArrivalTime(
                  routePayload?.estimated_duration_seconds,
                  routeProgress.remainingMeters,
                  routePayload?.total_distance_meters,
                  currentTime,
                )}
              </Text>
            </View>
          </View>

          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <View style={styles.distanceBadge}>
                <View style={styles.distanceDot} />
                <Text style={styles.distanceText}>
                  {formatFootstepsAndMeters(
                    routeProgress.distanceToNextMeters || routeProgress.remainingMeters,
                  )}
                </Text>
              </View>
              {!!routePayload?.steps?.length && (
                <Pressable
                  onPress={() => setShowStepsList(!showStepsList)}
                  style={styles.expandStepsButton}
                >
                  <Text style={styles.expandStepsButtonText}>
                    {showStepsList ? "Hide steps" : "View steps"}
                  </Text>
                  {showStepsList ? (
                    <ChevronUp size={14} color="#22d3ee" />
                  ) : (
                    <ChevronDown size={14} color="#22d3ee" />
                  )}
                </Pressable>
              )}
            </View>
            <Text style={styles.instructionText}>{routeProgress.currentStepInstruction}</Text>
            {!!routeLoadError && (
              <Pressable
                onPress={() => setRouteRetryCount((count) => count + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry loading route"
              >
                <Text style={styles.routeErrorText}>
                  {routeLoadError} Tap to retry.
                </Text>
              </Pressable>
            )}

            {showStepsList && routePayload?.steps && (
              <ScrollView
                style={styles.stepsScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                <View style={styles.stepsDivider} />
                {routePayload.steps.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isPassed = idx < currentStepIndex;
                  const { Icon, color } = getDirectionIcon(step.instruction, idx === routePayload.steps.length - 1);
                  return (
                    <View key={idx} style={[styles.stepItemRow, isCurrent && styles.stepItemRowActive]}>
                      <View style={styles.stepIconWrap}>
                        <Icon size={14} color={isCurrent ? "#22d3ee" : isPassed ? "#475569" : "#cbd5e1"} />
                      </View>
                      <View style={styles.stepTextWrap}>
                        <Text style={[
                          styles.stepInstructionText,
                          isCurrent && styles.stepInstructionTextActive,
                          isPassed && styles.stepInstructionTextPassed
                        ]}>
                          {cleanAccessibilityInstruction(step.instruction)}
                        </Text>
                        <Text style={styles.stepDistanceText}>
                          {formatDistanceInFeet(step.distance_meters)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

        </View>

        <View style={styles.voiceActiveBadge}>
          <Volume2 size={14} color="#22d3ee" />
          <View style={styles.voiceBarsWrap}>
            <View style={styles.voiceBar} />
            <View style={[styles.voiceBar, styles.voiceBarTall]} />
            <View style={styles.voiceBar} />
            <View style={[styles.voiceBar, styles.voiceBarTall]} />
          </View>
          <Text style={styles.voiceActiveText}>Voice guidance active</Text>
        </View>

        <View style={[styles.bottomControls, { paddingBottom: 12 + Math.max(insets.bottom, 8) }]}>
          <Pressable onPress={onEndNavigation} style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}>
            <X size={18} color="#f87171" />
            <Text style={styles.endButtonText}>End</Text>
          </Pressable>

          <VoiceButton
            isListening={isListening}
            onPress={handleVoicePress}
            accessibilityLabel={isListening ? "Listening, tap to stop" : "Speak a new destination"}
            size={72}
            iconSize={28}
          />

          <Pressable
            onPress={onSwitchToVoiceOnly}
            style={({ pressed }) => [styles.voiceOnlyButton, pressed && styles.pressed]}
          >
            <EyeOff size={18} color="#60a5fa" />
            <Text style={styles.voiceOnlyText}>Voice Only</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 18,
  },
  topWrap: {
    zIndex: 5,
  },
  locationHintWrap: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#60a5fa",
  },
  locationHintText: {
    fontSize: 12,
    color: "#64748b",
  },
  destinationBar: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  destinationLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  destinationValue: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 15,
  },
  etaValue: {
    marginTop: 2,
    color: "#22d3ee",
    fontSize: 15,
    textAlign: "right",
  },
  instructionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.4)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  instructionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  expandStepsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  expandStepsButtonText: {
    color: "#22d3ee",
    fontSize: 12,
    fontWeight: "600",
  },
  stepsScroll: {
    maxHeight: 180,
    marginTop: 8,
  },
  stepsDivider: {
    height: 1,
    backgroundColor: "rgba(51, 65, 85, 0.5)",
    marginVertical: 10,
  },
  stepItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  stepItemRowActive: {
    backgroundColor: "rgba(34, 211, 238, 0.08)",
  },
  stepIconWrap: {
    width: 24,
    alignItems: "center",
    marginTop: 2,
  },
  stepTextWrap: {
    flex: 1,
    marginLeft: 8,
  },
  stepInstructionText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  stepInstructionTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  stepInstructionTextPassed: {
    color: "#475569",
    textDecorationLine: "line-through",
  },
  stepDistanceText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  distanceBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  distanceDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
  },
  distanceText: {
    color: "#67e8f9",
    fontSize: 13,
  },
  instructionText: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  routeErrorText: {
    marginTop: 8,
    color: "#fca5a5",
    fontSize: 13,
  },
  voiceActiveBadge: {
    marginTop: "auto",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.5)",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceBarsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voiceBar: {
    width: 3,
    height: 9,
    borderRadius: 4,
    backgroundColor: "#22d3ee",
  },
  voiceBarTall: {
    height: 14,
  },
  voiceActiveText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  bottomControls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 10,
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    borderRadius: 14,
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  endButtonText: {
    color: "#f87171",
    fontSize: 15,
    fontWeight: "500",
  },
  voiceOnlyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.5)",
    borderRadius: 14,
    backgroundColor: "rgba(30, 64, 175, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voiceOnlyText: {
    color: "#60a5fa",
    fontSize: 15,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
});
