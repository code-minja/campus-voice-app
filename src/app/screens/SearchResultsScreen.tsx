import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";
import type { GeoCoordinates } from "../types";
import {
  getCampusLocations,
  rankCampusLocations,
  type CampusLocation,
} from "../services/campusLocations";
import { distanceBetweenCoordinates } from "../services/routeTracking";

type SearchResultsScreenProps = {
  query?: string;
  currentCoordinate?: GeoCoordinates;
  onBack: () => void;
  onSelectLocation: (name: string) => void;
};

export function SearchResultsScreen({
  query,
  currentCoordinate,
  onBack,
  onSelectLocation,
}: SearchResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<number>();
  const { isListening, transcript, handleVoicePress } = useVoiceNavigation({
    onStartVoiceNavigation: onSelectLocation,
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");

    const loadLocations = query?.trim()
      ? rankCampusLocations(query, 5).then((matches) =>
          matches
            .filter((match) => match.score >= 0.5)
            .map((match) => match.location),
        )
      : getCampusLocations();

    void loadLocations
      .then((result) => {
        if (!cancelled) {
          setLocations(result);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load campus destinations.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader
            title="Results"
            subtitle="Choose a campus destination"
            onBack={onBack}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.contextBlock}>
            <Text style={styles.contextCaption}>Campus destinations</Text>
            <Text style={styles.contextHeading}>
              {query ? `Matches for "${query}"` : "Where would you like to go?"}
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 18 }}
          >
            {locations.map((location) => {
              const selected = selectedId === location.id;
              const distance = currentCoordinate
                ? Math.round(
                    distanceBetweenCoordinates(currentCoordinate, {
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }),
                  )
                : undefined;

              return (
                <Pressable
                  key={location.id}
                  onPress={() => {
                    setSelectedId(location.id);
                    onSelectLocation(location.name);
                  }}
                  style={({ pressed }) => [
                    styles.resultCard,
                    selected && styles.resultCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.resultIconWrap,
                      selected && styles.resultIconWrapSelected,
                    ]}
                  >
                    <MapPin size={18} color={selected ? "#22d3ee" : "#94a3b8"} />
                  </View>

                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultTitle}>{location.name}</Text>
                    <Text style={styles.resultDescriptor}>
                      {location.aliases.length
                        ? location.aliases.join(", ")
                        : "AAUA campus destination"}
                    </Text>
                    {distance !== undefined && (
                      <Text style={styles.resultDistance}>
                        {distance} m from your current location
                      </Text>
                    )}
                  </View>

                  {selected && <View style={styles.selectedDot} />}
                </Pressable>
              );
            })}
            {!locations.length && (
              <Text style={styles.emptyText}>
                {loadError || (isLoading
                  ? "Loading campus destinations..."
                  : "No matching campus destinations were found.")}
              </Text>
            )}
          </ScrollView>

          <Text style={styles.voiceHint}>
            {isListening
              ? "Listening for your destination..."
              : transcript || "Say the destination you want"}
          </Text>

          <View
            style={[
              styles.voiceButtonWrap,
              { paddingBottom: 20 + Math.max(insets.bottom, 8) },
            ]}
          >
            <VoiceButton
              isListening={isListening}
              onPress={handleVoicePress}
              accessibilityLabel={
                isListening ? "Listening, tap to stop" : "Tap to choose by voice"
              }
              size={96}
              iconSize={34}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingBottom: 14,
  },
  content: {
    flex: 1,
  },
  contextBlock: {
    marginBottom: 18,
    alignItems: "center",
  },
  contextCaption: {
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#64748b",
    marginBottom: 8,
  },
  contextHeading: {
    color: "#ffffff",
    fontSize: 25,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  resultCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  resultCardSelected: {
    borderColor: "rgba(34, 211, 238, 0.8)",
    backgroundColor: "rgba(15, 118, 110, 0.23)",
  },
  resultIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  resultIconWrapSelected: {
    backgroundColor: "rgba(34, 211, 238, 0.18)",
  },
  resultTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 18,
  },
  resultDescriptor: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 14,
  },
  resultDistance: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
    shadowColor: "#22d3ee",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyText: {
    padding: 14,
    color: "#fca5a5",
    fontSize: 14,
    textAlign: "center",
  },
  voiceHint: {
    marginTop: 6,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
  },
  voiceButtonWrap: {
    alignItems: "center",
    paddingTop: 16,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
});
