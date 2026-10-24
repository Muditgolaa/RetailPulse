# RetailPulse AI

AI retail platform for NovaMart: product discovery, a policy assistant (RAG over pgvector) and an inventory dashboard with human-approved actions. This commit is the foundation only. It has a health check and no features yet.

## Stack

| Part | Tech |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS 4, React Router, Axios, Zustand |
| Backend | Node.js, Express 5, TypeScript, Zod, Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL 16 with pgvector (Docker) |
| Tests | Vitest, Supertest |

## Prerequisites

- Node.js 22.22 or newer (`node -v`)
- Docker Desktop running

## First-time setup

```bash
docker compose up -d
cp backend/.env.example backend/.env
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

`npm install` in `backend/` also runs `prisma generate`.

Then fill in `backend/.env` and create the database:

- `SEED_DEMO_PASSWORD`: any value of 8+ characters. Every demo account gets this password.
- `JWT_SECRET`: a long random value, for example from `openssl rand -hex 32`.
- `DEMO_LOGIN_ENABLED=true`: optional, turns on the one-click demo buttons.

```bash
cd backend
npm run db:deploy   # apply migrations
npm run db:seed     # load demo data
npm run db:verify   # check counts and demo scenarios with SQL
npm run kb:ingest   # load policy documents into pgvector (downloads the 23 MB embedding model once)
```

## Database

Prisma 7 migrations live in `backend/prisma/migrations`. The server never migrates or seeds on start-up; every step is an explicit command.

| Command (in `backend/`) | What it does |
|---|---|
| `npm run db:migrate` | Create and apply a new migration after editing `schema.prisma` (development) |
| `npm run db:deploy` | Apply existing migrations without prompts |
| `npm run db:seed` | Empty the business tables and reload the same demo data (keeps `knowledge_chunks`) |
| `npm run db:verify` | Run SQL checks for record counts and demo scenarios |
| `npm run db:reset` | **Deletes all data**: drops the database, reapplies migrations, then seeds. Development only. |

Tables: `users`, `stores`, `products`, `inventory`, `sales_daily`, `carts`, `cart_items`, `orders`, `order_items`, `knowledge_chunks` (pgvector `vector(384)`), `agent_actions`, `audit_logs`, `ai_call_logs`. Money uses `DECIMAL`. The init migration also adds CHECK constraints (no negative stock or prices, cart qty 1–10, `total = subtotal + deliveryFee`).

### Demo data

All data is fictional, and prices are illustrative. Every seed run produces identical rows; sales dates are the 14 days before the day you seed.

| Scenario | Data |
|---|---|
| Stores | DEL01 Connaught Place, GGN01 Cyber Hub, NOIDA01 Sector 18, FAR01 Crown Plaza |
| Catalogue | 50 products, 10 each in Laptops, Mobiles, Appliances, TV & Audio, Accessories |
| Laptops under ₹80,000 for development | P101 ASUS TUF A15, P102 Lenovo IdeaPad Slim 5, P103 HP Victus 15 (all 16 GB RAM) |
| Out of stock at DEL01, in stock at GGN01 | P101: 0 at DEL01 (8 incoming), 3 at GGN01 |
| Low stock at DEL01 | P405 boAt Rockerz 450, P205 Redmi Note 13 Pro, P503 Anker 65 W (critical); P302 Samsung 253 L fridge (low) |
| Delayed order | ORD-1023 (Priya), status `DELAYED`, past its expected delivery date |

Low stock means `onHand − reserved + incomingQty <= reorderPoint`.

Demo accounts. The password is whatever you set as `SEED_DEMO_PASSWORD` in `backend/.env`, so it is never committed:

| Email | Role | Tier |
|---|---|---|
| priya@novamart.test | CUSTOMER | GOLD |
| arjun@novamart.test | CUSTOMER | STANDARD |
| rahul@novamart.test | MANAGER | — |

## Run (3 terminals)

```bash
# 1. Database
docker compose up -d

# 2. Backend → http://localhost:4000
cd backend && npm run dev

