import { useEffect, useMemo, useRef, useState } from "react";
import { Vibration } from "react-native";
import {
  Animated,
  PanResponder,
  Pressable,
  PressableStateCallbackType,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import {
  Clock,
  MapPin,
  Mic,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import type { LatLng } from "react-native-maps";
import { GoogleRouteMap } from "../components/GoogleRouteMap";
import { StackHeader } from "../components/StackHeader";
import { speakToUser, clearSpeechQueue } from "../services/voiceFeedback";
import { streamRecordingForTranscription } from "../services/voiceTranscription";
import {
  fetchRouteFromBackend,
  type RoutePayload,
} from "../services/navigationRoute";
import {
  announceMicStartBeep,
  announceMicStopBeep,
  announceNavigationStarted,
  announceProcessing,
} from "../services/footstepAudio";
import type { GeoCoordinates } from "../types";

export function getDirectionIcon(instruction: string, isLast: boolean) {
  if (isLast) {
    return { Icon: MapPin, color: "#22d3ee" };
  }
  const lower = instruction.toLowerCase();
  if (lower.includes("turn left") || lower.includes("bear left") || lower.includes("sharp left")) {
    return { Icon: ArrowLeft, color: "#cbd5e1" };
  }
  if (lower.includes("turn right") || lower.includes("bear right") || lower.includes("sharp right")) {
    return { Icon: ArrowRight, color: "#cbd5e1" };
  }
  if (lower.includes("slight left") || lower.includes("veer left")) {
    return { Icon: ArrowUpLeft, color: "#cbd5e1" };
  }
  if (lower.includes("slight right") || lower.includes("veer right")) {
    return { Icon: ArrowUpRight, color: "#cbd5e1" };
  }
  if (lower.includes("arrive") || lower.includes("destination")) {
    return { Icon: MapPin, color: "#22d3ee" };
  }
  return { Icon: ArrowUp, color: "#cbd5e1" };
}

export function cleanAccessibilityInstruction(instruction: string): string {
  let text = instruction;

  // Replace cardinal directions with simpler navigation actions
  text = text.replace(/\bHead SouthEast\b/gi, "Start walking");
  text = text.replace(/\bHead SouthWest\b/gi, "Start walking");
  text = text.replace(/\bHead NorthEast\b/gi, "Start walking");
  text = text.replace(/\bHead NorthWest\b/gi, "Start walking");
  text = text.replace(/\bHead North\b/gi, "Start walking");
  text = text.replace(/\bHead South\b/gi, "Start walking");
  text = text.replace(/\bHead East\b/gi, "Start walking");
  text = text.replace(/\bHead West\b/gi, "Start walking");

  // Keep it simple
  text = text.replace(/\bHead\b/gi, "Walk");

  // Replace meters with footsteps for clear relative distance!
  const metersRegex = /(\d+(?:\.\d+)?)\s*(?:meters|meter|m)\b/gi;
  text = text.replace(metersRegex, (match, p1) => {
    const meters = parseFloat(p1);
    const footsteps = Math.max(1, Math.round(meters / 0.75));
    return `${footsteps} footsteps`;
  });

  // Spell out acronyms for perfect pronunciation
  text = text.replace(/\bAAUA\b/gi, "A A U A");
  text = text.replace(/\bETF\s*750\b/gi, "E T F seven fifty");
  text = text.replace(/\bETF\b/gi, "E T F");
  text = text.replace(/\bOBJ\b/gi, "O B J");
  text = text.replace(/\bLT\s*A\b/gi, "L T A");
  text = text.replace(/\bLT\b/gi, "L T");
  text = text.replace(/\bRC\b/gi, "R C");

  return text;
}

type RoutePreviewScreenProps = {
  destination: string;
  currentLocation: string;
  currentCoordinate?: GeoCoordinates;
  locationError?: string;
  onRetryLocation: () => void;
  onBack: () => void;
  onStartNavigation: () => void;
  onCancelVoiceConfirmation: () => void;
};

type InteractiveState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};
const AUTO_STOP_CONFIRM_MS = 7000;
const METERS_TO_FEET = 3.28084;

function formatDistanceInFeet(meters: number): string {
  const feet = Math.max(1, Math.round(meters * METERS_TO_FEET));
  return `${feet} ft`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "time unavailable";
  }

  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  return `${roundedMinutes} min walk`;
}

