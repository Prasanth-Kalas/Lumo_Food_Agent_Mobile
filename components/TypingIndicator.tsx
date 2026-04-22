import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "@/lib/colors";

export function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      {dots.map((opacity, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ink[400],
  },
});