# 3. Frontend → http://localhost:5173
cd frontend && npm run dev
```

Open http://localhost:5173. The status card shows whether the backend and the database are connected.

## Useful commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run kb:ingest` | Loads `backend/knowledge/*.md` into `knowledge_chunks` with embeddings. Unchanged documents are skipped. Run again after `db:reset` |
| backend | `npm run kb:eval` | Runs the 10 golden questions through retrieval and prints the hit rate (`-- --answer` also asks Groq) |
| backend | `npm run ai:check` | Checks the Groq setup: key loaded, model available, one tiny real request (logged in `ai_call_logs`). Never prints the key |
| backend | `npm run db:check` | Connects to Postgres and confirms pgvector is installed |
| backend | `npm test` | Runs the Vitest + Supertest suite. The API tests need the database running and seeded (`npm run db:seed`) |
| backend | `npm run typecheck` | TypeScript check without output |
| backend | `npm run build` then `npm start` | Production build and run |
| frontend | `npm run typecheck` | Strict TypeScript check |
| frontend | `npm run build` | Type check, then production build into `frontend/dist` |
| root | `docker compose down` | Stops the database (data is kept in the `pg_data` volume) |

## Frontend routes

| Route | Who | Screen |
|---|---|---|
| `/login` | public | Sign in (plus a development-only preview for each role) |
| `/` | customer | Storefront: search, categories, brand, sort, stock filter, pagination |
| `/products/:sku` | customer | Product detail, specs, availability by store |
| `/assistant` | customer | AI shopping assistant (calls `POST /api/ai/recommend`) |
| `/policy` | customer | Policy assistant (calls `POST /api/ai/ask`) |
| `/cart` | customer | Cart and simulated checkout (calls `POST /api/orders`) |
| `/orders` | customer | Order history with status, expected delivery, and cancellation |
| `/support` | customer | Support assistant chat (checks orders and policy, opens tickets) and the customer's tickets |
| `/account` | customer | Shopping preferences: home store, usual budget and up to 5 favourite brands |
| `/ops/knowledge` | manager | Upload, list and remove policy documents used by the policy assistant and support agent |
| `/ops` | manager | Inventory, critical stock, replenishment proposals, audit history |
| `/status` | public | Backend and database health |

### Hackathon demo access (temporary)

The login page has **One-click demo access** buttons: "Customer" signs you in as Priya, a Gold member, and "Store manager" as Rahul at DEL01. Neither needs a password. The backend issues a real token through `POST /api/auth/demo`, which only works when `DEMO_LOGIN_ENABLED=true` and `NODE_ENV` is not `production`. The buttons only appear in `npm run dev`. They're for judging and quick checks.

To remove the demo access completely, delete:

- `frontend/src/components/DemoAccess.tsx`, with its import and usage in `pages/Login.tsx`
- the `/demo` route in `backend/src/routes/auth.ts`

To turn it off without deleting anything, set `DEMO_LOGIN_ENABLED=false`.

### Mock data

The frontend has no mock data left: every screen uses the real API.

## API

