// Shapes of the JSON returned by the backend API (see README "API").

export type Role = "CUSTOMER" | "MANAGER";
export type MembershipTier = "STANDARD" | "SILVER" | "GOLD" | "PLATINUM";

export type Preferences = { brands: string[]; maxBudget: number | null };

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  membershipTier: MembershipTier;
  country: string;
  preferredStoreId: number | null;
  preferences: Partial<Preferences>;
};

export type Store = { id: number; code: string; name: string; city: string };

// ── Catalogue ────────────────────────────────────────────────────────────────
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type Availability = { status: StockStatus; available: number; incomingQty?: number };
export type StoreAvailability = Availability & { storeId: number; storeCode: string; storeName: string; city: string; incomingQty: number };

export type Specs = Record<string, string | number | boolean>;

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  brand: string;
  description: string | null;
  price: number;
  rating: number;
  specs: Specs;
  availability?: Availability;
};
export type ProductDetail = Omit<Product, "availability"> & { availability: StoreAvailability[] };

export type Page<T> = { content: T[]; totalElements: number; totalPages: number; number: number; size: number };
export type Facets = { categories: string[]; brands: string[]; priceRange: { min: number; max: number } };

// Fields the cart and product artwork need; both catalogue products and recommendations provide them.
export type ProductSummary = { sku: string; name: string; brand: string; category: string; price: number };

// ── Orders ───────────────────────────────────────────────────────────────────
export type Fulfilment = "PICKUP" | "DELIVERY";
export type OrderStatus = "PLACED" | "READY_FOR_PICKUP" | "SHIPPED" | "DELAYED" | "DELIVERED" | "CANCELLED";

export type Order = {
  code: string;
  status: OrderStatus;
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  fulfilment: Fulfilment;
  statusNote: string | null;
  store: { id: number; code: string; name: string };
  subtotal: number;
  deliveryFee: number;
  total: number;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: { sku: string; name: string; brand: string; category: string; qty: number; unitPrice: number }[];
};
export type NewOrder = { storeId: number; fulfilment: Fulfilment; items: { sku: string; qty: number }[] };

// ── AI ───────────────────────────────────────────────────────────────────────
export type Recommendation = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  rating: number;
  specs: Specs;
  reason: string;
  availability: StockStatus;
  availableQty: number;
  storeCode: string;
  alternativeStore: { storeCode: string; storeName: string; available: number } | null;
};
export type RecommendResponse = {
  interpretedRequirement: string;
  recommendations: Recommendation[];
  clarifyingQuestion: string | null;
  source: "AI" | "FALLBACK";
  notice: string | null;
  meta: { candidatesConsidered: number; rejectedProductIds: string[]; appliedPreferences: { maxBudget: number | null; preferredBrands: string[] } };
};

export type PolicySource = {
  id: string;
  label: string;
  document: string;
  documentId: string;
  section: string;
  version: string;
  effectiveDate: string;
  similarity: number;
  cited: boolean;
  excerpt: string;
};
export type AskResponse = {
  status: "ANSWERED" | "NOT_FOUND" | "SOURCES_ONLY";
  answer: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sources: PolicySource[];
  followUpRequired: boolean;
};

// ── Support ──────────────────────────────────────────────────────────────────
export type TicketCategory = "ORDER" | "DELIVERY" | "RETURN_REFUND" | "PRODUCT" | "PAYMENT" | "OTHER";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type Ticket = {
  id: number;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  summary: string;
  createdBy: "CUSTOMER" | "AGENT";
  createdAt: string;
  order: { code: string; status: OrderStatus } | null;
  user: { name: string; email: string; membershipTier: MembershipTier };
};
export type SupportReply = {
  reply: string;
  toolsUsed: { tool: string; summary: string }[];
  ticket: Pick<Ticket, "id" | "category" | "priority" | "status"> | null;
};
export type ChatTurn = { role: "user" | "assistant"; content: string };

// ── Operations ───────────────────────────────────────────────────────────────
export type Severity = "OK" | "LOW" | "CRITICAL";

export type StockItem = {
  productId: number;
  sku: string;
  name: string;
  category: string;
  available: number;
  onHand: number;
  incomingQty: number;
  reorderPoint: number;
  safetyStock: number;
  leadTimeDays: number;
  cost: number;
  avgDaily: number;
  daysLeft: number | null;
  severity: Severity;
  suggestedQty: number;
  status: StockStatus;
};
export type StockOverview = {
  kpis: { activeSkus: number; stockValue: number; needsAttention: number; critical: number; pendingApprovals: number };
  health: { inStock: number; low: number; out: number };
  items: StockItem[];
};

export type ProposalPayload = {
  onHand: number;
  reserved: number;
  incomingQty: number;
  available: number;
  inventoryPosition: number;
  reorderPoint: number;
  safetyStock: number;
  leadTimeDays: number;
  unitsSoldInWindow: number;
  salesWindowDays: number;
  avgDailySales: number;
  daysOfCover: number | null;
  targetCoverageDays: number;
  severity: Severity;
  suggestedQty: number;
  capped: boolean;
  formula: string;
  explanationSource: "AI" | "TEMPLATE";
};
export type Proposal = {
  id: number;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED";
  payload: ProposalPayload;
  explanation: string | null;
  store: { id: number; code: string; name: string };
  product: { id: number; sku: string; name: string };
  decidedBy: { id: number; name: string; email: string } | null;
};
export type ScanResult = { storeCode: string; scannedItems: number; created: Proposal[]; skipped: { sku: string; reason: string }[] };

export type AuditEntry = {
  id: number;
  action: string;
  entity: string;
  entityId: string;
  actorEmail: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type KbDocument = {
  documentId: string;
  title: string;
  docType: string;
  version: string;
  effectiveDate: string;
  region: string;
  category: string | null;
  tiers: string[];
  sections: string[];
  chunks: number;
};
export type KbUpload = {
  title: string;
  docType: string;
  version: string;
  effectiveDate: string;
  tier: string;
  category: string;
  content: string;
};
export type KbUploadResult = {
  documentId: string;
  title: string;
  version: string;
  chunks: number;
  unchanged: boolean;
  replacedVersion: string | null;
  sections: string[];
};

export type Health = { status: string; database: "up" | "down"; timestamp: string };
