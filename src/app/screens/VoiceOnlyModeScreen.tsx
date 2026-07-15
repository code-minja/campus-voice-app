import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, Smartphone, Square, Play, Pause, RotateCcw, ArrowLeft, ArrowRight } from "lucide-react-native";
import { speakToUser, clearSpeechQueue, prefetchAudio } from "../services/voiceFeedback";
import { cleanAccessibilityInstruction } from "./RoutePreviewScreen";
import { fetchRouteFromBackend, type RoutePayload } from "../services/navigationRoute";
import type { GeoCoordinates } from "../types";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../types";

type VoiceState = "listening" | "speaking" | "idle";

type VoiceOnlyModeScreenProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
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

function snapToRoute(coordinate: GeoCoordinates, polyline: { latitude: number; longitude: number }[]): GeoCoordinates {
  if (!polyline || polyline.length === 0) return coordinate;

  let nearestPoint = polyline[0];
  let minDistance = Number.POSITIVE_INFINITY;

  polyline.forEach((point) => {
    const d = toMeters(coordinate, point);
    if (d < minDistance) {
      minDistance = d;
      nearestPoint = point;
    }
  });

  if (minDistance < 25) {
    return {
      latitude: nearestPoint.latitude,
      longitude: nearestPoint.longitude,
    };
  }

  return coordinate;
}