| Method | Path | Access | Details |
|---|---|---|---|
| GET | `/api/health` | public | `200 {"status":"ok","database":"up"}`, or `503` with `"database":"down"` |
| GET | `/api/health/ai` | public | Groq connectivity via the model list (no tokens spent, cached 60 s): `{provider, configured, reachable, model, modelAvailable, latencyMs, error?}`. `503` if not usable. Never includes the key |
| POST | `/api/auth/login` | public | `{email, password}` → `{token, user}`. `400` invalid body, `401` wrong email or password |
| GET | `/api/auth/me` | signed in | `{user}` from the token. `401` if missing, invalid or expired |
| POST | `/api/auth/demo` | public, dev only | `{account: "customer"\|"manager"}` → `{token, user}`. `404` unless `DEMO_LOGIN_ENABLED=true` |
| GET | `/api/stores` | public | `[{id, code, name, city}]` |
| GET | `/api/products` | public | Query `q, category, brand, minPrice, maxPrice, storeId, inStock, sort, page, size`. Returns `{content, totalElements, totalPages, number, size}`. `availability` is included when `storeId` is given |
| GET | `/api/products/facets` | public | `{categories, brands, priceRange}` |
| GET | `/api/products/:id` | public | Look up by SKU (`P101`) or numeric id; includes availability at every store. `404` if unknown |
| POST | `/api/ai/ask` | signed in | `{question (3–500 chars), docType?, category?}` → `{status: ANSWERED\|NOT_FOUND\|SOURCES_ONLY, answer, confidence, sources[{label, document, section, version, effectiveDate, similarity, excerpt}], followUpRequired, appliedFilters, meta}`. Unknown body fields (e.g. `tier`, `region`) → `400` |
| POST | `/api/ai/recommend` | signed in | `{query (3–500 chars), storeId?}` → `{interpretedRequirement, recommendations[{productId, name, price, specs, reason, availability, availableQty, alternativeStore}], clarifyingQuestion, source: AI\|FALLBACK, notice, meta}`. `400` invalid body or store, `401` without sign-in, `429` after 10 requests a minute |
| PUT | `/api/me/preferences` | signed in | `{preferredStoreId \| null, brands[] (≤5, must exist in the catalogue), maxBudget \| null (₹500–₹10,00,000)}` → `{user}`. Unknown fields such as `role` or `userId` → `400` |
| POST | `/api/orders` | CUSTOMER | `{storeId, fulfilment: PICKUP\|DELIVERY, items[{sku, qty 1–10}]}` → `201` order. Prices come from the database and stock is reserved atomically in one transaction. `409` if a store doesn't have enough stock (nothing is reserved). Prices, totals and user ids in the body → `400` |
| GET | `/api/orders` | CUSTOMER | The signed-in customer's orders, newest first |
| GET | `/api/orders/:code` | CUSTOMER | One of the customer's own orders. Another customer's order → `404` |
| POST | `/api/orders/:code/cancel` | CUSTOMER | Cancels a placed, ready-for-pickup or delayed order, refunds it and releases reserved stock. `409` if already cancelled, shipped or delivered |
| GET | `/api/kb/documents` | MANAGER | One row per indexed document: title, type, version, effective date, tiers, sections and chunk count |
| POST | `/api/kb/documents` | MANAGER | `{title, docType, version, effectiveDate, region?, tier?, category?, content}` (Markdown or text, ≤100,000 characters) → `201` with sections indexed. The same title replaces the previous version; an identical upload returns `200 {unchanged: true}`. Audited |
| DELETE | `/api/kb/documents/:documentId` | MANAGER | Removes a document from search. `404` if unknown. Audited |
| POST | `/api/support/chat` | CUSTOMER | `{message, history[≤10 {role: user\|assistant, content}]}` → `{reply, toolsUsed[], ticket}`. Tool-calling agent; see below |
| POST | `/api/support/tickets` | CUSTOMER | `{category, priority?, summary, orderCode?}` → `201` ticket. The order must be the customer's own (`404` otherwise). At most 3 tickets an hour (`429`) |
| GET | `/api/support/tickets?status=` | signed in | Customers get their own tickets; managers get everyone's |
| PATCH | `/api/support/tickets/:id` | MANAGER | `{status: OPEN\|IN_PROGRESS\|RESOLVED}`, audited. `409` if it already has that status |
| GET | `/api/ops/dashboard?storeId=` | MANAGER | Stock KPIs (including pending approvals), stock health, and per-item demand, days of cover, severity and suggested quantity |
| POST | `/api/ops/scan` | MANAGER | `{storeId}` → `{created[], skipped[]}`. Creates **PROPOSED** actions only and never changes inventory. One proposal per item per day; items with an open proposal are skipped |
| GET | `/api/ops/actions?status=&storeId=` | MANAGER | Actions with payload (calculation inputs and outputs), explanation, store, product and the manager who decided |
| POST | `/api/ops/actions/:id/approve` | MANAGER | `{note?}`. In one transaction: the proposal must still be PROPOSED, inventory `incomingQty` increases by the suggested quantity, the action becomes APPROVED with the manager recorded, and an audit event is written. `409` if already decided, `404` if unknown |
| POST | `/api/ops/actions/:id/reject` | MANAGER | `{note?}`. PROPOSED → REJECTED plus an audit event. Inventory is unchanged. `409` if already decided |
| GET | `/api/ops/audit?limit=` | MANAGER | Latest audit events: scans, approvals and rejections, each with actor and details |

All `/api/ops/*` endpoints return `401` without a token and `403` for customers.

- `sort` is one of `rating,desc` (default), `price,asc`, `price,desc` or `name,asc`.
- `size` is 1–48, and `page` starts at 0.
- `inStock=true` needs a `storeId`.
- Invalid parameters return `400 {"error":"Invalid request","details":{field:[message]}}`.

**Auth model:**
- Passwords are checked with bcrypt.
- Tokens are HS256 JWTs signed with `JWT_SECRET`. They carry only the user id and expire after `JWT_EXPIRES_IN`.
- On every request the server loads the user and **role from the database**, so role or user-id values sent by the client are never trusted.

## AI provider (Groq)

The backend calls Groq's OpenAI-compatible REST API with plain `fetch` (`backend/src/ai/groq.ts`).

