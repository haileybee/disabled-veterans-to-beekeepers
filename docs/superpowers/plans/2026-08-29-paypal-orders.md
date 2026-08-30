# PayPal Checkout + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure PayPal-only checkout, authoritative server pricing/stock validation, order snapshots, idempotent paid-order finalization, inventory synchronization, and an approved-admin orders dashboard.

**Architecture:** The browser sends only product IDs and quantities to Supabase Edge Functions. `paypal-create-order` creates a pending internal order snapshot from live Supabase prices/availability, then creates a PayPal Orders v2 order server-side. After buyer approval, `paypal-capture-order` calls PayPal's server capture endpoint; a verified PayPal webhook finalizes payment and stock through one idempotent database transaction. The browser never receives or stores PayPal client secret/service-role credentials.

**Tech Stack:** PayPal Orders v2 REST API + PayPal JavaScript SDK, Supabase Postgres/RLS/Edge Functions, Deno tests with mocked PayPal HTTP, Vitest + jsdom, pgTAP/Supabase database tests.

**Spec:** `docs/superpowers/specs/2026-08-29-community-chat-store-design.md`

## Global Constraints

- Requires completed Foundation/Admin and Storefront/Product Management plans.
- PayPal is the only payment method in this release.
- Use PayPal Orders v2 server endpoints (`/v2/checkout/orders` and `/v2/checkout/orders/{id}/capture`).
- Never trust browser product name, price, subtotal, total, stock, or currency.
- The client sends only product IDs and integer quantities.
- Store money as integer minor units and use `USD` for the initial release.
- PayPal `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and Supabase service-role credentials remain Edge Function secrets only.
- `PAYPAL_CLIENT_ID` is public and may be used by the browser SDK.
- Stock is decremented only after a verified successful payment finalization.
- Duplicate capture/webhook deliveries must not duplicate orders or decrement stock twice.
- Product/order values are snapshotted so future product edits do not alter order history.
- Fulfillment statuses are exactly `New`, `Processing`, `Shipped`, `Completed`, `Cancelled`.
- Refund automation is out of scope.
- Checkout uses a 30-minute inventory reservation window represented by pending order items; expired pending orders no longer reserve stock.

---

## File Structure

- Create `supabase/migrations/2026082903_orders.sql` — orders/items, reservation and atomic finalization RPCs, RLS.
- Create `supabase/tests/order_transactions.sql` — price/stock/idempotency/database permission tests.
- Create `supabase/functions/_shared/paypal.ts` — OAuth token, API call, signature verification helpers.
- Create `supabase/functions/_shared/paypal.test.ts` — helper tests.
- Create `supabase/functions/paypal-create-order/index.ts` — authoritative cart validation + PayPal order creation.
- Create `supabase/functions/paypal-create-order/index.test.ts`
- Create `supabase/functions/paypal-capture-order/index.ts` — server-side capture after buyer approval.
- Create `supabase/functions/paypal-capture-order/index.test.ts`
- Create `supabase/functions/paypal-webhook/index.ts` — signature verification + idempotent finalization.
- Create `supabase/functions/paypal-webhook/index.test.ts`
- Create `supabase/functions/paypal-order-status/index.ts` — sanitized status polling for the buyer.
- Create `supabase/functions/paypal-order-cancel/index.ts` — immediate cancellation/release of pending reservation.
- Create `js/checkout.js` — PayPal SDK button and checkout flow.
- Create `js/admin-orders.js` — approved-admin order list/detail/fulfillment actions.
- Create `tests/frontend/checkout.test.js`
- Create `tests/frontend/admin-orders.test.js`
- Modify `js/cart.js`, `js/store.js`, `js/admin-dashboard.js`, `index.html`, `css/store.css`.
- Create `docs/paypal-setup.md` — sandbox/live setup, webhook registration, secret names, go-live checklist.

### Task 1: Create order schema, pending reservation model, and admin RLS

**Files:**
- Create: `supabase/migrations/2026082903_orders.sql`
- Create: `supabase/tests/order_transactions.sql`

**Interfaces:**
- Produces table: `public.orders`
- Produces table: `public.order_items`
- Produces function: `public.create_checkout_snapshot(cart jsonb, checkout_token_hash text) returns uuid`
- Produces function: `public.finalize_paid_order(paypal_order text, paypal_capture text, paid_total integer, paid_currency text, customer_email text, shipping jsonb) returns uuid`
- Produces function: `public.cancel_pending_order(paypal_order text, checkout_token_hash text) returns boolean`

- [ ] **Step 1: Write failing transaction tests**

Test these database behaviors:
1. live product price is snapshotted into `order_items`
2. inactive product is rejected
3. sold-out product is rejected
4. two pending unexpired orders cannot reserve more than available stock
5. expired pending order does not reserve stock
6. finalization decrements stock exactly once
7. duplicate finalization with same PayPal order/capture is a no-op, not a second stock decrement
8. finalization rejects total/currency mismatch
9. anon/authenticated public users cannot select all order records
10. approved admin can read orders and update only fulfillment status

- [ ] **Step 2: Run tests and confirm failure**

Run: `supabase db reset && supabase test db supabase/tests/order_transactions.sql`

Expected: FAIL because order schema/functions do not exist.

- [ ] **Step 3: Implement order tables**

Create `orders` with at least:

```sql
id uuid primary key default gen_random_uuid(),
paypal_order_id text unique,
paypal_capture_id text unique,
checkout_token_hash text not null,
payment_status text not null check (payment_status in ('creating','created','approved','capture_pending','paid','failed','cancelled')),
fulfillment_status text not null default 'New' check (fulfillment_status in ('New','Processing','Shipped','Completed','Cancelled')),
total_minor_units integer not null check (total_minor_units >= 0),
currency text not null default 'USD' check (currency = 'USD'),
customer_email text,
shipping_json jsonb,
expires_at timestamptz not null default (now() + interval '30 minutes'),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Create `order_items` with product FK, snapshot name, snapshot unit price, quantity > 0, and FK `order_id on delete cascade`.

