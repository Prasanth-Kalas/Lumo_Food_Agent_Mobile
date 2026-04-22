import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { colors } from "@/lib/colors";

/**
 * We wrap the whole app in <StripeProvider> so any screen can open a
 * PaymentSheet without re-initialising the SDK. The publishable key comes
 * from EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — Expo inlines that at build
 * time. If it's missing we pass an empty string; PaymentSheet.tsx detects
 * that case and renders the "cash on delivery" fallback instead of booting
 * the SDK. The merchantIdentifier must match the one declared in app.json's
 * @stripe/stripe-react-native plugin — Apple Pay support reads from it.
 */
export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={publishableKey}
          merchantIdentifier="merchant.com.lumotechnologies.lumo"
        >
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
