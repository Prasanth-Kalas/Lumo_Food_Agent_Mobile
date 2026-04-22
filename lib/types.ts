/**
 * Domain types — kept 1:1 with the backend's lib/types.ts.
 * If you edit one, edit the other.
 */

export type Cuisine =
  | "pizza"
  | "mexican"
  | "indian"
  | "thai"
  | "chinese"
  | "american"
  | "japanese"
  | "mediterranean"
  | "breakfast"
  | "dessert";

export interface Restaurant {
  id: string;
  name: string;
  cuisine: Cuisine[];
  rating: number;
  review_count: number;
  price_level: 1 | 2 | 3 | 4;
  distance_miles: number;
  eta_minutes: number;
  is_open: boolean;
  tags: string[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
}

export interface CartLine {
  item_id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  selected_modifiers: Record<string, string>;
  notes?: string;
}

export interface Cart {
  restaurant_id: string;
  restaurant_name: string;
  lines: CartLine[];
  subtotal_cents: number;
  delivery_fee_cents: number;
  service_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  eta_minutes: number;
}

export interface Order {
  id: string;
  cart: Cart;
  address: string;
  placed_at: string;
  status:
    | "placed"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";
  estimated_delivery_at: string;
}

// ---- Chat message shapes ---------------------------------------------------

export type ChatRole = "user" | "assistant";

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "partial-call";
  args?: unknown;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  toolInvocations?: ToolInvocation[];
}

// ---- Tool result discriminated union --------------------------------------

export type ToolResult =
  | { kind: "restaurants"; count: number; restaurants: Restaurant[] }
  | {
      kind: "menu";
      restaurant_id: string;
      restaurant_name: string;
      items: MenuItem[];
    }
  | { kind: "cart"; cart: Cart }
  | { kind: "empty_cart" }
  | { kind: "order_placed"; order: Order }
  | { kind: "order_status"; order: Order }
  | { kind: "order_history"; orders: Order[] }
  | { kind: "error"; message: string };
