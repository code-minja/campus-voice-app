import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MapPin, Star } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { SuggestionChips } from "../components/SuggestionChips";
import type { NewSavedLocation } from "../types";
import { getCampusLocations, type CampusLocation } from "../services/campusLocations";

type AddLocationScreenProps = {
  onBack: () => void;
  onSave: (location: NewSavedLocation) => void;
};

export function AddLocationScreen({ onBack, onSave }: AddLocationScreenProps) {
  const insets = useSafeAreaInsets();
  const [locationName, setLocationName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [locationsError, setLocationsError] = useState("");

  const normalizeName = (value: string) =>
    value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const selectedLocation = locations.find((location) =>
    [location.name, ...location.aliases].some(
      (name) => normalizeName(name) === normalizeName(locationName),
    ),
  );
  const isValid = Boolean(selectedLocation);

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

  const handleSuggestion = (suggestion: string) => {
    setLocationName(suggestion);
  };

  const handleSave = () => {
    if (!selectedLocation) {
      return;
    }

    onSave({
      name: selectedLocation.name,
      subtitle: subtitle.trim() || "AAUA campus destination",
      isFavorite,
    });
  };

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Add Location" subtitle="Save a new place" onBack={onBack} />
        </View>

        <View style={styles.content}>
          <Text style={styles.voiceHint}>
            {selectedLocation
              ? `${selectedLocation.name} is a campus destination`
              : "Select a destination from the live campus list"}
          </Text>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>CAMPUS DESTINATIONS</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.sectionLabel}>Choose a valid campus destination</Text>
          {!!locationsError && (
            <Text style={styles.requiredText}>{locationsError}</Text>
          )}
          {locations.length ? (
            <SuggestionChips
              suggestions={locations.map((location) => location.name)}
              onSuggestionPress={handleSuggestion}
            />
          ) : (
            !locationsError && (
              <Text style={styles.requiredText}>
                Loading campus destinations...
              </Text>
            )
          )}

          <View style={styles.formWrap}>
            <Text style={styles.inputLabel}>Location Name *</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Choose or enter a campus destination"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
              <MapPin size={18} color="#64748b" />
            </View>

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Optional description"
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
            {!isValid && locations.length > 0 && (
              <Text style={styles.requiredText}>
                Select a destination from the campus list
              </Text>
            )}
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
  voiceHint: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 8,
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
