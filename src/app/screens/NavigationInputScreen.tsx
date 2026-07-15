import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, MapPin, Search } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { SuggestionChips } from "../components/SuggestionChips";
import { VoiceButton } from "../components/VoiceButton";
import { VoiceWaveIndicator } from "../components/VoiceWaveIndicator";

type NavigationInputScreenProps = {
  onBack: () => void;
  onSelectDestination: (destination: string) => void;
  onAmbiguousResults: (query?: string) => void;
  onShowError: () => void;
};

const recentLocations = ["Library", "ETF", "Hostel"];
const suggestedDestinations = ["Student Center", "Gym", "Cafeteria"];

export function NavigationInputScreen({
  onBack,
  onSelectDestination,
  onAmbiguousResults,
  onShowError,
}: NavigationInputScreenProps) {
  const insets = useSafeAreaInsets();
  const [isListening, setIsListening] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);

  const locations = [...recentLocations, ...suggestedDestinations];
  const filtered = locations.filter((item) =>
    item.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const clearPendingTimeouts = () => {
    timeoutHandles.current.forEach((handle) => clearTimeout(handle));
    timeoutHandles.current = [];
  };

  useEffect(() => {
    return () => {
      clearPendingTimeouts();
    };
  }, []);

  const handleVoicePress = () => {
    clearPendingTimeouts();

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    const handle = setTimeout(() => {
      setSearchValue("Library");
      setIsListening(false);
      onAmbiguousResults("Library");
    }, 2000);

    timeoutHandles.current.push(handle);
  };

  const handleLocationPress = (location: string) => {
    setSearchValue(location);
    const handle = setTimeout(() => onSelectDestination(location), 250);
    timeoutHandles.current.push(handle);
  };

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Navigate" subtitle="Voice or type to navigate" onBack={onBack} />
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
              accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to speak"}
            />
            <Text style={styles.hint}>{isListening ? "Listening..." : "Tap to speak"}</Text>
          </View>

          <ScrollView
            style={styles.listSection}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 + Math.max(insets.bottom, 8) }}
          >
            {!searchValue ? (
              <>
                <View style={styles.recentSection}>
                  <View style={styles.recentHeadingRow}>
                    <Clock size={16} color="#64748b" />
                    <Text style={styles.sectionLabel}>Recent locations</Text>
                  </View>

                  {recentLocations.map((location) => (
                    <Pressable
                      key={location}
                      onPress={() => handleLocationPress(location)}
                      style={({ pressed }) => [styles.recentItem, pressed && styles.pressed]}
                    >
                      <View style={styles.recentItemIconWrap}>
                        <MapPin size={18} color="#22d3ee" />
                      </View>
                      <Text style={styles.recentItemText}>{location}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.suggestionSection}>
                  <Text style={styles.sectionLabel}>Suggested destinations</Text>
                  <SuggestionChips
                    suggestions={suggestedDestinations}
                    onSuggestionPress={handleLocationPress}
                  />
                </View>
              </>
            ) : (
              <View>
                <Text style={styles.sectionLabel}>Search results</Text>
                {filtered.length ? (
                  filtered.map((location) => (
                    <Pressable
                      key={location}
                      onPress={() => handleLocationPress(location)}
                      style={({ pressed }) => [styles.searchResultItem, pressed && styles.pressed]}
                    >
                      <Text style={styles.searchResultText}>{location}</Text>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>No results found for "{searchValue}".</Text>
                    <Pressable
                      onPress={onShowError}
                      style={({ pressed }) => [styles.errorButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.errorButtonText}>Show route help</Text>
                    </Pressable>
                  </View>
                )}
              </View>
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
    color: "#64748b",
    fontSize: 14,
  },
  listSection: {
    flex: 1,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 14,
    color: "#94a3b8",
  },
  recentItem: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentItemIconWrap: {
    height: 38,
    width: 38,
    borderRadius: 999,
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentItemText: {
    marginLeft: 12,
    color: "#e2e8f0",
    fontSize: 15,
  },
  suggestionSection: {
    marginBottom: 20,
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
