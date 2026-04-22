/**
 * Stripe PaymentSheet card — the mobile analog of web's PaymentForm.
 *
 * Flow (mirrors the web path so the agent doesn't need to know the client):
 *   1. The agent returns a `payment_required` tool result with client_secret.
 *   2. We render a "Pay $x.xx" button.
 *   3. On tap we call initPaymentSheet({ paymentIntentClientSecret, ... })
 *      to pre-load Stripe's UI (prevents a visible flash on present).
 *   4. Then presentPaymentSheet() which shows Apple/Google Pay + card forms.
 *      The sheet handles 3DS, error UI, and retries internally.
 *   5. On success we fire onPaid() — the chat screen turns that into a
 *      synthetic user message ("payment confirmed") so the agent proceeds to
 *      place_order. As on web, the backend re-verifies PI status before
 *      committing, so we never trust the client alone.
 *
 * Expo Go cannot load native Stripe — this component only works in a
 * custom dev client / EAS Build. If the SDK init fails (missing key or
 * running in Go) we surface a readable error instead of crashing.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { CreditCard, Loader2, ShieldCheck, XCircle } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/format";

type Props = {
  clientSecret: string;
  publishableKey: string | null;
  amountCents: number;
  onPaid: () => void;
};

export function PaymentSheet({
  clientSecret,
  publishableKey,
  amountCents,
  onPaid,
}: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  // The StripeProvider at the root was given an empty key if the env var
  // was missing. In that case initPaymentSheet will throw. Fail fast with
  // a readable message so the user knows to deploy with the key.
  const keyConfigured = !!publishableKey && publishableKey.length > 0;

  async function onPay() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const init = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Lumo",
        // allowsDelayedPaymentMethods keeps us card-only for now; flip on
        // when we want to accept ACH / SEPA-style methods.
        allowsDelayedPaymentMethods: false,
      });
      if (init.error) {
        setError(init.error.message);
        setSubmitting(false);
        return;
      }

      const present = await presentPaymentSheet();
      if (present.error) {
        // Stripe returns code "Canceled" when the user dismisses the sheet —
        // that's a normal flow, not an error. Just reset.
        if (present.error.code === "Canceled") {
          setSubmitting(false);
          return;
        }
        setError(present.error.message);
        setSubmitting(false);
        return;
      }

      setSucceeded(true);
      onPaid();
    } catch (caught) {
      const msg =
        caught instanceof Error ? caught.message : "Unexpected payment error.";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (!keyConfigured) {
    return (
      <View style={styles.errorCard}>
        <XCircle size={14} color={colors.red[600]} />
        <Text style={styles.errorText}>
          Stripe publishable key missing. Set
          {" "}EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and rebuild.
        </Text>
      </View>
    );
  }

  if (succeeded) {
    return (
      <View style={styles.successCard}>
        <View style={styles.successIcon}>
          <ShieldCheck size={14} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.successTitle}>Payment confirmed</Text>
          <Text style={styles.successBody}>Placing your order now…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <CreditCard size={14} color={colors.lumo[500]} />
        <Text style={styles.headerText}>Payment</Text>
        <View style={styles.headerBadge}>
          <ShieldCheck size={10} color={colors.ink[500]} />
          <Text style={styles.headerBadgeText}>Stripe · test mode</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyText}>
          Tap to pay securely with Apple Pay, Google Pay, or card.
        </Text>

        {error && (
          <View style={styles.errorCard}>
            <XCircle size={14} color={colors.red[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={onPay}
          disabled={submitting}
          style={({ pressed }) => [
            styles.button,
            submitting && { opacity: 0.6 },
            pressed && !submitting && { opacity: 0.9 },
          ]}
        >
          {submitting ? (
            <>
              <Loader2 size={14} color={colors.white} />
              <Text style={styles.buttonText}>Processing…</Text>
            </>
          ) : (
            <Text style={styles.buttonText}>
              Pay {formatPrice(amountCents)}
            </Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          Use test card 4242 4242 4242 4242 · any future date · any CVC
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    overflow: "hidden",
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink[100],
    backgroundColor: colors.ink[50],
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[900],
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  headerBadgeText: {
    fontSize: 11,
    color: colors.ink[500],
  },
  body: {
    padding: 14,
    gap: 10,
  },
  bodyText: {
    fontSize: 13,
    color: colors.ink[600],
  },
  button: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.lumo[500],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: colors.ink[400],
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.red[50],
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.red[700],
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.emerald[100],
    backgroundColor: colors.emerald[50],
  },
  successIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.emerald[500],
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink[900],
  },
  successBody: {
    fontSize: 12,
    color: colors.ink[500],
  },
});
