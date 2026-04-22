import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Check,
  ChefHat,
  Clock,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
  Utensils,
  XCircle,
} from "lucide-react-native";
import { colors } from "@/lib/colors";
import { formatEta, formatPrice } from "@/lib/format";
import type {
  Cart,
  MenuItem,
  Order,
  Restaurant,
  ToolInvocation,
  ToolResult,
} from "@/lib/types";
import { PaymentSheet } from "./PaymentSheet";

export function ToolResultRenderer({
  invocation,
  onQuickReply,
}: {
  invocation: ToolInvocation;
  onQuickReply: (text: string) => void;
}) {
  if (invocation.state !== "result" || !invocation.result) {
    return <WorkingPill toolName={invocation.toolName} />;
  }

  const result = invocation.result as ToolResult;

  switch (result.kind) {
    case "restaurants":
      return (
        <RestaurantList
          restaurants={result.restaurants}
          onPick={(r) =>
            onQuickReply(`Let's go with ${r.name}. Show me the menu.`)
          }
        />
      );
    case "menu":
      return (
        <MenuCard
          restaurantName={result.restaurant_name}
          items={result.items}
          onAdd={onQuickReply}
        />
      );
    case "cart":
      return (
        <CartSummary
          cart={result.cart}
          onConfirm={() => onQuickReply("confirm")}
          onCancel={() => onQuickReply("cancel — don't place the order")}
        />
      );
    case "empty_cart":
      return (
        <InfoCard
          icon={<ShoppingBag size={16} color={colors.ink[500]} />}
          title="Your cart is empty"
          body="Tell me what you're hungry for and I'll build it."
        />
      );
    case "payment_required":
      return (
        <PaymentSheet
          clientSecret={result.client_secret}
          publishableKey={result.publishable_key}
          amountCents={result.amount_cents}
          onPaid={() => onQuickReply("payment confirmed")}
        />
      );
    case "payment_skipped":
      return (
        <InfoCard
          icon={<ShoppingBag size={16} color={colors.ink[500]} />}
          title="Paying on delivery"
          body={`No card required in demo mode. Total ${formatPrice(result.amount_cents)}.`}
        />
      );
    case "order_placed":
      return <OrderConfirmation order={result.order} />;
    case "order_status":
      return <OrderStatusCard order={result.order} />;
    case "order_history":
      return <OrderHistory orders={result.orders} onReorder={onQuickReply} />;
    case "error":
      return (
        <InfoCard
          tone="error"
          icon={<XCircle size={16} color={colors.red[600]} />}
          title="Something went wrong"
          body={result.message}
        />
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------------------
// Working pill
// -------------------------------------------------------------------------

function WorkingPill({ toolName }: { toolName: string }) {
  const label: Record<string, string> = {
    search_restaurants: "Finding restaurants…",
    get_restaurant_menu: "Loading menu…",
    build_cart: "Building your cart…",
    get_cart_summary: "Reviewing your cart…",
    create_payment_intent: "Setting up payment…",
    place_order: "Placing your order…",
    get_order_status: "Checking status…",
    get_order_history: "Pulling recent orders…",
  };
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.text}>{label[toolName] ?? "Working…"}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink[100],
  },
  text: { fontSize: 12, color: colors.ink[500] },
});

// -------------------------------------------------------------------------
// Restaurant list
// -------------------------------------------------------------------------

function RestaurantList({
  restaurants,
  onPick,
}: {
  restaurants: Restaurant[];
  onPick: (r: Restaurant) => void;
}) {
  if (restaurants.length === 0) {
    return (
      <InfoCard
        icon={<Utensils size={16} color={colors.ink[500]} />}
        title="Nothing matched"
        body="Try a different cuisine or loosen the filters."
      />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {restaurants.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} onPick={() => onPick(r)} />
      ))}
    </View>
  );
}

