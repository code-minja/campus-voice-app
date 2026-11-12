import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { VoiceButton } from "../components/VoiceButton";
import { VoiceWaveIndicator } from "../components/VoiceWaveIndicator";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";
import {
  getCampusLocations,
  type CampusLocation,
} from "../services/campusLocations";

type NavigationInputScreenProps = {
  onBack: () => void;
  onSelectDestination: (destination: string) => void;
  onShowError: () => void;
};

export function NavigationInputScreen({
  onBack,
  onSelectDestination,
  onShowError,
}: NavigationInputScreenProps) {
  const insets = useSafeAreaInsets();
  const [searchValue, setSearchValue] = useState("");
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [locationsError, setLocationsError] = useState("");
  const { isListening, transcript, handleVoicePress } = useVoiceNavigation({
    onStartVoiceNavigation: onSelectDestination,
  });

  useEffect(() => {
    let cancelled = false;
    void getCampusLocations()
      .then((result) => {
        if (!cancelled) {
          setLocations(result);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLocationsError(
            error instanceof Error
              ? error.message
              : "Unable to load campus destinations.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return locations;
    }

    return locations.filter((location) =>
      [location.name, ...location.aliases].some((name) =>
        name.toLowerCase().includes(query),
      ),
    );
  }, [locations, searchValue]);

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader
            title="Navigate"
            subtitle="Voice or type to navigate"
            onBack={onBack}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.searchWrap}>
            <Search size={18} color="#64748b" style={styles.searchIcon} />
            <TextInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="Say or type your destination..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              accessibilityLabel="Destination search"
            />
          </View>

          <View style={styles.voiceSection}>
            <VoiceWaveIndicator isActive={isListening} />
            <VoiceButton
              isListening={isListening}
              onPress={handleVoicePress}
              accessibilityLabel={
                isListening ? "Listening, tap to stop" : "Tap to speak"
              }
            />
            <Text style={styles.hint}>
              {isListening ? "Listening..." : transcript || "Tap to speak"}
            </Text>
          </View>

          <ScrollView
            style={styles.listSection}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 24 + Math.max(insets.bottom, 8),
            }}
          >
            <Text style={styles.sectionLabel}>
              {searchValue ? "Search results" : "Campus destinations"}
            </Text>
            {!!locationsError && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{locationsError}</Text>
                <Pressable
                  onPress={onShowError}
                  style={({ pressed }) => [
                    styles.errorButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.errorButtonText}>Show route help</Text>
                </Pressable>
              </View>
            )}
            {filtered.map((location) => (
              <Pressable
                key={location.id}
                onPress={() => onSelectDestination(location.name)}
                style={({ pressed }) => [
                  styles.searchResultItem,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.searchResultText}>{location.name}</Text>
                {!!location.aliases.length && (
                  <Text style={styles.resultAliases}>
                    {location.aliases.join(", ")}
                  </Text>
                )}
              </Pressable>
            ))}
            {!locationsError && filtered.length === 0 && (
              <Text style={styles.emptyText}>
                {locations.length
                  ? `No campus destination matches "${searchValue}".`
                  : "Loading campus destinations..."}
              </Text>
            )}
          </ScrollView>
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
  searchWrap: {
    marginBottom: 20,
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#334155",
    backgroundColor: "rgba(30, 41, 59, 0.65)",
    color: "#e2e8f0",
    fontSize: 16,
    paddingVertical: 14,
    paddingLeft: 46,
    paddingRight: 16,
  },
  voiceSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  hint: {
    marginTop: 14,
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  listSection: {
    flex: 1,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 14,
    color: "#94a3b8",
  },
  searchResultItem: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchResultText: {
    color: "#e2e8f0",
    fontSize: 15,
  },
  resultAliases: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
  },
  emptyWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    backgroundColor: "rgba(127, 29, 29, 0.15)",
    padding: 14,
  },
  emptyText: {
    color: "#fca5a5",
    fontSize: 14,
    paddingVertical: 8,
  },
  errorButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.5)",
    backgroundColor: "rgba(12, 74, 110, 0.3)",
  },
  errorButtonText: {
    color: "#67e8f9",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
});
