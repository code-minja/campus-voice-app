import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, Search } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { SuggestionChips } from "../components/SuggestionChips";
import { VoiceButton } from "../components/VoiceButton";

type ErrorStateScreenProps = {
  message?: string;
  onBack: () => void;
  onTryAgain: () => void;
  onUseSearch: () => void;
  onSelectSuggestion: (value: string) => void;
};

const suggestions = ["Library", "ETF", "Hostel"];

export function ErrorStateScreen({
  message = "I couldn't find that route",
  onBack,
  onTryAgain,
  onUseSearch,
  onSelectSuggestion,
}: ErrorStateScreenProps) {
  const insets = useSafeAreaInsets();
  const [isListening, setIsListening] = useState(false);
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutHandles.current.forEach((h) => clearTimeout(h));
    timeoutHandles.current = [];
  };

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
      setIsListening(false);
      onTryAgain();
    }, 2000);
    timeoutHandles.current.push(handle);
  };

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Route Help" subtitle="Let's try another option" onBack={onBack} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrapOuter}>
            <View style={styles.iconWrapInner}>
              <AlertCircle size={42} color="#fbbf24" />
            </View>
          </View>

          <Text style={styles.title}>{message}</Text>
          <Text style={styles.subtitle}>Try saying it differently or choose a nearby location</Text>

          <View style={styles.actionWrap}>
            <Pressable onPress={onTryAgain} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
              <Text style={styles.primaryActionText}>Try Again</Text>
            </Pressable>

            <Pressable onPress={onUseSearch} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
              <Search size={18} color="#94a3b8" />
              <Text style={styles.secondaryActionText}>Use Search Instead</Text>
            </Pressable>
          </View>

          <View style={styles.suggestionWrap}>
            <Text style={styles.suggestionLabel}>Or try these locations</Text>
            <SuggestionChips suggestions={suggestions} onSuggestionPress={onSelectSuggestion} />
          </View>

          <View style={[styles.voiceWrap, { paddingBottom: 10 + Math.max(insets.bottom, 8) }]}>
            <VoiceButton
              isListening={isListening}
              onPress={handleVoice}
              accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to retry by voice"}
              size={96}
              iconSize={34}
            />
            <Text style={styles.voiceHint}>
              {isListening ? "Listening for your request..." : "Or tap to speak your destination"}
            </Text>
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
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapOuter: {
    marginBottom: 18,
    width: 96,
    height: 96,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  iconWrapInner: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    backgroundColor: "rgba(30, 41, 59, 0.65)",
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 15,
    marginBottom: 20,
  },
  actionWrap: {
    width: "100%",
    gap: 10,
    marginBottom: 20,
  },
  primaryAction: {
    width: "100%",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "500",
  },
  secondaryAction: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    paddingVertical: 13,
    gap: 8,
  },
  secondaryActionText: {
    color: "#cbd5e1",
    fontSize: 16,
  },
  suggestionWrap: {
    width: "100%",
    marginBottom: 16,
  },
  suggestionLabel: {
    textAlign: "center",
    marginBottom: 8,
    color: "#94a3b8",
    fontSize: 14,
  },
  voiceWrap: {
    alignItems: "center",
  },
  voiceHint: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