export function VoiceOnlyModeScreen({
  destination,
  currentLocation,
  currentCoordinate,
  onEndNavigation,
}: VoiceOnlyModeScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [routePayload, setRoutePayload] = useState<RoutePayload | null>(null);
  const [routeLoadError, setRouteLoadError] = useState("");

  // Simulation tracking
  const [isSimulating, setIsSimulating] = useState(true);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [simulationSpeedMultiplier, setSimulationSpeedMultiplier] = useState(1);

  const lastSpokenStepIndex = useRef<number>(-1);
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isRecalculatingRef = useRef(false);

  // Load route payload
  useEffect(() => {
    let cancelled = false;
    if (!destination.trim()) return;

    void (async () => {
      try {
        setRouteLoadError("");
        const payload = await fetchRouteFromBackend(currentCoordinate, destination);
        if (!cancelled) {
          setRoutePayload(payload);
          void speakToUser(`Starting voice-only navigation to ${destination}.`);
        }
      } catch (err) {
        if (!cancelled) {
          setRouteLoadError(err instanceof Error ? err.message : "Failed to load route");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, currentCoordinate]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timeoutHandles.current.forEach((h) => clearTimeout(h));
      timeoutHandles.current = [];
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

  const getCoordinateAtDistance = (dist: number): GeoCoordinates => {
    if (!routePayload?.route_preview?.length) {
      return { latitude: 0, longitude: 0 };
    }
    if (dist <= 0) {
      return routePayload.route_preview[0];
    }
    let accumulated = 0;
    for (let i = 0; i < segmentDistances.length; i++) {
      const segD = segmentDistances[i];
      if (accumulated + segD >= dist) {
        const remaining = dist - accumulated;
        const fraction = segD > 0 ? remaining / segD : 0;
        const start = routePayload.route_preview[i];
        const end = routePayload.route_preview[i + 1];
        return {
          latitude: start.latitude + (end.latitude - start.latitude) * fraction,
          longitude: start.longitude + (end.longitude - start.longitude) * fraction,
        };
      }
      accumulated += segD;
    }
    return routePayload.route_preview[routePayload.route_preview.length - 1];
  };

  const simulatedCoordinate = useMemo(() => {
    return getCoordinateAtDistance(simulationProgress);
  }, [simulationProgress, segmentDistances, routePayload]);

  const activeCoordinate = useMemo(() => {
    if (isSimulating && routePayload?.steps?.length) {
      if (currentStepIndex <= 0) {
        return routePayload.origin;
      }
      if (currentStepIndex >= routePayload.steps.length) {
        return routePayload.steps[routePayload.steps.length - 1].waypoint;
      }
      return routePayload.steps[currentStepIndex - 1].waypoint;
    }

    const rawCoord = currentCoordinate ?? routePayload?.origin;
    if (rawCoord && routePayload?.route_preview?.length) {
      return snapToRoute(rawCoord, routePayload.route_preview);
    }
    return rawCoord;
  }, [isSimulating, currentStepIndex, currentCoordinate, routePayload]);

  // Update currentStepIndex in real-life navigation based on snapped GPS location
  useEffect(() => {
    if (isSimulating || !routePayload?.steps?.length || !activeCoordinate) {
      return;
    }

    let nearestIdx = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    routePayload.steps.forEach((step, idx) => {
      const d = toMeters(activeCoordinate, step.waypoint);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    if (nearestIdx !== currentStepIndex) {
      setCurrentStepIndex(nearestIdx);
    }
  }, [activeCoordinate, isSimulating, routePayload, currentStepIndex]);

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

      // Prefetch next step audio
      const nextStep = routePayload.steps[currentStepIndex + 1];
      if (nextStep) {
        const nextCleanInstruction = cleanAccessibilityInstruction(nextStep.instruction);
        void prefetchAudio(nextCleanInstruction);
      }

      setVoiceState("speaking");
      const words = cleanInstruction.split(" ").length;
      const estimateMs = Math.max(1500, (words / 2.8) * 1000);
      const handle = setTimeout(() => setVoiceState("idle"), estimateMs);
      timeoutHandles.current.push(handle);
    }
  }, [currentStepIndex, routePayload]);

  const handleNextStep = () => {
    if (!routePayload?.steps?.length) return;

    // Calculate cumulative distances
    const stepDistances: number[] = [0];
    let total = 0;
    routePayload.steps.forEach((step) => {
      total += step.distance_meters;
      stepDistances.push(total);
    });

    let nextIdx = currentStepIndex + 1;
    if (nextIdx > routePayload.steps.length) {
      return;
    }

    setIsSimulating(true);
    setCurrentStepIndex(nextIdx);
    const nextProgress = stepDistances[nextIdx];
    setSimulationProgress(nextProgress);

    if (nextIdx === routePayload.steps.length) {
      void speakToUser("You have arrived at your destination, " + destination);
      navigation.navigate("Arrival", {
        destination,
        durationSeconds: routePayload.estimated_duration_seconds,
        distanceMeters: totalDistance,
      });
    }
  };

  const handlePrevStep = () => {
    if (!routePayload?.steps?.length) return;

    // Calculate cumulative distances
    const stepDistances: number[] = [0];
    let total = 0;
    routePayload.steps.forEach((step) => {
      total += step.distance_meters;
      stepDistances.push(total);
    });

    let prevIdx = currentStepIndex - 1;
    if (prevIdx < 0) {
      prevIdx = 0;
    }

    setIsSimulating(prevIdx > 0);
    setCurrentStepIndex(prevIdx);
    const prevProgress = stepDistances[prevIdx];
    setSimulationProgress(prevProgress);
  };

  // Periodic check-in every 2 minutes (120 seconds) to reassure the user
  useEffect(() => {
    if (!routePayload || !activeCoordinate) return;

    const interval = setInterval(() => {
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < routePayload.steps.length) {
        const nextStep = routePayload.steps[nextStepIndex];
        const dist = toMeters(activeCoordinate, nextStep.waypoint);
        const stepsCount = Math.max(1, Math.round(dist / 0.75));

        if (dist < 15) {
          const cleanInst = cleanAccessibilityInstruction(nextStep.instruction);
          void speakToUser(`Turn alert: ${cleanInst}`);
        } else {
          const feetText = `${Math.round(dist * 3.28)} feet`;
          void speakToUser(`Keep going straight for another ${feetText} or about ${stepsCount} footsteps.`);
        }
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [routePayload, activeCoordinate, currentStepIndex, destination]);

  // Real-life arrival detection (when not simulating)
  useEffect(() => {
    if (isSimulating || !routePayload || !activeCoordinate || !routePayload?.destination?.coordinate || routePayload.simulated) {
      return;
    }
    const destCoord = routePayload.destination.coordinate;
    const dist = toMeters(activeCoordinate, destCoord);
    if (dist < 15) {
      void speakToUser("You have arrived at your destination, " + destination);
      navigation.navigate("Arrival", {
        destination,
        durationSeconds: routePayload.estimated_duration_seconds,
        distanceMeters: totalDistance,
      });
    }
  }, [activeCoordinate, isSimulating, routePayload, destination, totalDistance, navigation]);

  // Find minimum distance to check deviations
  const distanceToRoute = useMemo(() => {
    if (!routePayload?.route_preview?.length || !activeCoordinate) return 0;
    let minD = Number.POSITIVE_INFINITY;
    routePayload.route_preview.forEach((point) => {
      const d = toMeters(activeCoordinate, point);
      if (d < minD) {
        minD = d;
      }
    });
    return minD;
  }, [routePayload, activeCoordinate]);

  // Deviation rerouting
  useEffect(() => {
    if (isSimulating || routePayload?.simulated || !activeCoordinate || !routePayload) {
      return;
    }
    if (distanceToRoute > 20 && !isRecalculatingRef.current) {
      isRecalculatingRef.current = true;
      void (async () => {
        try {
          await speakToUser("Rerouting... Recalculating path to " + destination);
          const newPayload = await fetchRouteFromBackend(activeCoordinate, destination);
          setRoutePayload(newPayload);
        } catch (err) {
          console.warn("Recalculation failed:", err);
        } finally {
          isRecalculatingRef.current = false;
        }
      })();
    }
  }, [distanceToRoute, activeCoordinate, destination, isSimulating, routePayload]);

  const handleMicTap = () => {
    setIsListening((prev) => !prev);
    setVoiceState(isListening ? "idle" : "listening");

    const handle = setTimeout(() => {
      setIsListening(false);
      setVoiceState("idle");
    }, 4000);
    timeoutHandles.current.push(handle);
  };

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
            <Text style={styles.statusTitle}>{statusText}</Text>
            <Text style={styles.statusSubtitle}>{subText}</Text>

            <View style={styles.indicatorWrap}>{renderStatusIndicator(voiceState)}</View>

            {routePayload && (
              <View style={styles.miniSimulationCard}>
                <View style={styles.simControlsRow}>
                  <Pressable
                    onPress={handlePrevStep}
                    style={[styles.simButton, currentStepIndex <= 0 && styles.simButtonDisabled]}
                    disabled={currentStepIndex <= 0}
                  >
                    <ArrowLeft size={14} color="#ffffff" />
                    <Text style={styles.simButtonText}>Prev Step</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleNextStep}
                    style={styles.simButton}
                  >
                    <Text style={styles.simButtonText}>Next Step</Text>
                    <ArrowRight size={14} color="#ffffff" />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setIsSimulating(false);
                      setSimulationProgress(0);
                      setCurrentStepIndex(0);
                      lastSpokenStepIndex.current = -1;
                      clearSpeechQueue();
                    }}
                    style={styles.resetButton}
                  >
                    <RotateCcw size={14} color="#cbd5e1" />
                  </Pressable>
                </View>
                <Text style={styles.progressText}>
                  Step {currentStepIndex + 1} of {routePayload.steps.length}
                </Text>
              </View>
            )}

            <Pressable onPress={handleMicTap} style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}>
              <Mic size={28} color={isListening ? "#22d3ee" : "#94a3b8"} />
            </Pressable>
            <Text style={styles.micHint}>Tap to ask a question</Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.lockHintWrap}>
              <Smartphone size={14} color="#64748b" />
              <Text style={styles.lockHintText}>You can lock your screen. Voice will continue.</Text>
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
  miniSimulationCard: {
    width: "100%",
    backgroundColor: "rgba(30, 41, 59, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    marginVertical: 10,
  },
  simControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  simButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    justifyContent: "center",
  },
  simButtonDisabled: {
    opacity: 0.4,
  },
  simButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  speedSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 10,
    padding: 3,
  },
  speedOption: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  speedOptionActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.5)",
  },
  speedOptionText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
  },
  speedOptionTextActive: {
    color: "#22d3ee",
  },
  resetButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
  },
  progressText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 8,
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
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
});
