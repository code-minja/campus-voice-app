import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin, Settings } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { SuggestionChips } from "../components/SuggestionChips";
import { VoiceButton } from "../components/VoiceButton";
import { VoiceWaveIndicator } from "../components/VoiceWaveIndicator";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";

type HomeScreenProps = {
  currentLocation: string;
  onStartVoiceNavigation: (destination: string) => void;
  onOpenSettings: () => void;
};

const suggestions = ["Library", "ETF", "Hostel"];

export function HomeScreen({
  currentLocation,
  onStartVoiceNavigation,
  onOpenSettings,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const hasPlayedWelcomeRef = useRef(false);
  const { isListening, transcript, beginVoiceSession, handleVoicePress, handleSuggestionPress } =
    useVoiceNavigation({
      onStartVoiceNavigation,
    });

  const locationPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(locationPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(locationPulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [locationPulse]);

  useEffect(() => {
    if (hasPlayedWelcomeRef.current) {
      return;
    }

    hasPlayedWelcomeRef.current = true;
    void beginVoiceSession();
  }, []);

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.topBar}>
            <View style={styles.locationRow}>
              <View style={styles.iconWrap}>
                <Animated.View
                  style={[
                    styles.pulseDot,
                    {
                      opacity: locationPulse.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 0.3, 1],
                      }),
                      transform: [
                        {
                          scale: locationPulse.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [1, 1.2, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <MapPin size={16} color="#22d3ee" strokeWidth={2} />
              </View>
              <View style={styles.locationTextWrap}>
                <Text style={styles.locationLabel}>You are at</Text>
                <Text style={styles.locationValue}>{currentLocation}</Text>
              </View>
            </View>

            <Pressable
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Settings size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <Text style={styles.title}>Campus Voice</Text>
          <Text style={styles.subtitle}>Voice-first navigation assistant</Text>
        </View>

        <View style={styles.main}>
          <View style={styles.promptWrap}>
            <Text style={styles.prompt}>{isListening ? "I'm listening..." : "Where would you like to go?"}</Text>
            <VoiceWaveIndicator isActive={isListening} />
            {!!transcript && !isListening && <Text style={styles.transcript}>"{transcript}"</Text>}
          </View>

          <VoiceButton
            isListening={isListening}
            onPress={handleVoicePress}
            accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to speak"}
          />

          <Text style={styles.hint}>Tap the microphone to speak</Text>
        </View>

        <View style={[styles.bottomSection, { paddingBottom: 20 + Math.max(insets.bottom, 8) }]}>
          <Text style={styles.quickLabel}>Quick locations</Text>
          <SuggestionChips suggestions={suggestions} onSuggestionPress={handleSuggestionPress} />
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
    paddingBottom: 8,
  },
  topBar: {
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  locationRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    height: 20,
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseDot: {
    position: "absolute",
    top: 1,
    left: 1,
    height: 8,
    width: 8,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
  },
  locationTextWrap: {
    marginLeft: 8,
  },
  locationLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  locationValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#cbd5e1",
  },
  settingsButton: {
    height: 40,
    width: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.96 }],
  },
  title: {
    textAlign: "center",
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  subtitle: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  promptWrap: {
    alignItems: "center",
    marginBottom: 40,
  },
  prompt: {
    textAlign: "center",
    fontSize: 30,
    lineHeight: 36,
    color: "#e2e8f0",
  },
  transcript: {
    marginTop: 16,
    fontSize: 20,
    color: "#22d3ee",
    textAlign: "center",
  },
  hint: {
    marginTop: 26,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  bottomSection: {
    paddingBottom: 24,
  },
  quickLabel: {
    marginBottom: 14,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
  },
});
