import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/colors";
import type { ChatRole } from "@/lib/types";

export function MessageBubble({
  role,
  children,
}: {
  role: ChatRole;
  children: string;
}) {
  const isUser = role === "user";
  return (
    <View
      style={[
        styles.row,
        { justifyContent: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isUser ? colors.white : colors.ink[900] },
          ]}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%" },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  userBubble: {
    backgroundColor: colors.lumo[500],
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink[100],
  },
  text: { fontSize: 15, lineHeight: 21 },
});