function RestaurantCard({
  restaurant,
  onPick,
}: {
  restaurant: Restaurant;
  onPick: () => void;
}) {
  const priceLabel = "$".repeat(restaurant.price_level);
  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [
        cardStyles.card,
        pressed && { transform: [{ translateY: -1 }], borderColor: colors.lumo[200] },
      ]}
    >
      <View style={cardStyles.iconWrap}>
        <ChefHat size={20} color={colors.lumo[600]} />
      </View>
      <View style={cardStyles.body}>
        <View style={cardStyles.titleRow}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {!restaurant.is_open && (
            <View style={cardStyles.closedBadge}>
              <Text style={cardStyles.closedText}>Closed</Text>
            </View>
          )}
        </View>
        <Text style={cardStyles.subtitle} numberOfLines={1}>
          {restaurant.cuisine.join(" · ")} · {priceLabel}
        </Text>
        <View style={cardStyles.metaRow}>
          <View style={cardStyles.meta}>
            <Star size={12} color={colors.amber[400]} fill={colors.amber[400]} />
            <Text style={cardStyles.metaStrong}>{restaurant.rating.toFixed(1)}</Text>
            <Text style={cardStyles.metaWeak}>
              ({restaurant.review_count.toLocaleString()})
            </Text>
          </View>
          <View style={cardStyles.meta}>
            <Clock size={12} color={colors.ink[600]} />
            <Text style={cardStyles.metaText}>
              {formatEta(restaurant.eta_minutes)}
            </Text>
          </View>
          <View style={cardStyles.meta}>
            <MapPin size={12} color={colors.ink[600]} />
            <Text style={cardStyles.metaText}>
              {restaurant.distance_miles.toFixed(1)} mi
            </Text>
          </View>
        </View>
      </View>
      <View style={cardStyles.pickPill}>
        <Text style={cardStyles.pickText}>Pick</Text>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.lumo[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lumo[100],
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink[900] },
  closedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.ink[100],
  },
  closedText: { fontSize: 10, fontWeight: "500", color: colors.ink[500] },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.ink[500] },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12, color: colors.ink[600] },
  metaStrong: { fontSize: 12, fontWeight: "500", color: colors.ink[800] },
  metaWeak: { fontSize: 12, color: colors.ink[400] },
  pickPill: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  pickText: { fontSize: 12, fontWeight: "500", color: colors.ink[700] },
});

// -------------------------------------------------------------------------
// Menu card — interactive multi-select with checkboxes + qty stepper.
//
// Users were having to type "add pepperoni and garlic knots" after seeing
// the menu, which defeats the whole point of rendering the menu as a rich
// card. Now each row is tappable: first tap adds qty=1 (checkbox fills in),
// subsequent taps via the −/+ stepper adjust qty. A sticky footer CTA
// summarizes the selection and fires a single natural-language message
// to the agent ("Add to cart: 2× Large Pepperoni, Garlic Knots."). The
// agent already has the menu in context from the immediately-preceding
// get_restaurant_menu call, so it resolves names → item_ids reliably.
//
// After the user taps Add, we clear local qty state so the card goes
// back to a clean slate — if Lumo's response builds the cart, the cart
// summary card supersedes this one anyway.
// -------------------------------------------------------------------------

