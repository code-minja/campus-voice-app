import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

type VoiceWaveIndicatorProps = {
  isActive: boolean;
  barCount?: number;
};

export function VoiceWaveIndicator({ isActive, barCount = 5 }: VoiceWaveIndicatorProps) {
  const bars = useRef(Array.from({ length: barCount }, () => new Animated.Value(8))).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    if (isActive) {
      bars.forEach((bar, index) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(index * 120),
            Animated.timing(bar, {
              toValue: 24,
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(bar, {
              toValue: 12,
              duration: 180,
              useNativeDriver: false,
            }),
            Animated.timing(bar, {
              toValue: 20,
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(bar, {
              toValue: 8,
              duration: 220,
              useNativeDriver: false,
            }),
          ]),
        );
        loops.push(loop);
        loop.start();
      });
    } else {
      bars.forEach((bar) => bar.setValue(8));
    }

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [bars, isActive]);

  if (!isActive) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {bars.map((height, idx) => (
        <Animated.View key={`wave-${idx}`} style={[styles.bar, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  bar: {
    width: 4,
    marginHorizontal: 3,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
  },
});