- [ ] **Step 4: Implement atomic snapshot/reservation function**

`create_checkout_snapshot` must run in one transaction, lock requested product rows `for update`, remove duplicate product IDs by aggregating quantities, reject any non-positive quantity, and calculate available stock as:

```sql
product.stock_quantity - coalesce(sum(unpaid_unexpired_order_item.quantity), 0)
```

where reservations include orders with `payment_status in ('creating','created','approved','capture_pending') and expires_at > now()`.

Insert the order and item snapshots using the current product price/name. Return internal order UUID. Do not decrement product stock here.

- [ ] **Step 5: Implement idempotent finalization**

`finalize_paid_order` must lock the order row and relevant product rows. If already `paid` with the same capture ID, return the order ID unchanged. Otherwise require exact amount and `USD`, verify each product still has enough physical `stock_quantity`, decrement each product once, set payment status `paid`, save PayPal capture/customer/shipping data, and set fulfillment `New`.

- [ ] **Step 6: Add RLS**

Public users receive no direct order-table read/write access. Approved admins may select orders/items. Approved admins may update `fulfillment_status` through a narrowly scoped policy/RPC; they may not change payment totals, PayPal IDs, or payment status from the browser.

- [ ] **Step 7: Run database tests**

Run: `supabase db reset && supabase test db supabase/tests/order_transactions.sql`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/2026082903_orders.sql supabase/tests/order_transactions.sql
git commit -m "feat: add transactional order and inventory model"
```

### Task 2: Add tested PayPal server helper

**Files:**
- Create: `supabase/functions/_shared/paypal.ts`
- Create: `supabase/functions/_shared/paypal.test.ts`

**Interfaces:**
- Produces: `getPayPalBaseUrl(env: 'sandbox'|'live'): string`
- Produces: `getPayPalAccessToken(fetchFn = fetch): Promise<string>`
- Produces: `paypalRequest(path: string, init: RequestInit, fetchFn = fetch): Promise<Response>`
- Produces: `verifyPayPalWebhook(req: Request, event: unknown, fetchFn = fetch): Promise<boolean>`

- [ ] **Step 1: Write failing helper tests**

Mock HTTP and verify:
- sandbox base URL is `https://api-m.sandbox.paypal.com`
- live base URL is `https://api-m.paypal.com`
- OAuth token request uses Basic auth with client ID/secret and `grant_type=client_credentials`
- API helper adds bearer token and JSON headers
- non-2xx PayPal response produces a typed error without leaking secret values
- webhook verification forwards PayPal transmission headers, configured webhook ID, and original webhook event to PayPal's verification endpoint or equivalent current verified-signature implementation

