import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Plus, Star, Trash2 } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import type { SavedLocation } from "../types";

type SavedLocationsScreenProps = {
  savedLocations: SavedLocation[];
  onBack: () => void;
  onSelectLocation: (location: SavedLocation) => void;
  onAddLocation: () => void;
  onUpdateLocations: (locations: SavedLocation[]) => void;
};

export function SavedLocationsScreen({
  savedLocations,
  onBack,
  onSelectLocation,
  onAddLocation,
  onUpdateLocations,
}: SavedLocationsScreenProps) {
  const insets = useSafeAreaInsets();
  const [locations, setLocations] = useState(savedLocations);

  useEffect(() => {
    setLocations(savedLocations);
  }, [savedLocations]);

  const handleToggleFavorite = (id: string) => {
    const updated = locations.map((loc) =>
      loc.id === id ? { ...loc, isFavorite: !loc.isFavorite } : loc,
    );
    setLocations(updated);
    onUpdateLocations(updated);
  };

  const handleDelete = (id: string) => {
    const updated = locations.filter((loc) => loc.id !== id);
    setLocations(updated);
    onUpdateLocations(updated);
  };

  const isEmpty = locations.length === 0;

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Saved Locations" subtitle="Quick access to your places" onBack={onBack} />
        </View>

        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <MapPin size={38} color="#475569" />
            </View>
            <Text style={styles.emptyTitle}>No saved places yet</Text>
            <Text style={styles.emptySubtitle}>Save your favorite locations for quick access</Text>

            <Pressable onPress={onAddLocation} style={({ pressed }) => [styles.addFirstButton, pressed && styles.pressed]}>
              <Plus size={18} color="#ffffff" />
              <Text style={styles.addFirstButtonText}>Add your first location</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 14 }}
            >
              <Text style={styles.countLabel}>
                {locations.length} {locations.length === 1 ? "place" : "places"} saved
              </Text>

              {locations.map((location) => (
                <View key={location.id} style={styles.card}>
                  <Pressable onPress={() => onSelectLocation(location)} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
                    <View style={[styles.cardIconWrap, location.isFavorite && styles.cardIconFavorite]}>
                      <MapPin size={20} color={location.isFavorite ? "#22d3ee" : "#94a3b8"} />
                    </View>

                    <View style={styles.cardTextWrap}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{location.name}</Text>
                        {location.isFavorite && <Star size={14} color="#fbbf24" fill="#fbbf24" />}
                      </View>
                      <Text style={styles.cardSubtitle}>{location.subtitle}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => handleToggleFavorite(location.id)}
                      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                    >
                      <Star
                        size={18}
                        color={location.isFavorite ? "#fbbf24" : "#64748b"}
                        fill={location.isFavorite ? "#fbbf24" : "transparent"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(location.id)}
                      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                    >
                      <Trash2 size={18} color="#f87171" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ paddingBottom: 18 + Math.max(insets.bottom, 8) }}>
              <Pressable onPress={onAddLocation} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                <Plus size={18} color="#22d3ee" />
                <Text style={styles.addButtonText}>Add New Location</Text>
              </Pressable>
            </View>
          </>
        )}
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
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    color: "#cbd5e1",
    fontSize: 22,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#64748b",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 20,
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  addFirstButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  countLabel: {
    marginBottom: 10,
    color: "#94a3b8",
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    borderRadius: 16,
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  cardIconFavorite: {
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  cardTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 17,
  },
  cardSubtitle: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 14,
  },
  cardActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.8)",
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    paddingVertical: 14,
    gap: 8,
  },
  addButtonText: {
    color: "#e2e8f0",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
