import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

type SettingsToggleRowProps = {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
};

export function SettingsToggleRow({
  label,
  description,
  enabled,
  onChange,
}: SettingsToggleRowProps) {
  return (
    <Pressable onPress={() => onChange(!enabled)} style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        trackColor={{ false: "#334155", true: "#0891b2" }}
        thumbColor={enabled ? "#e0f2fe" : "#cbd5e1"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: "#e2e8f0",
  },
  description: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
});