- [ ] **Step 2: Run test and confirm failure**

Run: `deno test supabase/functions/_shared/paypal.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement helper with exact secret names**

Read:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV` (`sandbox` or `live`)

Never log secret values or Authorization headers.

- [ ] **Step 4: Run helper tests**

Run: `deno test supabase/functions/_shared/paypal.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/paypal.ts supabase/functions/_shared/paypal.test.ts
git commit -m "feat: add PayPal server API helper"
```

### Task 3: Implement authoritative PayPal order creation

**Files:**
- Create: `supabase/functions/paypal-create-order/index.ts`
- Create: `supabase/functions/paypal-create-order/index.test.ts`

**Interfaces:**
- Request: `POST { items: Array<{ productId: string, quantity: number }> }`
- Response: `{ paypalOrderId: string, checkoutToken: string, totalMinorUnits: number, currency: 'USD' }`
- Consumes: `create_checkout_snapshot`

- [ ] **Step 1: Write failing function tests**

Mock database + PayPal and verify:
- client-supplied price field is ignored if present
- invalid quantity is rejected before PayPal call
- inactive/sold-out/reservation-exhausted product rejection returns 409
- server total is used in PayPal payload
- PayPal `purchase_units[0].custom_id` contains the internal order UUID
- `PayPal-Request-Id` is a deterministic idempotency key derived from internal order UUID
- PayPal creation failure marks internal order `failed`

- [ ] **Step 2: Run and confirm failure**

Run: `deno test supabase/functions/paypal-create-order/index.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement checkout token**

Generate 32 random bytes with Web Crypto, encode URL-safe base64 for the browser token, SHA-256 hash it, store only the hash in `orders.checkout_token_hash`, and return the raw token once.

- [ ] **Step 4: Create PayPal order from snapshot**

Send PayPal an `intent: 'CAPTURE'` order using the server-calculated total formatted from integer cents. Do not accept a total from request JSON. Update the internal order with returned `paypal_order_id` and `payment_status='created'`.

- [ ] **Step 5: Run tests**

Run: `deno test supabase/functions/paypal-create-order/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/paypal-create-order
git commit -m "feat: create PayPal orders from authoritative cart data"
```

### Task 4: Implement server-side capture and buyer status/cancel endpoints

**Files:**
- Create: `supabase/functions/paypal-capture-order/index.ts`
- Create: `supabase/functions/paypal-capture-order/index.test.ts`
- Create: `supabase/functions/paypal-order-status/index.ts`
- Create: `supabase/functions/paypal-order-cancel/index.ts`

**Interfaces:**
- Capture request: `POST { paypalOrderId, checkoutToken }`
- Capture response: `{ status: 'pending_confirmation'|'paid', paypalOrderId }`
- Status request: `POST { paypalOrderId, checkoutToken }`
- Status response: `{ paymentStatus, fulfillmentStatus, totalMinorUnits, currency }`
- Cancel request: `POST { paypalOrderId, checkoutToken }`

- [ ] **Step 1: Write failing capture tests**

Verify wrong checkout token is rejected, unknown PayPal order is rejected, correct token triggers `/v2/checkout/orders/{id}/capture`, PayPal failure does not decrement stock, and successful capture records `capture_pending` until webhook finalization.

- [ ] **Step 2: Implement token verification and capture**

Hash the supplied token with SHA-256 and compare to `checkout_token_hash`. Only an unexpired pending order may be captured. Call PayPal capture server-side. Store non-secret capture metadata needed for later reconciliation, but do not decrement product stock in this function.

- [ ] **Step 3: Implement sanitized status endpoint**

Require the same checkout token and return only buyer-safe fields. Do not return admin notes, shipping JSON, customer email, internal admin IDs, or other orders.

- [ ] **Step 4: Implement cancellation endpoint**

Require the checkout token and call `cancel_pending_order`. It may cancel only unpaid orders. A paid order always rejects cancellation here; refunds remain a PayPal admin task.

- [ ] **Step 5: Run Deno tests**

Run: `deno test supabase/functions/paypal-capture-order/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/paypal-capture-order supabase/functions/paypal-order-status supabase/functions/paypal-order-cancel
git commit -m "feat: capture and track buyer PayPal checkout"
```

### Task 5: Implement verified PayPal webhook and idempotent paid finalization

**Files:**
- Create: `supabase/functions/paypal-webhook/index.ts`
- Create: `supabase/functions/paypal-webhook/index.test.ts`

**Interfaces:**
- Consumes: `verifyPayPalWebhook()` and `finalize_paid_order()`
- Handles at minimum: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.PAYMENT-APPROVAL.REVERSED`

