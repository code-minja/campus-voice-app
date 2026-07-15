import { Pressable, PressableStateCallbackType, StyleSheet, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";

type SuggestionChipsProps = {
  suggestions: string[];
  onSuggestionPress: (value: string) => void;
};

type InteractiveState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

export function SuggestionChips({ suggestions, onSuggestionPress }: SuggestionChipsProps) {
  return (
    <View style={styles.wrap}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSuggestionPress(suggestion)}
          style={(state: InteractiveState) => [
            styles.chip,
            (state.focused || state.hovered || state.pressed) && styles.chipRing,
            state.pressed && styles.chipPressed,
          ]}
        >
          <MapPin size={14} color="#22d3ee" />
          <Text style={styles.chipText}>{suggestion}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    marginHorizontal: 6,
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chipRing: {
    borderColor: "rgba(34, 211, 238, 0.85)",
    shadowColor: "#22d3ee",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  chipText: {
    marginLeft: 8,
    color: "#e2e8f0",
    fontSize: 14,
  },
});