function MenuCard({
  restaurantName,
  items,
  onAdd,
}: {
  restaurantName: string;
  items: MenuItem[];
  onAdd: (text: string) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});

  const selectedItems = items.filter((item) => (qty[item.id] ?? 0) > 0);
  const selectedCount = selectedItems.reduce(
    (sum, item) => sum + (qty[item.id] ?? 0),
    0
  );
  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + (qty[item.id] ?? 0) * item.price_cents,
    0
  );

  function inc(id: string) {
    setQty((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }
  function dec(id: string) {
    setQty((prev) => {
      const next = (prev[id] ?? 0) - 1;
      if (next <= 0) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  function handleAdd() {
    if (selectedCount === 0) return;
    const parts = selectedItems.map((item) => {
      const n = qty[item.id]!;
      return n === 1 ? item.name : `${n}× ${item.name}`;
    });
    onAdd(`Add to cart: ${parts.join(", ")}.`);
    setQty({});
  }

  return (
    <View style={menuStyles.card}>
      <View style={menuStyles.header}>
        <Utensils size={14} color={colors.lumo[500]} />
        <Text style={menuStyles.headerText}>{restaurantName} menu</Text>
      </View>

      {items.map((item, i) => {
        const n = qty[item.id] ?? 0;
        const checked = n > 0;
        return (
          <View
            key={item.id}
            style={[
              menuStyles.row,
              i !== 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.ink[100],
              },
            ]}
          >
            {/* Left control: checkbox when unchecked, stepper when checked */}
            {checked ? (
              <View style={menuStyles.stepper}>
                <Pressable
                  onPress={() => dec(item.id)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    menuStyles.stepBtn,
                    pressed && { backgroundColor: colors.ink[100] },
                  ]}
                >
                  <Minus size={12} color={colors.ink[700]} />
                </Pressable>
                <Text style={menuStyles.stepQty}>{n}</Text>
                <Pressable
                  onPress={() => inc(item.id)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    menuStyles.stepBtn,
                    pressed && { backgroundColor: colors.ink[100] },
                  ]}
                >
                  <Plus size={12} color={colors.ink[700]} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => inc(item.id)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`Add ${item.name}`}
                style={({ pressed }) => [
                  menuStyles.checkbox,
                  pressed && { borderColor: colors.lumo[400] },
                ]}
              />
            )}

            {/* Main body: tappable when unchecked to add +1 */}
            <Pressable
              onPress={() => {
                if (!checked) inc(item.id);
              }}
              style={{ flex: 1 }}
            >
              <Text style={menuStyles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {!!item.description && (
                <Text style={menuStyles.itemDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </Pressable>

            <Text style={menuStyles.itemPrice}>
              {formatPrice(item.price_cents)}
            </Text>
          </View>
        );
      })}

      {selectedCount > 0 && (
        <View style={menuStyles.footer}>
          <Pressable
            onPress={handleAdd}
            style={({ pressed }) => [
              menuStyles.addBtn,
              pressed && { backgroundColor: colors.lumo[600] },
            ]}
          >
            <Text style={menuStyles.addText}>
              Add {selectedCount} item{selectedCount === 1 ? "" : "s"} ·{" "}
              {formatPrice(selectedTotal)}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const menuStyles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headerText: { fontSize: 13, fontWeight: "600", color: colors.ink[900] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink[300],
    backgroundColor: colors.white,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lumo[200],
    backgroundColor: colors.lumo[50],
    paddingHorizontal: 2,
  },
  stepBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  stepQty: {
    minWidth: 14,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.lumo[700],
    paddingHorizontal: 2,
  },
  itemName: { fontSize: 14, fontWeight: "500", color: colors.ink[900] },
  itemDesc: { marginTop: 2, fontSize: 12, color: colors.ink[500] },
  itemPrice: { fontSize: 14, fontWeight: "600", color: colors.ink[900] },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
  },
  addBtn: {
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.lumo[500],
    alignItems: "center",
  },
  addText: { fontSize: 14, fontWeight: "700", color: colors.white },
});

// -------------------------------------------------------------------------
// Cart summary
// -------------------------------------------------------------------------

function CartSummary({
  cart,
  onConfirm,
  onCancel,
}: {
  cart: Cart;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={cartStyles.card}>
      <View style={cartStyles.header}>
        <ShoppingBag size={14} color={colors.lumo[500]} />
        <Text style={cartStyles.headerName} numberOfLines={1}>
          {cart.restaurant_name}
        </Text>
        <View style={cartStyles.etaPill}>
          <Clock size={12} color={colors.ink[500]} />
          <Text style={cartStyles.etaText}>{formatEta(cart.eta_minutes)}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        {cart.lines.map((line, i) => {
          const mods = Object.values(line.selected_modifiers ?? {}).filter(Boolean);
          return (
            <View
              key={line.item_id}
              style={[
                cartStyles.line,
                i !== 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.ink[100],
                },
              ]}
            >
              <View style={cartStyles.qtyBadge}>
                <Text style={cartStyles.qtyText}>×{line.quantity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cartStyles.itemName}>{line.name}</Text>
                {mods.length > 0 && (
                  <Text style={cartStyles.itemMods}>{mods.join(" · ")}</Text>
                )}
                {!!line.notes && (
                  <Text style={cartStyles.itemNotes}>Note: {line.notes}</Text>
                )}
              </View>
              <Text style={cartStyles.itemPrice}>
                {formatPrice(line.unit_price_cents * line.quantity)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={cartStyles.totals}>
        <TotalRow label="Subtotal" value={cart.subtotal_cents} />
        <TotalRow label="Delivery" value={cart.delivery_fee_cents} />
        <TotalRow label="Service" value={cart.service_fee_cents} />
        <TotalRow label="Tax" value={cart.tax_cents} />
        <View style={cartStyles.totalRow}>
          <Text style={cartStyles.totalLabel}>Total</Text>
          <Text style={cartStyles.totalValue}>{formatPrice(cart.total_cents)}</Text>
        </View>
      </View>

      <View style={cartStyles.buttons}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            cartStyles.cancelBtn,
            pressed && { backgroundColor: colors.ink[50] },
          ]}
        >
          <Text style={cartStyles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [
            cartStyles.confirmBtn,
            pressed && { backgroundColor: colors.lumo[600] },
          ]}
        >
          <Text style={cartStyles.confirmText}>
            Confirm · {formatPrice(cart.total_cents)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={cartStyles.miniRow}>
      <Text style={cartStyles.miniLabel}>{label}</Text>
      <Text style={cartStyles.miniValue}>{formatPrice(value)}</Text>
    </View>
  );
}

const cartStyles = StyleSheet.create({
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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.ink[50],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink[100],
  },
  headerName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink[900] },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  etaText: { fontSize: 11, color: colors.ink[500] },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.ink[100],
  },
  qtyText: { fontSize: 11, fontWeight: "700", color: colors.ink[700] },
  itemName: { fontSize: 14, fontWeight: "500", color: colors.ink[900] },
  itemMods: { marginTop: 2, fontSize: 12, color: colors.ink[500] },
  itemNotes: { marginTop: 2, fontSize: 12, fontStyle: "italic", color: colors.ink[400] },
  itemPrice: { fontSize: 14, fontWeight: "600", color: colors.ink[900] },
  totals: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
  },
  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  miniLabel: { fontSize: 13, color: colors.ink[600] },
  miniValue: { fontSize: 13, color: colors.ink[600] },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: colors.ink[900] },
  totalValue: { fontSize: 15, fontWeight: "600", color: colors.ink[900] },
  buttons: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[100],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink[200],
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "500", color: colors.ink[700] },
  confirmBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.lumo[500],
    alignItems: "center",
  },
  confirmText: { fontSize: 14, fontWeight: "700", color: colors.white },
});

// -------------------------------------------------------------------------
// Order confirmation
// -------------------------------------------------------------------------

function OrderConfirmation({ order }: { order: Order }) {
  return (
    <View style={confirmStyles.card}>
      <View style={confirmStyles.headerRow}>
        <View style={confirmStyles.checkBubble}>
          <Check size={18} color={colors.white} />
        </View>
        <View>
          <Text style={confirmStyles.title}>Order placed</Text>
          <Text style={confirmStyles.subtitle}>
            #{order.id} · {order.cart.restaurant_name}
          </Text>
        </View>
      </View>

      <View style={confirmStyles.statsRow}>
        <Stat
          icon={<Truck size={14} color={colors.emerald[600]} />}
          label="ETA"
          value={formatEta(order.cart.eta_minutes)}
        />
        <Stat
          icon={<ShoppingBag size={14} color={colors.emerald[600]} />}
          label="Total"
          value={formatPrice(order.cart.total_cents)}
        />
      </View>

      <View style={confirmStyles.footer}>
        <Text style={confirmStyles.footerText}>
          Heading to <Text style={confirmStyles.address}>{order.address}</Text>
        </Text>
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={statStyles.labelRow}>
        {icon}
        <Text style={statStyles.label}>{label}</Text>
      </View>
      <Text style={statStyles.value}>{value}</Text>
    </View>
  );
}

const confirmStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.emerald[100],
    backgroundColor: colors.emerald[50],
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  checkBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.emerald[500],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink[900] },
  subtitle: { fontSize: 11, color: colors.ink[500], marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  footer: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.emerald[100],
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  footerText: { fontSize: 11, color: colors.ink[500] },
  address: { color: colors.ink[700], fontWeight: "500" },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: colors.emerald[100],
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: {
    fontSize: 11,
    color: colors.ink[500],
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  value: { marginTop: 2, fontSize: 14, fontWeight: "600", color: colors.ink[900] },
});

