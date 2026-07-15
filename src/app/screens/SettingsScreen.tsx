import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight,
  Eye,
  History,
  Info,
  MapPin,
  Mic,
  Navigation,
  User,
  Volume2,
} from "lucide-react-native";
import { MapBackground } from "../components/MapBackground";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { StackHeader } from "../components/StackHeader";

type SettingsScreenProps = {
  onBack: () => void;
  onOpenSavedLocations: () => void;
};

export function SettingsScreen({ onBack, onOpenSavedLocations }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  const [voiceOnlyMode, setVoiceOnlyMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  const [autoSpeakDirections, setAutoSpeakDirections] = useState(true);
  const [interruptVoice, setInterruptVoice] = useState(true);

  const [avoidStairs, setAvoidStairs] = useState(false);
  const [shortestRoute, setShortestRoute] = useState(true);
  const [saferPaths, setSaferPaths] = useState(false);

  const [soundEffects, setSoundEffects] = useState(true);
  const [voiceConfirmation, setVoiceConfirmation] = useState(true);

  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [alertsIntensity, setAlertsIntensity] = useState(1);

  const speedLabels = ["Slow", "Normal", "Fast"];
  const alertsLabels = ["Low", "Medium", "High"];

  return (
    <View style={styles.root}>
      <MapBackground />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <StackHeader title="Settings" subtitle="Personalize your experience" onBack={onBack} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 + Math.max(insets.bottom, 8) }}
        >
          <Section title="Accessibility" icon={<Eye size={16} color="#22d3ee" />}>
            <SettingsToggleRow
              label="Voice-Only Mode"
              description="Navigate without looking at screen"
              enabled={voiceOnlyMode}
              onChange={setVoiceOnlyMode}
            />
            <Divider />
            <SettingsToggleRow
              label="High Contrast Mode"
              description="Increase visibility of elements"
              enabled={highContrast}
              onChange={setHighContrast}
            />
            <Divider />
            <SettingsToggleRow
              label="Large Text Mode"
              description="Make text easier to read"
              enabled={largeText}
              onChange={setLargeText}
            />
            <Divider />
            <SettingsToggleRow
              label="Haptic Feedback"
              description="Vibration for interactions"
              enabled={hapticFeedback}
              onChange={setHapticFeedback}
            />
          </Section>

          <Section title="Voice Settings" icon={<Mic size={16} color="#22d3ee" />}>
            <OptionSelector
              title="Voice Speed"
              labels={speedLabels}
              selectedIndex={voiceSpeed}
              onChange={setVoiceSpeed}
            />
            <Divider />
            <SettingsToggleRow
              label="Auto Speak Directions"
              description="Announce turns automatically"
              enabled={autoSpeakDirections}
              onChange={setAutoSpeakDirections}
            />
            <Divider />
            <SettingsToggleRow
              label="Interrupt Voice Anytime"
              description="Tap mic to override current speech"
              enabled={interruptVoice}
              onChange={setInterruptVoice}
            />
          </Section>

          <Section title="Navigation Preferences" icon={<Navigation size={16} color="#22d3ee" />}>
            <SettingsToggleRow
              label="Avoid Stairs"
              description="Accessible routing for mobility"
              enabled={avoidStairs}
              onChange={setAvoidStairs}
            />
            <Divider />
            <SettingsToggleRow
              label="Shortest Route"
              description="Prioritize quickest path"
              enabled={shortestRoute}
              onChange={setShortestRoute}
            />
            <Divider />
            <SettingsToggleRow
              label="Safer / Simpler Paths"
              description="Less complex routes"
              enabled={saferPaths}
              onChange={setSaferPaths}
            />
          </Section>

          <Section title="Feedback Settings" icon={<Volume2 size={16} color="#22d3ee" />}>
            <SettingsToggleRow
              label="Sound Effects"
              description="Audio cues for actions"
              enabled={soundEffects}
              onChange={setSoundEffects}
            />
            <Divider />
            <SettingsToggleRow
              label="Voice Confirmation"
              description="Confirm actions with voice"
              enabled={voiceConfirmation}
              onChange={setVoiceConfirmation}
            />
            <Divider />
            <OptionSelector
              title="Navigation Alerts"
              labels={alertsLabels}
              selectedIndex={alertsIntensity}
              onChange={setAlertsIntensity}
            />
          </Section>

          <Section title="Account & App" icon={<User size={16} color="#22d3ee" />}>
            <LinkRow label="Saved Locations" icon={<MapPin size={18} color="#22d3ee" />} onPress={onOpenSavedLocations} />
            <LinkRow label="Navigation History" icon={<History size={18} color="#22d3ee" />} />
            <LinkRow label="About Campus Voice" icon={<Info size={18} color="#22d3ee" />} />
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function Section({ title, icon, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIconWrap}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function OptionSelector({
  title,
  labels,
  selectedIndex,
  onChange,
}: {
  title: string;
  labels: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <View style={styles.optionWrap}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionValue}>{labels[selectedIndex]}</Text>
      </View>
      <View style={styles.optionButtonsRow}>
        {labels.map((label, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={label}
              onPress={() => onChange(index)}
              style={({ pressed }) => [
                styles.optionButton,
                selected && styles.optionButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionButtonText, selected && styles.optionButtonTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LinkRow({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <View style={styles.linkLeft}>
        <View style={styles.linkIconWrap}>{icon}</View>
        <Text style={styles.linkText}>{label}</Text>
      </View>
      <ChevronRight size={18} color="#64748b" />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  sectionTitle: {
    marginLeft: 10,
    color: "#22d3ee",
    fontSize: 14,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    borderRadius: 16,
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  optionWrap: {
    paddingVertical: 12,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  optionTitle: {
    color: "#e2e8f0",
    fontSize: 16,
  },
  optionValue: {
    color: "#22d3ee",
    fontSize: 14,
  },
  optionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    backgroundColor: "rgba(51, 65, 85, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  optionButtonSelected: {
    borderColor: "rgba(34, 211, 238, 0.8)",
    backgroundColor: "rgba(34, 211, 238, 0.12)",
  },
  optionButtonText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  optionButtonTextSelected: {
    color: "#67e8f9",
  },
  linkRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.65)",
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.15)",
  },
  linkText: {
    marginLeft: 10,
    color: "#e2e8f0",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
