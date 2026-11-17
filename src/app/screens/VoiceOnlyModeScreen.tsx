import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, Smartphone, Square } from "lucide-react-native";
import { speakToUser, clearSpeechQueue, prefetchAudio } from "../services/voiceFeedback";
import { cleanAccessibilityInstruction } from "./RoutePreviewScreen";
import {
  fetchRouteFromBackend,
  getPreviewRoute,
  type RoutePayload,
} from "../services/navigationRoute";
import type { GeoCoordinates } from "../types";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../types";
import {
  measureRouteProgress,
  NAVIGATION_TRACKING_CONFIG,
} from "../services/routeTracking";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";

type VoiceState = "listening" | "speaking" | "idle";

type VoiceOnlyModeScreenProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  locationAccuracyMeters?: number;
  onEndNavigation: () => void;
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

export function VoiceOnlyModeScreen({
  destination,
  currentLocation,
  currentCoordinate,
  locationAccuracyMeters,
  onEndNavigation,
}: VoiceOnlyModeScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    isListening,
    transcript,
    handleVoicePress,
  } = useVoiceNavigation({
    onStartVoiceNavigation: (nextDestination) => {
      navigation.navigate("RoutePreview", { destination: nextDestination });
    },
  });
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [routePayload, setRoutePayload] = useState<RoutePayload | null>(null);
  const [routeLoadError, setRouteLoadError] = useState("");
  const [routeRetryCount, setRouteRetryCount] = useState(0);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const lastSpokenStepIndex = useRef<number>(-1);
  const speechSequenceRef = useRef(0);
  const isRecalculatingRef = useRef(false);
  const routeRequestRef = useRef({ destination: "", started: false });
  const isMountedRef = useRef(true);
  const offRouteReadingsRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const lastAnnouncedRemainingRef = useRef<number | undefined>(undefined);
  const hasAnnouncedArrivalRef = useRef(false);

  // Load route payload
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

    if (
      !destination.trim() ||
      !currentCoordinate ||
      routeRequestRef.current.started
    ) {
      return;
    }
    routeRequestRef.current.started = true;

    void (async () => {
      try {
        setRouteLoadError("");
        const payload =
          getPreviewRoute(destination) ??
          (await fetchRouteFromBackend(currentCoordinate, destination));
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          setRoutePayload(payload);
          void speakToUser(`Starting voice-only navigation to ${destination}.`);
        }
      } catch (err) {
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          routeRequestRef.current.started = false;
          const message =
            err instanceof Error ? err.message : "Failed to load route";
          setRouteLoadError(message);
          void speakToUser(message);
        }
      }
    })();
  }, [
    destination,
    currentCoordinate?.latitude,
    currentCoordinate?.longitude,
    routeRetryCount,
  ]);

  // Stop queued speech on unmount.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      speechSequenceRef.current += 1;
      clearSpeechQueue();
    };
  }, []);

  // Distance tracking calculations
  const segmentDistances = useMemo(() => {
    if (!routePayload?.route_preview?.length) {
      return [];
    }
    const dists: number[] = [];
    for (let i = 0; i < routePayload.route_preview.length - 1; i++) {
      dists.push(toMeters(routePayload.route_preview[i], routePayload.route_preview[i + 1]));
    }
    return dists;
  }, [routePayload]);

  const totalDistance = useMemo(() => {
    return segmentDistances.reduce((sum, d) => sum + d, 0);
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
      const speechSequence = ++speechSequenceRef.current;
      setVoiceState("speaking");
      void speakToUser(cleanInstruction).finally(() => {
        if (
          isMountedRef.current &&
          speechSequenceRef.current === speechSequence
        ) {
          setVoiceState("idle");
        }
      });
      lastSpokenStepIndex.current = currentStepIndex;

      // Prefetch next step audio
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
      !routePayload.destination.coordinate ||
      routePayload.simulated ||
      locationAccuracyMeters === undefined ||
      locationAccuracyMeters > NAVIGATION_TRACKING_CONFIG.maxGpsAccuracyMeters ||
      hasAnnouncedArrivalRef.current
    ) {
      return;
    }
    const destCoord = routePayload.destination.coordinate;
    const dist = toMeters(activeCoordinate, destCoord);
    if (dist < NAVIGATION_TRACKING_CONFIG.arrivalRadiusMeters) {
      hasAnnouncedArrivalRef.current = true;
      void speakToUser(`You have arrived at your destination, ${destination}.`);
      navigation.navigate("Arrival", {
        destination,
        durationSeconds: routePayload.estimated_duration_seconds,
        distanceMeters: totalDistance,
      });
    }
  }, [activeCoordinate, routePayload, destination, totalDistance, navigation, locationAccuracyMeters]);

  // Find minimum distance to check deviations
  const distanceToRoute = useMemo(() => {
    return measuredRouteProgress?.distanceToRouteMeters ?? 0;
  }, [measuredRouteProgress]);

  // Deviation rerouting
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

  const currentStep = routePayload?.steps?.[currentStepIndex];

  const statusText =
    voiceState === "speaking"
      ? "Speaking..."
      : voiceState === "listening"
        ? "Listening..."
        : "Voice Navigation Active";

  const subText =
    voiceState === "speaking"
      ? (currentStep ? cleanAccessibilityInstruction(currentStep.instruction) : `Guiding you to the ${destination}`)
      : voiceState === "listening"
        ? "Tell me what you need"
        : currentStep
          ? `Next: ${cleanAccessibilityInstruction(currentStep.instruction)}`
          : "Navigating...";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.inner, { paddingTop: Math.max(insets.top, 8), paddingBottom: 18 + Math.max(insets.bottom, 8) }]}>
          <View style={styles.spacer} />

          <View style={styles.mainCenter}>
            <Text style={styles.statusTitle}>
              {routeLoadError ? "Route unavailable" : statusText}
            </Text>
            <Text style={styles.statusSubtitle}>
              {routeLoadError || subText}
            </Text>
            {!!routeLoadError && (
              <Pressable
                onPress={() => setRouteRetryCount((count) => count + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry loading route"
              >
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            )}

            <View style={styles.indicatorWrap}>{renderStatusIndicator(voiceState)}</View>

            <Pressable
              onPress={handleVoicePress}
              accessibilityRole="button"
              accessibilityLabel={isListening ? "Listening, tap to stop" : "Speak a new destination"}
              style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}
            >
              <Mic size={28} color={isListening ? "#22d3ee" : "#94a3b8"} />
            </Pressable>
            <Text style={styles.micHint}>
              {isListening ? "Listening..." : transcript || "Speak a new destination"}
            </Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.lockHintWrap}>
              <Smartphone size={14} color="#64748b" />
              <Text style={styles.lockHintText}>Keep CampusVoice open for live voice directions.</Text>
            </View>

            <Pressable onPress={onEndNavigation} style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}>
              <Square size={18} color="#f87171" fill="#f87171" />
              <Text style={styles.stopButtonText}>Stop Navigation</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function renderStatusIndicator(state: VoiceState) {
  if (state === "speaking") {
    return (
      <View style={styles.waveGroup}>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <View key={`speak-wave-${index}`} style={[styles.waveLine, { height: [20, 44, 32, 62, 32, 44, 20][index] }]} />
        ))}
      </View>
    );
  }

  if (state === "listening") {
    return (
      <View style={styles.listenOuter}>
        <View style={styles.listenMiddle}>
          <View style={styles.listenInner} />
        </View>
      </View>
    );
  }

  return <View style={styles.idleCircle} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  inner: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  mainCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  statusSubtitle: {
    color: "#94a3b8",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 26,
    paddingHorizontal: 12,
  },
  indicatorWrap: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  waveGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  waveLine: {
    width: 8,
    borderRadius: 6,
    backgroundColor: "#22d3ee",
  },
  listenOuter: {
    width: 136,
    height: 136,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(34, 211, 238, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  listenMiddle: {
    width: 102,
    height: 102,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(34, 211, 238, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  listenInner: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
  },
  idleCircle: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: "rgba(100, 116, 139, 0.4)",
  },
  micButton: {
    marginTop: 20,
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(34, 211, 238, 0.4)",
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  micHint: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 12,
  },
  bottom: {
    marginTop: "auto",
    gap: 16,
  },
  lockHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  lockHintText: {
    color: "#94a3b8",
    fontSize: 13,
    flex: 1,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    borderRadius: 16,
    backgroundColor: "rgba(127, 29, 29, 0.18)",
    paddingVertical: 14,
    gap: 10,
  },
  stopButtonText: {
    color: "#f87171",
    fontSize: 22,
    fontWeight: "500",
  },
  retryText: {
    color: "#22d3ee",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
});