- [ ] **Step 1: Write failing webhook tests**

Cover:
- bad signature -> 400/401 and no database mutation
- `PAYMENT.CAPTURE.COMPLETED` -> exact one finalization call
- duplicate completed delivery -> success response and no second stock decrement
- pending event -> order remains non-fulfillable
- denied/reversed event -> mark failed/cancelled without decrement
- unknown event -> 2xx ignored response so PayPal does not retry forever

- [ ] **Step 2: Run and confirm failure**

Run: `deno test supabase/functions/paypal-webhook/index.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement signature verification before parsing business actions**

Read the raw event JSON and PayPal transmission headers. Verify with the configured webhook ID. After verification, for completed captures use the related PayPal order ID and/or fetch the Orders v2 record server-side to confirm amount, currency, capture ID, payer email, and shipping before calling `finalize_paid_order`.

- [ ] **Step 4: Run webhook + transaction tests**

```bash
deno test supabase/functions/paypal-webhook/index.test.ts
supabase test db supabase/tests/order_transactions.sql
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/paypal-webhook supabase/tests/order_transactions.sql
git commit -m "feat: finalize PayPal payments from verified webhooks"
```

### Task 6: Add PayPal checkout UI to the cart

**Files:**
- Create: `js/checkout.js`
- Create: `tests/frontend/checkout.test.js`
- Modify: `js/cart.js`
- Modify: `index.html`
- Modify: `css/store.css`

**Interfaces:**
- Consumes cart: `Array<{productId, quantity}>`
- Produces: `mountPayPalCheckout()`
- Produces UI states: idle, validating, PayPal approval, pending confirmation, paid, cancelled, error.

- [ ] **Step 1: Write failing checkout tests**

With a mocked PayPal SDK and Edge Function caller, verify:
- checkout sends only IDs and quantities
- create callback returns server `paypalOrderId`
- checkout token is retained only for current checkout flow/session
- `onApprove` calls capture endpoint
- `onCancel` calls cancel endpoint and preserves cart
- paid status clears cart exactly once
- server 409 price/stock response refreshes products and shows customer-facing warning

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/checkout.test.js`

Expected: FAIL.

- [ ] **Step 3: Load PayPal JS SDK using public client ID**

Use `window.SITE_CONFIG.PAYPAL_CLIENT_ID`. If absent, display `Checkout is temporarily unavailable.` instead of rendering a broken button. Do not put client secret anywhere in HTML/JS.

- [ ] **Step 4: Implement create/approve/status flow**

`createOrder` calls `paypal-create-order`. `onApprove` calls `paypal-capture-order`, then polls `paypal-order-status` with bounded retry/backoff until `paid`, `failed`, or a 30-second UI timeout. If still pending after timeout, show `Payment received by PayPal. We're confirming your order.` and keep a `Check order status` action.

- [ ] **Step 5: Run tests and mobile smoke test**

Run: `npm test -- tests/frontend/checkout.test.js`

Expected: PASS. On phone width the PayPal button and status copy fit without horizontal scrolling.

- [ ] **Step 6: Commit**

