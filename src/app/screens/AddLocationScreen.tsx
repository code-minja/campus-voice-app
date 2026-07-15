import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MapPin, Star } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { SuggestionChips } from "../components/SuggestionChips";
import { VoiceButton } from "../components/VoiceButton";
import type { NewSavedLocation } from "../types";

type AddLocationScreenProps = {
  onBack: () => void;
  onSave: (location: NewSavedLocation) => void;
};

const suggestedLocations = [
  "Library",
  "Student Center",
  "Gym",
  "Cafeteria",
  "ETF",
  "Hostel",
];

const defaultSubtitles: Record<string, string> = {
  Library: "Near ETF Building",
  "Student Center": "Campus Central",
  Gym: "Sports Complex",
  Cafeteria: "Main Dining Hall",
  ETF: "Engineering Building",
  Hostel: "Student Residence",
};

export function AddLocationScreen({ onBack, onSave }: AddLocationScreenProps) {
  const insets = useSafeAreaInsets();
  const [locationName, setLocationName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutHandles.current.forEach((h) => clearTimeout(h));
    timeoutHandles.current = [];
  };

  const isValid = locationName.trim().length > 0;

  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, []);

  const handleVoice = () => {
    clearTimeouts();

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    const handle = setTimeout(() => {
      setLocationName("Main Library");
      setSubtitle("Near ETF Building");
      setIsListening(false);
    }, 2000);
    timeoutHandles.current.push(handle);
  };

  const handleSuggestion = (suggestion: string) => {
    setLocationName(suggestion);
    setSubtitle(defaultSubtitles[suggestion] ?? "Campus location");
  };

  const handleSave = () => {
    if (!isValid) {
      return;
    }

    setShowSuccess(true);
    const handle = setTimeout(() => {
      onSave({
        name: locationName.trim(),
        subtitle: subtitle.trim() || "Campus location",
        isFavorite,
      });
      setShowSuccess(false);
    }, 700);
    timeoutHandles.current.push(handle);
  };

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Add Location" subtitle="Save a new place" onBack={onBack} />
        </View>

        <View style={styles.content}>
          {showSuccess && (
            <View style={styles.successOverlay}>
              <View style={styles.successIconWrap}>
                <Check size={40} color="#ffffff" strokeWidth={3} />
              </View>
              <Text style={styles.successText}>Location saved!</Text>
            </View>
          )}

          <Text style={styles.voiceHint}>
            {isListening ? "Listening for location..." : "Use voice or select from suggestions"}
          </Text>
          <View style={styles.voiceButtonWrap}>
            <VoiceButton
              isListening={isListening}
              onPress={handleVoice}
              accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to capture location by voice"}
              size={96}
              iconSize={34}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.sectionLabel}>Quick locations</Text>
          <SuggestionChips suggestions={suggestedLocations} onSuggestionPress={handleSuggestion} />

          <View style={styles.formWrap}>
            <Text style={styles.inputLabel}>Location Name *</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="e.g., Main Library"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
              <MapPin size={18} color="#64748b" />
            </View>

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="e.g., Near ETF Building"
              placeholderTextColor="#64748b"
              style={styles.input}
            />

            <Pressable
              onPress={() => setIsFavorite((prev) => !prev)}
              style={({ pressed }) => [
                styles.favoriteToggle,
                isFavorite && styles.favoriteToggleActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.favoriteLeft}>
                <Star
                  size={18}
                  color={isFavorite ? "#fbbf24" : "#64748b"}
                  fill={isFavorite ? "#fbbf24" : "transparent"}
                />
                <Text style={styles.favoriteText}>Mark as favorite</Text>
              </View>
              {isFavorite && <View style={styles.favoriteDot} />}
            </Pressable>
          </View>

          <View style={{ marginTop: "auto", paddingBottom: 20 + Math.max(insets.bottom, 8) }}>
            <Pressable
              disabled={!isValid}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveButton,
                !isValid && styles.saveButtonDisabled,
                pressed && isValid && styles.pressed,
              ]}
            >
              <Check size={18} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Location</Text>
            </Pressable>
            {!isValid && <Text style={styles.requiredText}>Location name is required</Text>}
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
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: "rgba(2, 6, 23, 0.83)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  successIconWrap: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06b6d4",
    marginBottom: 10,
  },
  successText: {
    color: "#ffffff",
    fontSize: 22,
  },
  voiceHint: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 8,
  },
  voiceButtonWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#64748b",
    fontSize: 11,
  },
  sectionLabel: {
    marginBottom: 8,
    color: "#94a3b8",
    fontSize: 14,
  },
  formWrap: {
    marginTop: 8,
  },
  inputLabel: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 15,
    paddingVertical: 12,
  },
  favoriteToggle: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  favoriteToggleActive: {
    borderColor: "rgba(251, 191, 36, 0.6)",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  favoriteLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  favoriteText: {
    marginLeft: 8,
    color: "#e2e8f0",
    fontSize: 15,
  },
  favoriteDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#fbbf24",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 17,
  },
  requiredText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