- **Configuration:** `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`, chosen from the models on our account; run `npm run ai:check` to list yours) and `GROQ_TIMEOUT_MS` (default 20000) go in `backend/.env` only.
- **Without a key:** the app still runs, and AI features report `NOT_CONFIGURED`.
- **Errors:** provider failures map to `AUTH`, `MODEL_NOT_FOUND`, `RATE_LIMITED` (429), `TIMEOUT` (504), `UNAVAILABLE` or `BAD_RESPONSE`. Clients get a generic message plus that reason, never provider details or the key.

**Setup:**

1. Create a key at https://console.groq.com/keys.
2. Add `GROQ_API_KEY=...` to `backend/.env`.
3. Restart the backend.
4. Run `npm run ai:check`.

## Support agent

`POST /api/support/chat` (`backend/src/support/`) runs a short tool-calling loop with Groq.

| Tool | What it does | Guard |
|---|---|---|
| `get_order_status(orderCode)` | Looks up one order | Only the signed-in customer's orders; anyone else's reads as "no order on this account" |
| `list_my_orders()` | Lists the 5 latest orders | Signed-in customer only |
| `search_policy(question)` | Searches the policy documents | Same region and tier filters as the policy assistant |
| `create_ticket(category, priority, summary, orderCode?)` | Opens a ticket for staff | Zod-validated, own orders only, 3 an hour |

- **The model never runs anything itself.** It chooses a tool, our code runs it as the signed-in customer, and only the result goes back to the model. Unknown tools and invalid arguments are returned to the model as errors.
- **No dangerous tools:** there is no tool for refunds, cancellations or price changes. Customers cancel eligible orders themselves on My orders.
- **Bounded loop:** at most 4 tool rounds, then the model must answer in words.
- **Safe history:** the client may send only `user` and `assistant` messages as history, so it can't inject system or tool messages.
- **Logging:** every call is recorded in `ai_call_logs` as `SUPPORT_AGENT`, and tickets and status changes are audited.

## Orders and checkout

`POST /api/orders` (`backend/src/orders/service.ts`) works in four steps:

1. **Validation:** the body is checked with Zod. The client sends only SKUs and quantities. Prices, totals and the customer come from the database and the verified token.
2. **Stock reservation:** for each line, `UPDATE inventory SET reserved = reserved + qty WHERE onHand − reserved >= qty`. The conditional update locks the row, so two customers can't buy the last unit. If any line is short, the whole order rolls back and the customer gets `409` with how many units are left.
3. **Delivery fee:** follows the policy documents. Pickup is free. Standard delivery is free from ₹999, and Silver, Gold and Platinum members always get free standard delivery; otherwise it costs ₹49. Delivery is expected within 3 days, since all stores are in Delhi NCR.
4. **Payment and audit:** payment is simulated, and the order is marked `PAID`. Placing and cancelling an order write audit events, which managers see on the ops dashboard.

## Inventory intelligence

The maths is deterministic TypeScript in `backend/src/inventory/calculator.ts`. Groq only writes the explanation sentence. Explanations that cite numbers the calculation didn't produce are replaced with a template, and the model never sets a quantity.

| Term | Meaning |
|---|---|
| Available | `onHand − reserved`: units that can be sold now |
| Inventory position | `available + incomingQty`: includes units already ordered from the supplier |
| Demand | Average units sold per day over the last 14 full days |
| Lead time | Days from placing a supplier order until stock arrives |
| Target coverage | Lead time + 7-day review period: the demand an order must cover |
| Safety stock | Buffer for demand spikes and supplier delays |
| Reorder point | Replenish when the inventory position is at or below this |
| Days of cover | `available / demand` (none when there is no demand) |
| Severity | **CRITICAL** if days of cover < lead time (it runs out before a new order could arrive); **LOW** if at or below the reorder point otherwise; **OK** above it |
| Reorder quantity | `ceil(demand × target coverage) + safety stock − inventory position`, at least 0, capped at 3 × reorder point |

**Approval:** a conditional update (`WHERE status = 'PROPOSED'`) inside a database transaction means only one decision can win. Concurrent or repeated approvals get `409`, and inventory changes exactly once.

**Demo tip:** demand uses the 14 days before *today*, so run `npm run db:seed` on demo day to get the exact demo numbers. For example, boAt Rockerz at DEL01 sells 6 a day with 2 days of cover, so the proposal is 75 units, CRITICAL.

## Policy assistant (RAG)

`POST /api/ai/ask` (`backend/src/rag/`) works in these steps:

