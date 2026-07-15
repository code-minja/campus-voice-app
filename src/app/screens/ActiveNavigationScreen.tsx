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
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  MapPin,
} from "lucide-react-native";
import type { LatLng } from "react-native-maps";
import { GoogleRouteMap } from "../components/GoogleRouteMap";
import { VoiceButton } from "../components/VoiceButton";
import {
  fetchRouteFromBackend,
  type RoutePayload,
} from "../services/navigationRoute";
import type { GeoCoordinates } from "../types";
import { speakToUser, clearSpeechQueue, prefetchAudio } from "../services/voiceFeedback";
import { getDirectionIcon, cleanAccessibilityInstruction } from "./RoutePreviewScreen";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../types";

type ActiveNavigationScreenProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
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

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "--";
  }

  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  return `${roundedMinutes} min`;
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

export function ActiveNavigationScreen({
  destination,
  currentLocation,
  currentCoordinate,
  onEndNavigation,
  onSwitchToVoiceOnly,
}: ActiveNavigationScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isListening, setIsListening] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [routePayload, setRoutePayload] = useState<RoutePayload | null>(null);
  const [routeLoadError, setRouteLoadError] = useState("");
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeedMultiplier, setSimulationSpeedMultiplier] = useState(2);
  const [showStepsList, setShowStepsList] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const lastSpokenStepIndex = useRef<number>(-1);

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

  const getCoordinateAtDistance = (distance: number): GeoCoordinates => {
    const points = routePayload?.route_preview;
    if (!points || points.length === 0) return currentCoordinate ?? { latitude: 7.481843099892803, longitude: 5.741945337431659 };
    if (points.length === 1) return points[0];
    if (distance <= 0) return points[0];
    const total = totalDistance;
    if (distance >= total) return points[points.length - 1];

    let i = 0;
    while (i < segmentDistances.length - 1 && segmentDistances[i + 1] < distance) {
      i++;
    }

    const startPoint = points[i];
    const endPoint = points[i + 1];
    const dStart = segmentDistances[i];
    const dEnd = segmentDistances[i + 1];
    const segmentLen = dEnd - dStart;
    if (segmentLen <= 0) return startPoint;

    const fraction = (distance - dStart) / segmentLen;
    return {
      latitude: startPoint.latitude + (endPoint.latitude - startPoint.latitude) * fraction,
      longitude: startPoint.longitude + (endPoint.longitude - startPoint.longitude) * fraction,
    };
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
    if (isSimulating || !routePayload || !activeCoordinate || !destinationCoordinateOverride || routePayload.simulated) {
      return;
    }
    const dist = toMeters(activeCoordinate, destinationCoordinateOverride);
    if (dist < 15) {
      void speakToUser("You have arrived at your destination, " + destination);
      navigation.navigate("Arrival", {
        destination,
        durationSeconds: routePayload.estimated_duration_seconds,
        distanceMeters: totalDistance,
      });
    }
  }, [activeCoordinate, isSimulating, routePayload, destinationCoordinateOverride, destination, totalDistance, navigation]);

  // Find the minimum distance to any point on the route polyline
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

  // Handle route deviation recalculation
  const isRecalculatingRef = useRef(false);
  useEffect(() => {
    // Only detect route deviations for real campus navigation walks (disable during simulation and mock routes)
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

  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdatingLocation(true);
      const handle = setTimeout(() => setIsUpdatingLocation(false), 1200);
      timeoutHandles.current.push(handle);
    }, 6500);

    return () => {
      clearInterval(interval);
      timeoutHandles.current.forEach((h) => clearTimeout(h));
      timeoutHandles.current = [];
      clearSpeechQueue();
    };
  }, []);

  const handleMicTap = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    const handle = setTimeout(() => setIsListening(false), 2800);
    timeoutHandles.current.push(handle);
  };

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
  const mapCurrentLocation = routePayload?.simulated || isSimulating
    ? "Simulated location"
    : currentLocation;



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

    const remainingMeters = routePayload.steps
      .slice(currentStepIndex)
      .reduce((sum, step) => sum + step.distance_meters, 0);

    const nextStep = routePayload.steps[currentStepIndex];
    const distanceToNextMeters = nextStep ? toMeters(activeCoordinate, nextStep.waypoint) : 0;
    const cleanInstruction = nextStep ? cleanAccessibilityInstruction(nextStep.instruction) : "Arriving...";

    return {
      currentStepInstruction: cleanInstruction,
      distanceToNextMeters,
      remainingMeters,
    };
  }, [activeCoordinate, currentStepIndex, routeLoadError, routePayload]);

  useEffect(() => {
    let cancelled = false;
    if (!destination.trim()) {
      return;
    }

    void (async () => {
      try {
        setRouteLoadError("");
        const payload = await fetchRouteFromBackend(currentCoordinate, destination);
        if (!cancelled) {
          setRoutePayload(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setRouteLoadError(error instanceof Error ? error.message : "Unable to load route");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentCoordinate, destination]);

  return (
    <View style={styles.root}>
      <GoogleRouteMap
        destination={destination}
        currentLocation={mapCurrentLocation}
        currentCoordinate={mapOriginCoordinate}
        routeWaypoints={mapRouteWaypoints}
        destinationCoordinateOverride={destinationCoordinateOverride}
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
            <View
              style={[
                styles.locationDot,
                isUpdatingLocation && styles.locationDotUpdating,
              ]}
            />
            <Text style={styles.locationHintText}>
              {isUpdatingLocation ? "Updating location..." : mapCurrentLocation}
            </Text>
          </View>

          <View style={styles.destinationBar}>
            <View>
              <Text style={styles.destinationLabel}>Navigating to</Text>
              <Text style={styles.destinationValue}>{destination}</Text>
            </View>
            <View>
              <Text style={styles.destinationLabel}>ETA</Text>
              <Text style={styles.etaValue}>
                {routePayload ? formatDuration(routePayload.estimated_duration_seconds) : "--"}
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
              <Text style={styles.routeErrorText}>{routeLoadError}</Text>
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

          {!!routePayload && (
            <View style={styles.simulationCard}>
              <View style={styles.simulationHeader}>
                <View style={styles.simulationStatusRow}>
                  <View style={[styles.simulationIndicatorDot, isSimulating && styles.simulationIndicatorDotActive]} />
                  <Text style={styles.simulationTitle}>Step Simulator</Text>
                </View>
                <Text style={styles.simulationProgressText}>
                  Step {currentStepIndex + 1} of {routePayload.steps.length}
                </Text>
              </View>

              <View style={styles.simulationControlsRow}>
                <Pressable
                  onPress={handlePrevStep}
                  style={[styles.simulationButton, currentStepIndex <= 0 && styles.simulationButtonDisabled]}
                  disabled={currentStepIndex <= 0}
                >
                  <ArrowLeft size={14} color="#ffffff" />
                  <Text style={styles.simulationButtonText}>Prev Step</Text>
                </Pressable>

                <Pressable
                  onPress={handleNextStep}
                  style={styles.simulationButton}
                >
                  <Text style={styles.simulationButtonText}>Next Step</Text>
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
            </View>
          )}
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
            onPress={handleMicTap}
            accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to speak"}
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
  locationDotUpdating: {
    backgroundColor: "#22d3ee",
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
  simulationCard: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  simulationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  simulationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  simulationIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#64748b",
  },
  simulationIndicatorDotActive: {
    backgroundColor: "#22c55e",
  },
  simulationTitle: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  simulationProgressText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  simulationControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  simulationButton: {
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
  simulationButtonDisabled: {
    opacity: 0.4,
  },
  simulationButtonText: {
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
