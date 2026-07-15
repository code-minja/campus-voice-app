import { ReactNode } from "react";
import { Pressable, PressableStateCallbackType, StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";

type StackHeaderProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightSlot?: ReactNode;
};

type InteractiveState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

export function StackHeader({ title, subtitle, onBack, rightSlot }: StackHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        style={(state: InteractiveState) => [
          styles.backButton,
          (state.focused || state.hovered || state.pressed) && styles.backButtonRing,
          state.pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={20} color="#cbd5e1" />
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : <View style={styles.rightSlot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    height: 40,
    width: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonRing: {
    borderColor: "rgba(34, 211, 238, 0.85)",
    shadowColor: "#22d3ee",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.96 }],
  },
  titleBlock: {
    marginLeft: 14,
    flex: 1,
  },
  title: {
    fontSize: 22,
    color: "#ffffff",
    fontWeight: "500",
  },
  subtitle: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 12,
  },
  rightSlot: {
    width: 40,
    alignItems: "flex-end",
  },
});
