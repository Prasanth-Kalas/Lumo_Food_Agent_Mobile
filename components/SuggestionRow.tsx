import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "@/lib/colors";

export function SuggestionRow({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => onPick(s)}
          style={({ pressed }) => [
            styles.chip,
            pressed && { backgroundColor: colors.lumo[50] },
          ]}
        >
          <Text style={styles.text}>{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Without flexGrow: 0 the ScrollView eats all the remaining vertical space
  // above the composer, which then makes the chips inside stretch to full
  // height (cross-axis default is 'stretch') — giving giant ovals.
  scroll: { flexGrow: 0 },
  row: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    // Keep chips sized to their content instead of stretching vertically.
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: colors.white,
    shadowColor: "#101828",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 13, color: colors.ink[700] },
});