function formatArrivalTime(seconds: number | undefined, now: Date): string {
  if (!seconds || seconds <= 0) {
    return "Arrival time unavailable";
  }

  const arrival = new Date(now.getTime() + seconds * 1000);
  return `Arrive ${arrival.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function normalizeUtterance(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStartIntent(value: string): boolean {
  const normalized = normalizeUtterance(value);
  return ["yes", "yeah", "yep", "go", "okay", "ok"].some((cue) =>
    normalized.includes(cue),
  );
}

function isCancelIntent(value: string): boolean {
  const normalized = normalizeUtterance(value);
  return /\bcancel\b/.test(normalized);
}

export function RoutePreviewScreen({
  destination,
  currentLocation,
  currentCoordinate,
  locationError,
  onRetryLocation,
  onBack,
  onStartNavigation,
  onCancelVoiceConfirmation,
}: RoutePreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [heardSummary, setHeardSummary] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [routePayload, setRoutePayload] = useState<RoutePayload | null>(null);
  const [routeLoadError, setRouteLoadError] = useState<string>("");
  const [routeRetryCount, setRouteRetryCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const routeRequestRef = useRef({ destination: "", started: false });
  const isTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!currentCoordinate && locationError) {
      setRouteLoadError(locationError);
    } else if (currentCoordinate) {
      setRouteLoadError((error) =>
        error === locationError ? "" : error,
      );
    }
  }, [currentCoordinate, locationError]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const directionSteps = useMemo(() => {
    if (!routePayload?.steps?.length) {
      return [];
    }

    return routePayload.steps.map((step, index) => {
      const isLast = index === routePayload.steps.length - 1;
      const { Icon, color } = getDirectionIcon(step.instruction, isLast);
      const cleanInstruction = cleanAccessibilityInstruction(step.instruction);
      return {
        id: `${index + 1}`,
        title: cleanInstruction,
        detail: `Walk ${formatDistanceInFeet(step.distance_meters)} — ${cleanInstruction}`,
        Icon,
        color,
      };
    });
  }, [routePayload]);

  const hasLiveRoute = directionSteps.length > 0;

  const effectiveDistance = routePayload
    ? formatDistanceInFeet(routePayload.total_distance_meters)
    : routeLoadError
      ? "Unavailable"
      : "Calculating...";
  const effectiveDuration = routePayload
    ? formatDuration(routePayload.estimated_duration_seconds)
    : routeLoadError
      ? "Unavailable"
      : "Calculating...";
  const estimatedArrival = routePayload
    ? formatArrivalTime(routePayload.estimated_duration_seconds, currentTime)
    : routeLoadError
      ? "Arrival unavailable"
      : "Calculating arrival...";

  const summaryText = routeLoadError
    ? routeLoadError
    : voiceStatus ||
      (hasLiveRoute
        ? heardSummary
          ? "Summary played"
          : "Tap to hear directions"
        : "Loading live Google route...");

  const mapRouteWaypoints = useMemo<LatLng[] | undefined>(() => {
    if (!routePayload?.route_preview?.length) {
      return undefined;
    }

    return routePayload.route_preview.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));
  }, [routePayload]);

  const mapOriginCoordinate = currentCoordinate ?? routePayload?.origin;
  const mapCurrentLocation = currentCoordinate
    ? `My location — ${currentLocation}`
    : locationError || currentLocation;

  const maxSheetHeight = Math.min(Math.max(height * 0.82, 440), 700);
  const minVisibleHeight = Math.min(340, maxSheetHeight - 180);

  const sheetHeight = useRef(new Animated.Value(minVisibleHeight)).current;
  const dragStartHeight = useRef(minVisibleHeight);

  useEffect(() => {
    sheetHeight.setValue(minVisibleHeight);
    dragStartHeight.current = minVisibleHeight;
    setIsExpanded(false);
  }, [minVisibleHeight, sheetHeight]);

  const animateSheetTo = (toHeight: number) => {
    Animated.spring(sheetHeight, {
      toValue: toHeight,
      useNativeDriver: false,
      damping: 24,
      stiffness: 240,
      mass: 0.9,
    }).start(() => {
      dragStartHeight.current = toHeight;
      setIsExpanded(toHeight > (minVisibleHeight + maxSheetHeight) / 2);
    });
  };

  const snapSheet = (currentHeight: number, velocityY: number) => {
    const midpoint = (minVisibleHeight + maxSheetHeight) / 2;
    const shouldExpand = velocityY < -0.28 || currentHeight > midpoint;
    animateSheetTo(shouldExpand ? maxSheetHeight : minVisibleHeight);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation((value: number) => {
            dragStartHeight.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextHeight = clamp(
            dragStartHeight.current - gesture.dy,
            minVisibleHeight,
            maxSheetHeight,
          );
          sheetHeight.setValue(nextHeight);
        },
        onPanResponderRelease: (_, gesture) => {
          const currentHeight = clamp(
            dragStartHeight.current - gesture.dy,
            minVisibleHeight,
            maxSheetHeight,
          );
          snapSheet(currentHeight, gesture.vy);
        },
        onPanResponderTerminate: (_, gesture) => {
          const currentHeight = clamp(
            dragStartHeight.current - gesture.dy,
            minVisibleHeight,
            maxSheetHeight,
          );
          snapSheet(currentHeight, gesture.vy);
        },
      }),
    [maxSheetHeight, minVisibleHeight, sheetHeight],
  );

  const handleGrabberPress = () => {
    sheetHeight.stopAnimation((value: number) => {
      const midpoint = (minVisibleHeight + maxSheetHeight) / 2;
      const nextHeight = value > midpoint ? minVisibleHeight : maxSheetHeight;
      animateSheetTo(nextHeight);
    });
  };

  const clearConfirmTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const safeIsRecording = () => {
    try {
      return recorder.isRecording;
    } catch {
      return false;
    }
  };

  const safeStopRecording = async () => {
    try {
      await recorder.stop();
    } catch {
      // recorder may already be released during navigation transitions
    }
  };

  const safeGetRecordingUri = () => {
    try {
      return recorder.uri;
    } catch {
      return null;
    }
  };

  const stopAndTranscribeConfirmation = async () => {
    if (isTransitioningRef.current || !safeIsRecording()) return;
    isTransitioningRef.current = true;
    let nextAction: "start" | "cancel" | "retry" | null = null;
    try {
      await safeStopRecording();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });
      setIsListening(false);
      Vibration.vibrate([0, 20, 40, 20]);
      await announceMicStopBeep();
      setVoiceStatus("Processing...");
      await announceProcessing();

      const recordingUri = safeGetRecordingUri();
      if (!recordingUri) {
        setVoiceStatus("No speech detected. Please try again.");
        return;
      }

      setVoiceStatus("");
      const result = await streamRecordingForTranscription(
        recordingUri,
        (partial) => {
          setVoiceStatus("");
          setVoiceStatus(partial);
        },
      );
      const finalText = result.text || "";
      setVoiceStatus(finalText);

      if (isStartIntent(finalText)) {
        nextAction = "start";
      } else if (isCancelIntent(finalText)) {
        nextAction = "cancel";
      } else {
        nextAction = "retry";
      }
    } finally {
      isTransitioningRef.current = false;
    }

    if (!isMountedRef.current) return;
    if (nextAction === "start") {
      await announceNavigationStarted();
      clearConfirmTimeout();
      onStartNavigation();
      return;
    }
    if (nextAction === "cancel") {
      clearConfirmTimeout();
      onCancelVoiceConfirmation();
      return;
    }
    if (nextAction === "retry") {
      await speakToUser(
        "Please say yes to begin navigation, or cancel to go back.",
      );
      await startConfirmationListening();
    }
  };

  const startConfirmationListening = async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      clearSpeechQueue();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceStatus("Microphone permission denied.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });
      await recorder.prepareToRecordAsync();
      await recorder.record();
      setVoiceStatus("Listening... say yes or cancel.");
      setIsListening(true);
      Vibration.vibrate(35);
      void announceMicStartBeep();

      clearConfirmTimeout();
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          void stopAndTranscribeConfirmation();
        }
      }, AUTO_STOP_CONFIRM_MS);
    } finally {
      isTransitioningRef.current = false;
    }
  };

  useEffect(() => {
    if (routeRequestRef.current.destination !== destination) {
      routeRequestRef.current = { destination, started: false };
      setRoutePayload(null);
      setRouteLoadError(currentCoordinate ? "" : locationError ?? "");
    }

    if (!destination.trim()) {
      return;
    }
    if (!currentCoordinate || routeRequestRef.current.started) {
      return;
    }
    routeRequestRef.current.started = true;
    clearSpeechQueue();

    void (async () => {
      try {
        setRouteLoadError("");
        const payload = await fetchRouteFromBackend(
          currentCoordinate,
          destination,
        );
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          setRoutePayload(payload);

          const durationText = formatDuration(payload.estimated_duration_seconds);
          const stepsText = `${payload.steps.length} steps`;
          const initialText = `Route preview ready for ${destination}. It is a ${stepsText} walk, taking about ${durationText}. Please say yes to begin navigation, or cancel to go back.`;

          await speakToUser(initialText);

          if (
            isMountedRef.current &&
            routeRequestRef.current.destination === destination
          ) {
            void startConfirmationListening();
          }
        }
      } catch (error) {
        if (
          isMountedRef.current &&
          routeRequestRef.current.destination === destination
        ) {
          routeRequestRef.current.started = false;
          setRoutePayload(null);
          const message =
            error instanceof Error ? error.message : "Failed to load route";
          setRouteLoadError(message);
          void speakToUser(message);
        }
      }
    })();
  }, [
    currentCoordinate?.latitude,
    currentCoordinate?.longitude,
    destination,
    locationError,
    routeRetryCount,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearConfirmTimeout();
      clearSpeechQueue();
      if (safeIsRecording()) {
        void safeStopRecording();
      }
    };
  }, []);

  return (
    <View style={styles.root}>
      <GoogleRouteMap
        destination={destination}
        currentLocation={mapCurrentLocation}
        currentCoordinate={mapOriginCoordinate}
        routeWaypoints={mapRouteWaypoints}
      />

      {isListening && (
        <View style={styles.voiceOverlayCard}>
          <View style={styles.voiceOverlayRipple}>
            <Mic size={24} color="#22d3ee" />
          </View>
          <Text style={styles.voiceOverlayTitle}>Listening...</Text>
          <Text style={styles.voiceOverlaySubtitle}>Say "yes" to start or "cancel" to exit</Text>
        </View>
      )}

      <SafeAreaView
        style={styles.safeArea}
        edges={["left", "right"]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.overlayHeader,
            { paddingTop: Math.max(insets.top, 8) },
          ]}
        >
          <StackHeader
            title="Route Preview"
            subtitle="Review before you start"
            onBack={onBack}
          />
        </View>

        <View style={styles.fromChipWrap}>
          <View style={styles.fromChip}>
            <MapPin size={14} color="#60a5fa" />
            <View>
              <Text style={styles.fromLabel}>From</Text>
              <Text style={styles.fromValue}>{mapCurrentLocation}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: sheetHeight,
            paddingBottom: 12 + Math.max(insets.bottom, 8),
          },
        ]}
      >
        <Pressable
          onPress={handleGrabberPress}
          style={(state: InteractiveState) => [
            styles.grabberTouchArea,
            (state.focused || state.hovered || state.pressed) &&
              styles.grabberTouchAreaRing,
          ]}
          {...panResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel="Drag route details sheet"
        >
          <View style={styles.grabber} />
          <Text style={styles.grabberHint}>Drag up for full details</Text>
        </Pressable>

        <View style={styles.sheetBody}>
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            <View style={styles.routeChain}>
              <View style={styles.chainRow}>
                <View style={styles.fromDot} />
                <View style={styles.chainTextWrap}>
                  <Text style={styles.chainLabel}>From</Text>
                  <Text style={styles.chainValue}>{mapCurrentLocation}</Text>
                </View>
              </View>

              {isExpanded ? (
                hasLiveRoute ? (
                  <View style={styles.directionInlineWrap}>
                    {directionSteps.map((step, index) => (
                      <View key={step.id} style={styles.directionInlineRow}>
                        <View style={styles.directionMarkerCol}>
                          <View style={styles.directionIconContainer}>
                            <step.Icon size={12} color={step.color} />
                          </View>
                          <View style={styles.directionStem} />
                          {index === directionSteps.length - 1 && (
                            <View style={styles.directionToConnector} />
                          )}
                        </View>
                        <View style={styles.directionTextWrap}>
                          <Text style={styles.directionTitle}>
                            {step.title}
                          </Text>
                          <Text style={styles.directionDetail}>
                            {step.detail}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.loadingDirectionsCard}>
                    <Text style={styles.loadingDirectionsTitle}>
                      Loading live Google route
                    </Text>
                    <Text style={styles.loadingDirectionsText}>
                      Real turn-by-turn instructions will appear here once the
                      route is ready.
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.chainStem} />
              )}

              <View style={styles.chainRow}>
                <View style={styles.toDotWrap}>
                  <MapPin size={14} color="#22d3ee" />
                </View>
                <View style={styles.chainTextWrap}>
                  <Text style={styles.chainLabel}>To</Text>
                  <Text style={styles.destination}>{destination}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Clock size={14} color="#94a3b8" />
                      <Text style={styles.metaText}>{estimatedArrival}</Text>
                    </View>
                    <Text style={styles.metaBullet}>•</Text>
                    <Text style={styles.metaText}>{effectiveDistance}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => setHeardSummary(true)}
              style={(state: InteractiveState) => [
                styles.summaryCard,
                (heardSummary || isListening) && styles.summaryCardActive,
                (state.focused || state.hovered || state.pressed) &&
                  styles.summaryCardRing,
                state.pressed && styles.pressed,
              ]}
            >
              <View style={styles.summaryButton}>
                <View style={[styles.summaryIconWrap, isListening && styles.summaryIconWrapActive]}>
                  <Mic size={18} color={isListening ? "#020617" : "#22d3ee"} />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryText}>
                    {isListening
                      ? "Listening for confirmation..."
                      : routePayload
                        ? `${effectiveDuration} away from ${destination}`
                        : routeLoadError
                          ? "Route unavailable"
                          : `Calculating route to ${destination}...`}
                  </Text>
                  <Text style={[styles.summarySubText, isListening && styles.summarySubTextActive]}>
                    {summaryText}
                  </Text>
                </View>
              </View>
            </Pressable>
            {!!routeLoadError && (
              <Pressable
                onPress={() => {
                  if (!currentCoordinate && locationError) {
                    onRetryLocation();
                  } else {
                    setRouteRetryCount((count) => count + 1);
                  }
                }}
                accessibilityRole="button"
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>
                  {!currentCoordinate && locationError
                    ? "Retry location access"
                    : "Retry route request"}
                </Text>
              </Pressable>
            )}
          </ScrollView>

          <View style={styles.footerActionWrap}>
            <Pressable
              onPress={onStartNavigation}
              disabled={!routePayload}
              style={(state: InteractiveState) => [
                styles.startButton,
                !routePayload && styles.startButtonDisabled,
                (state.focused || state.hovered || state.pressed) &&
                  styles.startButtonRing,
                state.pressed && styles.pressed,
              ]}
            >
              <Text style={styles.startButtonText}>Start Navigation</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
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
    paddingHorizontal: 24,
  },
  overlayHeader: {
    paddingBottom: 8,
  },
  fromChipWrap: {
    marginTop: 8,
  },
  fromChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  fromLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  fromValue: {
    marginTop: 1,
    fontSize: 13,
    color: "#e2e8f0",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  grabberTouchArea: {
    alignItems: "center",
    borderRadius: 14,
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 6,
  },
  grabberTouchAreaRing: {
    backgroundColor: "rgba(34, 211, 238, 0.08)",
  },
  grabber: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#334155",
    marginBottom: 6,
  },
  grabberHint: {
    color: "#64748b",
    fontSize: 11,
  },
  sheetBody: {
    flex: 1,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 8,
  },
  routeChain: {
    marginBottom: 14,
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fromDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 8,
    marginLeft: 3,
    backgroundColor: "#60a5fa",
  },
  toDotWrap: {
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    backgroundColor: "rgba(34, 211, 238, 0.2)",
  },
  chainStem: {
    height: 22,
    width: 2,
    backgroundColor: "#22d3ee",
    marginLeft: 7,
    marginVertical: 4,
  },
  chainTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  chainLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  chainValue: {
    fontSize: 15,
    color: "#cbd5e1",
    marginTop: 1,
  },
  destination: {
    fontSize: 25,
    color: "#ffffff",
    marginTop: 1,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  metaBullet: {
    marginHorizontal: 8,
    color: "#64748b",
  },
  directionInlineWrap: {
    marginTop: 10,
    marginLeft: 6,
    marginBottom: 8,
  },
  directionInlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  directionMarkerCol: {
    width: 24,
    alignItems: "center",
  },
  directionIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    marginTop: 2,
  },
  directionStem: {
    width: 2,
    height: 24,
    backgroundColor: "rgba(34, 211, 238, 0.45)",
    marginTop: 2,
    marginBottom: 2,
  },
  directionToConnector: {
    width: 2,
    height: 14,
    backgroundColor: "rgba(34, 211, 238, 0.35)",
    marginTop: 1,
  },
  directionTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginBottom: 10,
  },
  directionTitle: {
    color: "#e2e8f0",
    fontSize: 14,
  },
  directionDetail: {
    marginTop: 1,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
  },
  loadingDirectionsCard: {
    marginTop: 10,
    marginLeft: 22,
    marginRight: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  loadingDirectionsTitle: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingDirectionsText: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
  },
  summaryCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.55)",
  },
  summaryCardActive: {
    borderColor: "rgba(34, 211, 238, 0.7)",
    backgroundColor: "rgba(14, 116, 144, 0.22)",
  },
  summaryCardRing: {
    borderColor: "rgba(34, 211, 238, 0.85)",
    shadowColor: "#22d3ee",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  summaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  summaryTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  summaryText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  summaryStrong: {
    color: "#22d3ee",
    fontWeight: "600",
  },
  summarySubText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  footerActionWrap: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(51, 65, 85, 0.55)",
  },
  startButton: {
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
    paddingVertical: 15,
    alignItems: "center",
  },
  startButtonDisabled: {
    opacity: 0.45,
  },
  retryButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: "#22d3ee",
    fontSize: 15,
    fontWeight: "600",
  },
  startButtonRing: {
    shadowColor: "#22d3ee",
    shadowOpacity: 0.42,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 4,
  },
  startButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  summaryIconWrapActive: {
    backgroundColor: "#22d3ee",
    borderColor: "#22d3ee",
  },
  summarySubTextActive: {
    color: "#22d3ee",
    fontWeight: "600",
  },
  voiceOverlayCard: {
    position: "absolute",
    top: "32%",
    left: "12%",
    right: "12%",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.45)",
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  voiceOverlayRipple: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
    borderWidth: 2,
    borderColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  voiceOverlayTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  voiceOverlaySubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
});
