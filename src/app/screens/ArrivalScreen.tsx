import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MapPin, Clock, Footprints } from "lucide-react-native";

type ArrivalScreenProps = {
  destination: string;
  durationSeconds: number;
  distanceMeters: number;
  onFinish: () => void;
};

const METERS_PER_STEP = 0.75;

export function ArrivalScreen({
  destination,
  durationSeconds,
  distanceMeters,
  onFinish,
}: ArrivalScreenProps) {
  const insets = useSafeAreaInsets();

  const steps = Math.max(1, Math.round(distanceMeters / METERS_PER_STEP));
  const roundedMinutes = Math.max(1, Math.round(durationSeconds / 60));

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View
          style={[
            styles.inner,
            {
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: 24 + Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.spacer} />

          <View style={styles.centerCard}>
            <View style={styles.successRippleOuter}>
              <View style={styles.successRippleMiddle}>
                <View style={styles.successIconBadge}>
                  <Check size={36} color="#020617" strokeWidth={3} />
                </View>
              </View>
            </View>

            <Text style={styles.title}>You have arrived!</Text>
            <Text style={styles.subtitle}>Welcome to {destination}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Clock size={20} color="#22d3ee" />
                <Text style={styles.statValue}>{roundedMinutes} min</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>

              <View style={styles.statBox}>
                <Footprints size={20} color="#22d3ee" />
                <Text style={styles.statValue}>{steps}</Text>
                <Text style={styles.statLabel}>Footsteps</Text>
              </View>

              <View style={styles.statBox}>
                <MapPin size={20} color="#22d3ee" />
                <Text style={styles.statValue}>{Math.round(distanceMeters)}m</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            </View>
          </View>

          <View style={styles.spacer} />

          <Pressable
            onPress={onFinish}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
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
    paddingHorizontal: 24,
  },
  inner: {
    flex: 1,
    justifyContent: "space-between",
  },
  spacer: {
    flex: 1,
  },
  centerCard: {
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    paddingVertical: 36,
    paddingHorizontal: 24,
    width: "100%",
  },
  successRippleOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34, 211, 238, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successRippleMiddle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(34, 211, 238, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22d3ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.4)",
    paddingVertical: 16,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: "#22d3ee",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22d3ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    color: "#020617",
    fontSize: 18,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