// -------------------------------------------------------------------------
// Order status
// -------------------------------------------------------------------------

function OrderStatusCard({ order }: { order: Order }) {
  const steps: Array<Order["status"]> = [
    "placed",
    "preparing",
    "out_for_delivery",
    "delivered",
  ];
  const currentIdx = Math.max(0, steps.indexOf(order.status));
  const label: Record<Order["status"], string> = {
    placed: "Placed",
    preparing: "Preparing",
    out_for_delivery: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return (
    <View style={statusStyles.card}>
      <View style={statusStyles.row}>
        <View style={{ flex: 1 }}>
          <Text style={statusStyles.title}>{order.cart.restaurant_name}</Text>
          <Text style={statusStyles.orderId}>#{order.id}</Text>
        </View>
        <View style={statusStyles.statusPill}>
          <Text style={statusStyles.statusText}>{label[order.status]}</Text>
        </View>
      </View>

      {order.status !== "cancelled" && (
        <View style={statusStyles.steps}>
          {steps.map((step, i) => {
            const done = i <= currentIdx;
            return (
              <View key={step} style={statusStyles.stepWrap}>
                <View
                  style={[
                    statusStyles.stepCircle,
                    {
                      backgroundColor: done ? colors.lumo[500] : colors.ink[100],
                    },
                  ]}
                >
                  {done ? (
                    <Check size={12} color={colors.white} />
                  ) : (
                    <Text style={statusStyles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                {i < steps.length - 1 && (
                  <View
                    style={[
                      statusStyles.bar,
                      {
                        backgroundColor: i < currentIdx
                          ? colors.lumo[500]
                          : colors.ink[100],
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const statusStyles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  row: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 13, fontWeight: "600", color: colors.ink[900] },
  orderId: { fontSize: 11, color: colors.ink[500], marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.lumo[50],
    borderWidth: 1,
    borderColor: colors.lumo[100],
  },
  statusText: { fontSize: 11, fontWeight: "500", color: colors.lumo[700] },
  steps: { marginTop: 14, flexDirection: "row", alignItems: "center" },
  stepWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontSize: 10, fontWeight: "700", color: colors.ink[400] },
  bar: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1 },
});

// -------------------------------------------------------------------------
// Order history
// -------------------------------------------------------------------------

function OrderHistory({
  orders,
  onReorder,
}: {
  orders: Order[];
  onReorder: (text: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <InfoCard
        icon={<Clock size={16} color={colors.ink[500]} />}
        title="No recent orders"
        body="Once you order, I'll remember it here so you can reorder in one tap."
      />
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {orders.map((order) => (
        <Pressable
          key={order.id}
          onPress={() =>
            onReorder(`Reorder my ${order.cart.restaurant_name} order.`)
          }
          style={({ pressed }) => [
            historyStyles.card,
            pressed && { borderColor: colors.lumo[200] },
          ]}
        >
          <View style={historyStyles.iconWrap}>
            <ShoppingBag size={16} color={colors.ink[600]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={historyStyles.title} numberOfLines={1}>
              {order.cart.restaurant_name}
            </Text>
            <Text style={historyStyles.items} numberOfLines={1}>
              {order.cart.lines
                .map((l) => `${l.quantity}× ${l.name}`)
                .join(", ")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={historyStyles.price}>
              {formatPrice(order.cart.total_cents)}
            </Text>
            <Text style={historyStyles.reorder}>Reorder</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const historyStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.ink[100],
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.ink[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink[900] },
  items: { marginTop: 2, fontSize: 11, color: colors.ink[500] },
  price: { fontSize: 14, fontWeight: "600", color: colors.ink[900] },
  reorder: { marginTop: 2, fontSize: 11, color: colors.lumo[600] },
});

// -------------------------------------------------------------------------
// Info / error card
// -------------------------------------------------------------------------

function InfoCard({
  icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "neutral" | "error";
}) {
  const isError = tone === "error";
  return (
    <View
      style={[
        infoStyles.card,
        {
          borderColor: isError ? colors.red[100] : colors.ink[100],
          backgroundColor: isError ? colors.red[50] : colors.white,
        },
      ]}
    >
      <View
        style={[
          infoStyles.iconWrap,
          { backgroundColor: isError ? colors.red[100] : colors.ink[50] },
        ]}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            infoStyles.title,
            { color: isError ? colors.red[700] : colors.ink[900] },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            infoStyles.body,
            { color: isError ? colors.red[600] : colors.ink[500] },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "600" },
  body: { marginTop: 2, fontSize: 12 },
});