```bash
git add js/checkout.js js/cart.js index.html css/store.css tests/frontend/checkout.test.js
git commit -m "feat: add PayPal checkout experience"
```

### Task 7: Add approved-admin order dashboard

**Files:**
- Create: `js/admin-orders.js`
- Create: `tests/frontend/admin-orders.test.js`
- Modify: `js/admin-dashboard.js`
- Modify: `index.html`
- Modify: `css/store.css`

**Interfaces:**
- Produces: order list newest-first
- Produces: order detail view
- Produces: fulfillment update restricted to supported statuses

- [ ] **Step 1: Write failing dashboard tests**

Verify:
- newest order sorts first
- paid/payment status is visible but not editable
- order item snapshot name/unit price/quantity are shown
- fulfillment status supports only the five approved values
- public/unapproved states cannot mount order tools

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/admin-orders.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement admin order view**

Query orders and nested `order_items` under approved admin session. Render customer email/shipping only to approved admins. Update only fulfillment status using the constrained database path from Task 1.

- [ ] **Step 4: Run frontend + RLS tests**

```bash
npm test -- tests/frontend/admin-orders.test.js
supabase test db supabase/tests/order_transactions.sql
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/admin-orders.js js/admin-dashboard.js index.html css/store.css tests/frontend/admin-orders.test.js
git commit -m "feat: add admin order fulfillment dashboard"
```

### Task 8: Sandbox deployment, webhook registration, and production checklist

**Files:**
- Create: `docs/paypal-setup.md`
- Modify: `README.md`

**Interfaces:**
- Documents configuration only; no secret values committed.

- [ ] **Step 1: Document exact Edge Function secrets**

```text
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
PAYPAL_ENV=sandbox
SUPABASE_SERVICE_ROLE_KEY
```

Document public browser config `PAYPAL_CLIENT_ID` separately and explicitly mark it non-secret.

- [ ] **Step 2: Document webhook registration**

Register the deployed `paypal-webhook` HTTPS URL in the PayPal app and subscribe at minimum to completed/pending/denied capture events and approval reversal events used by the function. Record the PayPal-generated webhook ID as `PAYPAL_WEBHOOK_ID` secret.

- [ ] **Step 3: Execute sandbox acceptance transaction**

Exact test:
1. Admin creates a $1.00 product with stock 2.
2. Buyer adds 1 unit.
3. Checkout creates PayPal order at exactly $1.00 despite any browser price manipulation attempt.
4. Sandbox buyer approves.
5. Server captures.
6. Verified webhook marks internal order paid.
7. Stock becomes 1 exactly once.
8. Resending the same webhook leaves stock at 1.
9. Admin sees order and changes fulfillment New -> Processing -> Shipped.

- [ ] **Step 4: Execute cancellation test**

Create a second checkout then cancel in PayPal. Verify no stock decrement and the reservation stops blocking availability after cancellation.

- [ ] **Step 5: Run complete payment suite**

```bash
npm test
supabase test db supabase/tests/order_transactions.sql
deno test supabase/functions/_shared/paypal.test.ts supabase/functions/paypal-create-order/index.test.ts supabase/functions/paypal-capture-order/index.test.ts supabase/functions/paypal-webhook/index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Document live switch**

Go-live procedure must require creating/using live PayPal REST app credentials, registering the live webhook URL, setting `PAYPAL_ENV=live`, updating the public live client ID, and repeating a low-value real transaction before announcing the store as live.

- [ ] **Step 7: Commit docs**

```bash
git add docs/paypal-setup.md README.md
git commit -m "docs: add PayPal sandbox and go-live checklist"
```

## PayPal Acceptance Gate

Before starting Community Chat:
- Browser cannot influence authoritative price, stock, or total.
- Successful sandbox payment creates/finalizes exactly one paid internal order.
- Stock changes only after verified payment and only once.
- Duplicate webhook delivery is harmless.
- Cancellation/failed verification never decrements stock.
- Approved admins can view orders and update fulfillment only.
- PayPal secrets are absent from repository frontend code.
- All frontend, database, and Deno tests pass.
