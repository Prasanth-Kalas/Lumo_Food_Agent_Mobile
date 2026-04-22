import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Mic,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { useLumoChat } from "@/hooks/useLumoChat";
import { useSpeech } from "@/hooks/useSpeech";
import { colors } from "@/lib/colors";
import type { ChatMessage } from "@/lib/types";
import { MessageBubble } from "@/components/MessageBubble";
import { ToolResultRenderer } from "@/components/ToolResultRenderer";
import { TypingIndicator } from "@/components/TypingIndicator";
import { SuggestionRow } from "@/components/SuggestionRow";

const SUGGESTIONS = [
  "Order a large pepperoni pizza",
  "I want Thai food tonight",
  "Breakfast tacos, fast",
  "Something vegetarian, under $20",
];

export default function ChatScreen() {
  const { messages, isLoading, append, stop } = useLumoChat();
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const speech = useSpeech();
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages]);

  // Auto-speak new assistant messages when voice mode is on.
  useEffect(() => {
    if (!voiceMode) return;
    if (isLoading) return; // wait until streaming done
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    if (!last.content) return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    speech.speak(last.content);
  }, [messages, isLoading, voiceMode, speech]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    // Barge-in: cut Lumo off if she's talking when you send something
    speech.silence();
    append(text);
  };

  const toggleVoice = () => {
    setVoiceMode((v) => {
      const next = !v;
      if (!next) speech.silence();
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header
        voiceMode={voiceMode}
        onToggleVoice={toggleVoice}
        isSpeaking={speech.isSpeaking}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        style={{ flex: 1 }}
      >
        <FlatList<ChatMessage>
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }: { item: ChatMessage }) => (
            <View style={styles.messageGroup}>
              {item.content ? (
                <MessageBubble role={item.role}>{item.content}</MessageBubble>
              ) : null}
              {item.toolInvocations?.map((tc) => (
                <ToolResultRenderer
                  key={tc.toolCallId}
                  invocation={tc}
                  onQuickReply={(text) => {
                    speech.silence();
                    append(text);
                  }}
                />
              ))}
            </View>
          )}
          ListFooterComponent={isLoading ? <TypingIndicator /> : null}
          keyboardShouldPersistTaps="handled"
        />

        {messages.length === 0 && (
          <SuggestionRow
            suggestions={SUGGESTIONS}
            onPick={(s) => append(s)}
          />
        )}

        <View
          style={[
            styles.composerWrap,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <Pressable
            style={styles.micButton}
            accessibilityLabel="Voice input — coming in v0.2"
            disabled
          >
            <Mic color={colors.ink[400]} size={20} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="What are you hungry for?"
            placeholderTextColor={colors.ink[400]}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={send}
            editable={!isLoading}
          />
          <Pressable
            onPress={isLoading ? stop : send}
            style={[
              styles.sendButton,
              { backgroundColor: isLoading ? colors.ink[400] : colors.lumo[500] },
            ]}
            accessibilityLabel={isLoading ? "Stop" : "Send"}
          >
            {isLoading ? (
              <Square color={colors.white} size={16} fill={colors.white} />
            ) : (
              <Send color={colors.white} size={18} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({
  voiceMode,
  onToggleVoice,
  isSpeaking,
}: {
  voiceMode: boolean;
  onToggleVoice: () => void;
  isSpeaking: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Sparkles color={colors.white} size={16} />
        </View>
        <View>
          <Text style={styles.logoTitle}>Lumo</Text>
          <Text style={styles.logoSub}>Austin, TX · open now</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Pressable
          onPress={onToggleVoice}
          accessibilityRole="switch"
          accessibilityState={{ checked: voiceMode }}
          accessibilityLabel={
            voiceMode ? "Voice mode on — tap to mute" : "Voice mode off — tap to enable"
          }
          style={[
            styles.voiceChip,
            voiceMode ? styles.voiceChipOn : styles.voiceChipOff,
          ]}
        >
          {voiceMode ? (
            <Volume2
              color={isSpeaking ? colors.lumo[600] : colors.lumo[700]}
              size={14}
            />
          ) : (
            <VolumeX color={colors.ink[500]} size={14} />
          )}
          <Text
            style={[
              styles.voiceChipText,
              { color: voiceMode ? colors.lumo[700] : colors.ink[500] },
            ]}
          >
            Voice
          </Text>
        </Pressable>
        <Text style={styles.version}>v0.1 · demo</Text>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyBadge}>
        <Sparkles color={colors.white} size={24} />
      </View>
      <Text style={styles.emptyTitle}>Hungry? Just ask.</Text>
      <Text style={styles.emptyBody}>
        Tell Lumo what you want. It finds the restaurant, builds your order,
        and handles delivery — all in one conversation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.lumo[500],
    alignItems: "center",
    justifyContent: "center",
  },
  logoTitle: { fontSize: 14, fontWeight: "600", color: colors.ink[900] },
  logoSub: { fontSize: 11, color: colors.ink[500], marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  version: { fontSize: 11, color: colors.ink[400] },

  voiceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  voiceChipOn: {
    borderColor: colors.lumo[300],
    backgroundColor: colors.lumo[50],
  },
  voiceChipOff: {
    borderColor: colors.ink[200],
    backgroundColor: colors.white,
  },
  voiceChipText: { fontSize: 11, fontWeight: "600" },

  listContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  messageGroup: { gap: 8 },

  empty: { alignItems: "center", marginTop: 48, paddingHorizontal: 32 },
  emptyBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.lumo[500],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a2878",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.ink[500],
    textAlign: "center",
    lineHeight: 20,
  },

  composerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.ink[200],
    backgroundColor: colors.white,
    fontSize: 15,
    color: colors.ink[900],
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
