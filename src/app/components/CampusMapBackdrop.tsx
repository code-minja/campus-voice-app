import { StyleSheet, View } from "react-native";

type CampusMapBackdropProps = {
  variant?: "preview" | "active";
};

export function CampusMapBackdrop({ variant = "preview" }: CampusMapBackdropProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.park, styles.parkA]} />
      <View style={[styles.park, styles.parkB]} />

      <View style={[styles.building, styles.buildingA]} />
      <View style={[styles.building, styles.buildingB]} />
      <View style={[styles.building, styles.buildingC]} />
      <View style={[styles.building, styles.buildingD]} />

      <View style={[styles.road, styles.roadHorizontal]} />
      <View style={[styles.road, styles.roadVertical]} />
      <View style={[styles.road, styles.roadDiagonal]} />

      <View style={[styles.route, variant === "active" ? styles.routeActive : styles.routePreview]} />
      <View style={styles.routeGlow} />

      <View style={styles.currentDot} />
      <View style={styles.destinationDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#121826",
    overflow: "hidden",
  },
  park: {
    position: "absolute",
    backgroundColor: "rgba(30, 58, 46, 0.55)",
    borderRadius: 8,
  },
  parkA: {
    top: 64,
    right: 18,
    width: 130,
    height: 150,
  },
  parkB: {
    bottom: 90,
    left: 16,
    width: 150,
    height: 190,
  },
  building: {
    position: "absolute",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 4,
  },
  buildingA: {
    top: 120,
    left: 42,
    width: 70,
    height: 90,
  },
  buildingB: {
    top: 220,
    left: 170,
    width: 84,
    height: 72,
  },
  buildingC: {
    top: 360,
    right: 24,
    width: 86,
    height: 94,
  },
  buildingD: {
    bottom: 180,
    right: 90,
    width: 72,
    height: 58,
  },
  road: {
    position: "absolute",
    backgroundColor: "rgba(45, 55, 72, 0.9)",
  },
  roadHorizontal: {
    top: "47%",
    left: -40,
    right: -40,
    height: 30,
  },
  roadVertical: {
    left: "48%",
    top: -100,
    bottom: -100,
    width: 28,
  },
  roadDiagonal: {
    width: 28,
    height: "130%",
    left: "42%",
    top: -120,
    transform: [{ rotate: "-27deg" }],
  },
  route: {
    position: "absolute",
    backgroundColor: "#22d3ee",
    height: 6,
    borderRadius: 99,
    transform: [{ rotate: "-50deg" }],
  },
  routePreview: {
    width: 290,
    left: 58,
    top: "53%",
  },
  routeActive: {
    width: 310,
    left: 36,
    top: "58%",
  },
  routeGlow: {
    position: "absolute",
    width: 290,
    height: 12,
    borderRadius: 99,
    left: 58,
    top: "53%",
    transform: [{ rotate: "-50deg" }],
    backgroundColor: "rgba(34, 211, 238, 0.4)",
  },
  currentDot: {
    position: "absolute",
    left: "47%",
    bottom: 120,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
    borderWidth: 3,
    borderColor: "rgba(224, 242, 254, 0.6)",
  },
  destinationDot: {
    position: "absolute",
    right: "23%",
    top: 108,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    borderWidth: 3,
    borderColor: "rgba(254, 202, 202, 0.45)",
  },
});
