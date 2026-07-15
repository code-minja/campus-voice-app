import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { StackHeader } from "../components/StackHeader";
import { VoiceButton } from "../components/VoiceButton";

type LocationResult = {
  id: string;
  name: string;
  descriptor: string;
  distance?: string;
};

type SearchResultsScreenProps = {
  query?: string;
  onBack: () => void;
  onSelectLocation: (name: string) => void;
};

const defaultResults: LocationResult[] = [
  {
    id: "1",
    name: "Main Library",
    descriptor: "Near ETF Building",
    distance: "300m away",
  },
  {
    id: "2",
    name: "Medical Library",
    descriptor: "Opposite Admin Block",
    distance: "450m away",
  },
  {
    id: "3",
    name: "Law Library",
    descriptor: "Inside Law Faculty",
    distance: "800m away",
  },
];

export function SearchResultsScreen({ query, onBack, onSelectLocation }: SearchResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const [isListening, setIsListening] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timeoutHandles = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutHandles.current.forEach((handle) => clearTimeout(handle));
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
      const picked = defaultResults[0];
      setSelectedId(picked.id);
      setIsListening(false);
      const selectHandle = setTimeout(() => onSelectLocation(picked.name), 250);
      timeoutHandles.current.push(selectHandle);
    }, 2000);
    timeoutHandles.current.push(handle);
  };

  const handleLocationTap = (result: LocationResult) => {
    setSelectedId(result.id);
    const handle = setTimeout(() => onSelectLocation(result.name), 250);
    timeoutHandles.current.push(handle);
  };

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Results" subtitle="Multiple matches found" onBack={onBack} />
        </View>

        <View style={styles.content}>
          <View style={styles.contextBlock}>
            <Text style={styles.contextCaption}>I found multiple results</Text>
            <Text style={styles.contextHeading}>
              {query ? `Which "${query}" do you mean?` : "Which location do you mean?"}
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 18 }}
          >
            {defaultResults.map((result) => {
              const selected = selectedId === result.id;
              return (
                <Pressable
                  key={result.id}
                  onPress={() => handleLocationTap(result)}
                  style={({ pressed }) => [
                    styles.resultCard,
                    selected && styles.resultCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.resultIconWrap, selected && styles.resultIconWrapSelected]}>
                    <MapPin size={18} color={selected ? "#22d3ee" : "#94a3b8"} />
                  </View>

                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultTitle}>{result.name}</Text>
                    <Text style={styles.resultDescriptor}>{result.descriptor}</Text>
                    {!!result.distance && <Text style={styles.resultDistance}>{result.distance}</Text>}
                  </View>

                  {selected && <View style={styles.selectedDot} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.voiceHint}>
            {isListening ? "Listening for your choice..." : "You can say the name to choose"}
          </Text>

          <View style={[styles.voiceButtonWrap, { paddingBottom: 20 + Math.max(insets.bottom, 8) }]}>
            <VoiceButton
              isListening={isListening}
              onPress={handleVoice}
              accessibilityLabel={isListening ? "Listening, tap to stop" : "Tap to choose by voice"}
              size={96}
              iconSize={34}
            />
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
  contextBlock: {
    marginBottom: 18,
    alignItems: "center",
  },
  contextCaption: {
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#64748b",
    marginBottom: 8,
  },
  contextHeading: {
    color: "#ffffff",
    fontSize: 28,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  resultCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  resultCardSelected: {
    borderColor: "rgba(34, 211, 238, 0.8)",
    backgroundColor: "rgba(15, 118, 110, 0.23)",
  },
  resultIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  resultIconWrapSelected: {
    backgroundColor: "rgba(34, 211, 238, 0.18)",
  },
  resultTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 18,
  },
  resultDescriptor: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 14,
  },
  resultDistance: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#22d3ee",
    shadowColor: "#22d3ee",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  voiceHint: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 14,
    color: "#64748b",
  },
  voiceButtonWrap: {
    alignItems: "center",
    marginTop: 14,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