1. **Ingestion:** each `## ` section of a policy file becomes one chunk. It carries the document's metadata, and a `<!-- tier: X -->` marker overrides the tier for that section.
2. **Embeddings:** each chunk is embedded locally with `all-MiniLM-L6-v2` (384 dimensions, no API key) and stored in `knowledge_chunks`.
3. **Retrieval:** a pgvector cosine search with filters built only from the signed-in user's database record:
   - `region = user.country`
   - `tier IN ('ALL', user.tier)`
   - `effectiveDate <= today`

   The request body cannot set these; unknown fields are rejected with `400`. `docType` and `category` can only narrow the results.
4. **Threshold:** chunks below `RAG_MIN_SIMILARITY` (default 0.45, tuned on the golden set) are not evidence. If none qualify, the answer is `NOT_FOUND` and **the answer model is not called**.
5. **Grounded answer:** Groq answers only from the numbered sources and must cite them. Citations are built from our chunk metadata, and labels the model invents are dropped. If the model says the sources don't answer the question, or it cites none, the response is `NOT_FOUND`. If Groq is down, the response is `SOURCES_ONLY`: the matching sections, with no generated text.

**Uploads:** managers can add documents from the Knowledge base page without running a script. An upload is split at `## ` headings (plain text with no headings becomes one "Overview" section), embedded, and searchable immediately. It uses the same region, tier and effective-date filters as the built-in documents. The document id comes from the title, so uploading the same title again replaces the old version.

**About `confidence`:** HIGH, MEDIUM or LOW is a band based on how similar the cited sections are to the question. It is **not a probability that the answer is correct**, and the UI labels it as policy-match strength.

**Golden set result:** retrieval hit-rate **10/10** (`npm run kb:eval`).

## AI recommendations

`POST /api/ai/recommend` (`backend/src/recommend/`) works in five steps:

1. **Intent:** Groq returns JSON intent: category, budget, brands and must-haves. It is validated with Zod and mapped onto categories and brands that actually exist in the catalogue.
2. **Candidates:** a fixed Prisma query fetches up to 15 real products using only those validated values. The model never writes SQL.
3. **Ranking:** Groq picks up to 3 of the candidates and gives a reason for each.
4. **Guards:**
   - Unknown, duplicate or non-candidate product IDs are dropped and listed in `meta.rejectedProductIds`.
   - A reason that cites a number not found in the product's data is replaced with a reason built from the database.
5. **Response:** price, specs and stock come from PostgreSQL. A product that is out of stock at the selected store shows the store that has the most units.

**Fallback:** if Groq fails or returns unusable output, rule-based intent and ranking (requirements met, then in stock, then rating) still answer, with `source: "FALLBACK"` and a notice.

**Preferences:** saved preferences never override the request. The saved budget is used only when the request names a product type but no budget, and the response then says "(budget from your preferences)". Favourite brands only break ties between equally good matches, so other brands are still shown. `meta.appliedPreferences` shows what was used.

**Clarification:** ambiguous requests, or no matches, return a `clarifyingQuestion` instead of guessing.

Each AI call is recorded in `ai_call_logs`.

## Project layout

```
backend/                     Node.js + Express 5 + TypeScript
  prisma/                    schema, migrations, seed and SQL checks
  knowledge/                 policy documents (Markdown) and golden questions
  src/
    app.ts, server.ts        Express app, routes and startup
    config/env.ts            environment variables, validated with Zod
    auth/                    JWT signing/verification and role middleware
    routes/                  one router per area: auth, catalog, orders, me, ai, support, kb, ops, health
    orders/                  checkout with atomic stock reservation, cancellation
    users/                   customer preferences
    recommend/               intent extraction, candidate query, guarded ranking, fallback
    rag/                     ingestion, embeddings, filtered retrieval, grounded answers, uploads
    support/                 tool-calling support agent, tools and tickets
    inventory/               reorder calculator, scan, approvals
    ai/groq.ts               Groq client (chat, JSON mode, tool calling)
    lib/                     HTTP errors, stock rules, AI rate limit
  test/                      Vitest + Supertest integration tests
frontend/                    React 19 + TypeScript + Vite
  src/
    types.ts                 shapes of every API response
    api/                     typed Axios calls, one file per area
    store/                   Zustand: auth session, cart, selected store, toasts
    layouts/                 customer and operations layouts, role guard
    pages/                   one file per route
    components/              shared UI, storefront, assistant and operations components
docker/init/                 SQL run on the first database start (enables pgvector)
docker-compose.yml           PostgreSQL 16 + pgvector
```

## Notes

- Secrets live only in `backend/.env`, which git ignores. Commit `.env.example` only.
- npm 11 blocks install scripts by default. `backend/package.json` allows them for `prisma`, `@prisma/engines` and `esbuild` only.
