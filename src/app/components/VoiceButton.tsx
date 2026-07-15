import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  View,
} from "react-native";
import { Mic } from "lucide-react-native";

type VoiceButtonProps = {
  isListening: boolean;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  accessibilityLabel?: string;
};

type InteractiveState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};

export function VoiceButton({
  isListening,
  onPress,
  size = 112,
  iconSize = 44,
  accessibilityLabel,
}: VoiceButtonProps) {
  const ringOuter = useRef(new Animated.Value(0)).current;
  const ringInner = useRef(new Animated.Value(0)).current;
  const buttonGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let outerLoop: Animated.CompositeAnimation | undefined;
    let innerLoop: Animated.CompositeAnimation | undefined;
    let glowLoop: Animated.CompositeAnimation | undefined;

    if (isListening) {
      ringOuter.setValue(0);
      ringInner.setValue(0);
      buttonGlow.setValue(0);

      outerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(ringOuter, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(ringOuter, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

      innerLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(ringInner, {
            toValue: 1,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(ringInner, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

      glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonGlow, {
            toValue: 1,
            duration: 700,
            useNativeDriver: false,
          }),
          Animated.timing(buttonGlow, {
            toValue: 0,
            duration: 700,
            useNativeDriver: false,
          }),
        ]),
      );

      outerLoop.start();
      innerLoop.start();
      glowLoop.start();
    } else {
      ringOuter.setValue(0);
      ringInner.setValue(0);
      buttonGlow.setValue(0);
    }

    return () => {
      outerLoop?.stop();
      innerLoop?.stop();
      glowLoop?.stop();
    };
  }, [buttonGlow, isListening, ringInner, ringOuter]);

  const ringSize = Math.round(size * 1.05);

  return (
    <View style={[styles.container, { width: size + 40, height: size + 40 }]}> 
      {isListening && (
        <>
          <Animated.View
            style={[
              styles.ring,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                opacity: ringOuter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 0],
                }),
                transform: [
                  {
                    scale: ringOuter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.7],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ringSecondary,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                opacity: ringInner.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    scale: ringInner.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.45],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      )}

      <Pressable
        onPress={onPress}
        style={(state: InteractiveState) => [
          (state.focused || state.hovered || state.pressed) && styles.buttonRing,
          state.pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View
          style={[
            styles.button,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              shadowOpacity: buttonGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 0.75],
              }),
              shadowRadius: buttonGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 30],
              }),
            },
          ]}
        >
          <Mic
            size={iconSize}
            color="#ffffff"
            strokeWidth={2.5}
            fill={isListening ? "#ffffff" : "transparent"}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    backgroundColor: "rgba(34, 211, 238, 0.2)",
  },
  ringSecondary: {
    position: "absolute",
    backgroundColor: "rgba(34, 211, 238, 0.3)",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0ea5e9",
    borderWidth: 1,
    borderColor: "rgba(186, 230, 253, 0.8)",
    shadowColor: "#22d3ee",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  buttonRing: {
    borderRadius: 999,
    shadowColor: "#22d3ee",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 5,
  },
});
