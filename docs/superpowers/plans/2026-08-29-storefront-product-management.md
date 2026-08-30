# Storefront + Product Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded public shop, one-image product catalog, browser cart, inventory-aware product cards, and approved-admin product management while keeping payment out of this phase.

**Architecture:** Product records live in Supabase Postgres with RLS. Product images live in a public-readable Supabase Storage bucket, but only approved admins may upload/delete. The public storefront reads only active products; the cart stores only product IDs and quantities, never trusted prices. Admin product CRUD uses the authenticated Supabase client and RLS, while the later PayPal plan will re-read authoritative product values server-side.

**Tech Stack:** Existing HTML/CSS/JavaScript site, Supabase Postgres/Storage/RLS, Vitest + jsdom, pgTAP/Supabase database tests.

**Spec:** `docs/superpowers/specs/2026-08-29-community-chat-store-design.md`

## Global Constraints

- Requires the completed Foundation + Google Admin Access plan.
- Preserve the current black-and-gold visual identity, typography, and official bee icon.
- One primary product image per product in the initial release.
- Store money as integer minor units; do not store floating-point prices.
- Initial storefront currency is `USD`.
- Public visitors may read only active products.
- Approved admins may create/edit/archive products and manage inventory; unapproved users may not.
- A product with `stock_quantity <= 0` is sold out and cannot be added to the cart.
- The browser cart persists only `{ productId, quantity }`; it does not persist an authoritative price.
- Product archival must not destroy historical data needed by future orders.
- Product image uploads accept JPEG, PNG, or WebP up to 5 MiB and use generated object keys, not user filenames.

---

## File Structure

- Create `supabase/migrations/2026082902_products.sql` — products table, RLS, storage bucket/policies.
- Create `supabase/tests/product_policies.sql` — public/admin database and storage access tests.
- Create `js/money.js` — integer money parsing/formatting.
- Create `js/cart.js` — cart state/persistence and stock-aware quantity logic.
- Create `js/store.js` — public product loading and rendering.
- Create `js/admin-products.js` — product form, image upload, edit/archive/inventory actions.
- Create `css/store.css` — storefront, cart, and product-admin styling.
- Create `tests/frontend/money.test.js`
- Create `tests/frontend/cart.test.js`
- Create `tests/frontend/store.test.js`
- Create `tests/frontend/admin-products.test.js`
- Modify `index.html` — Shop navigation, catalog, cart drawer/panel, admin Products panel.
- Modify `js/admin-dashboard.js` — mount product-admin module for approved roles.

### Task 1: Add product schema, public read rules, and admin write rules

**Files:**
- Create: `supabase/migrations/2026082902_products.sql`
- Create: `supabase/tests/product_policies.sql`

**Interfaces:**
- Produces table: `public.products`
- Product shape: `{ id, name, description, price_minor_units, currency, stock_quantity, image_path, active, created_at, updated_at }`
- Consumes: `public.is_active_admin()` from foundation migration.

- [ ] **Step 1: Write failing database policy tests**

Cover these cases with pgTAP/local JWT claims:

```sql
select plan(7);
-- anon sees active product
-- anon cannot see inactive product
-- anon cannot insert/update/delete
-- approved admin sees active and inactive products
-- approved admin can insert valid product
-- approved admin can update stock/price/active state
-- unapproved authenticated user cannot mutate products
select * from finish();
```

Seed one active product and one inactive product with integer cent values.

- [ ] **Step 2: Run database tests and confirm failure**

Run: `supabase db reset && supabase test db supabase/tests/product_policies.sql`

Expected: FAIL because `products` does not exist.

- [ ] **Step 3: Implement product table and RLS**

Migration must create:

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  price_minor_units integer not null check (price_minor_units >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
```

Add an `updated_at` trigger. Add policies so anon/authenticated public sessions can `select` rows where `active = true`, while approved admins may select all rows and insert/update rows. Do not expose a public delete policy. Product removal in the UI is archive-by-`active=false`.

- [ ] **Step 4: Run policy tests**

Run: `supabase db reset && supabase test db supabase/tests/product_policies.sql`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026082902_products.sql supabase/tests/product_policies.sql
git commit -m "feat: add product catalog schema and policies"
```

### Task 2: Add product image storage with admin-only writes

**Files:**
- Modify: `supabase/migrations/2026082902_products.sql`
- Modify: `supabase/tests/product_policies.sql`

**Interfaces:**
- Produces bucket: `product-images`
- Public read URL pattern: Supabase Storage public object URL for `product-images/<uuid>.<ext>`

- [ ] **Step 1: Extend failing policy tests for storage**

Verify:
- anon can read an existing product image
- anon cannot upload/delete product image
- approved admin can upload/delete under `product-images`
- unapproved authenticated user cannot upload/delete

- [ ] **Step 2: Add bucket and policies**

Migration must create the bucket idempotently:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

Add storage object insert/update/delete policies scoped to `bucket_id = 'product-images' and public.is_active_admin()`.

- [ ] **Step 3: Run database/storage tests**

Run: `supabase db reset && supabase test db supabase/tests/product_policies.sql`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026082902_products.sql supabase/tests/product_policies.sql
git commit -m "feat: secure product image storage"
```

### Task 3: Add integer money helpers

**Files:**
- Create: `js/money.js`
- Create: `tests/frontend/money.test.js`

**Interfaces:**
- Produces: `parseUsdToMinor(value: string): number`
- Produces: `formatUsdMinor(value: number): string`

- [ ] **Step 1: Write failing money tests**

```js
import { describe, expect, it } from 'vitest';
import { parseUsdToMinor, formatUsdMinor } from '../../js/money.js';

describe('money helpers', () => {
  it('parses dollars without float drift', () => {
    expect(parseUsdToMinor('12.34')).toBe(1234);
    expect(parseUsdToMinor('12')).toBe(1200);
  });

  it('rejects invalid or negative values', () => {
    expect(() => parseUsdToMinor('-1')).toThrow();
    expect(() => parseUsdToMinor('12.345')).toThrow();
    expect(() => parseUsdToMinor('abc')).toThrow();
  });

  it('formats cents as USD', () => {
    expect(formatUsdMinor(1234)).toBe('$12.34');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/money.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement money helpers using string parsing**

Do not use `Math.round(parseFloat(value) * 100)` as the primary parser. Parse with a strict regex such as `^\d+(?:\.\d{1,2})?$`, split dollars/cents, pad cents to two digits, and combine integer values.

- [ ] **Step 4: Run test**

Run: `npm test -- tests/frontend/money.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/money.js tests/frontend/money.test.js
git commit -m "feat: add exact USD money helpers"
```

### Task 4: Build the public storefront

**Files:**
- Create: `js/store.js`
- Create: `css/store.css`
- Create: `tests/frontend/store.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: Supabase client, `formatUsdMinor()`
- Produces: `loadPublicProducts(): Promise<Product[]>`
- Produces: `renderProductCard(product): string|HTMLElement`
- Emits browser event: `store-products-updated` with live public product array.

- [ ] **Step 1: Write failing storefront tests**

Test that:
- active in-stock product renders name, description, image, `$12.34`, and Add to Cart
- stock zero renders `Sold Out` and no enabled add button
- missing image renders a branded non-emoji placeholder using the official bee asset
- inactive rows returned by a bad mock are filtered before render as defense-in-depth

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/frontend/store.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement store loader and renderers**

Query only:

```js
client
  .from('products')
  .select('id,name,description,price_minor_units,currency,stock_quantity,image_path,active,created_at,updated_at')
  .eq('active', true)
  .order('created_at', { ascending: false });
```

Build image URLs through `client.storage.from('product-images').getPublicUrl(image_path)` only when `image_path` exists.

- [ ] **Step 4: Add `Shop` section and responsive styling**

Add `Shop` to the main nav and create a public section with:
- section heading
- responsive product grid
- empty-state copy
- loading/error state
- cart button with quantity badge

Do not add PayPal controls yet.

- [ ] **Step 5: Run storefront tests and manual mobile smoke test**

Run: `npm test -- tests/frontend/store.test.js`

Expected: PASS. At ~360 px width, cards remain readable and add buttons remain tappable.

- [ ] **Step 6: Commit**

```bash
git add index.html css/store.css js/store.js tests/frontend/store.test.js
git commit -m "feat: add public product storefront"
```

### Task 5: Add browser cart using IDs and quantities only

**Files:**
- Create: `js/cart.js`
- Create: `tests/frontend/cart.test.js`
- Modify: `js/store.js`
- Modify: `index.html`
- Modify: `css/store.css`

**Interfaces:**
- Produces: `loadCart(): Array<{ productId: string, quantity: number }>`
- Produces: `addToCart(productId: string, maxStock: number): Cart`
- Produces: `setCartQuantity(productId: string, quantity: number, maxStock: number): Cart`
- Produces: `removeFromCart(productId: string): Cart`
- Storage key: `dvtb_cart_v1`

- [ ] **Step 1: Write failing cart tests**

Cover:
- add first item at quantity 1
- repeated add increments quantity
- quantity never exceeds current known stock
- zero/negative quantity removes item
- persisted cart contains only productId and quantity
- corrupt localStorage resets to empty cart

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/frontend/cart.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement cart state**

Normalize every persisted item to:

```js
{ productId: String(item.productId), quantity: Math.max(1, Number.parseInt(item.quantity, 10)) }
```

Never persist name, image, price, subtotal, or total as authoritative data.

- [ ] **Step 4: Build cart panel UI**

The cart panel must rejoin cart IDs with the latest loaded product records for display. If a product is removed/inactive or stock falls below cart quantity, show a clear warning and clamp the display quantity to available stock. Include Remove and +/- controls. Leave the checkout area with copy `PayPal checkout will load after the cart is validated.` and no payment action in this phase.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/frontend/cart.test.js tests/frontend/store.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/cart.js js/store.js index.html css/store.css tests/frontend/cart.test.js
git commit -m "feat: add persistent inventory-aware cart"
```

### Task 6: Add approved-admin product management

**Files:**
- Create: `js/admin-products.js`
- Create: `tests/frontend/admin-products.test.js`
- Modify: `js/admin-dashboard.js`
- Modify: `index.html`
- Modify: `css/store.css`

**Interfaces:**
- Consumes: approved admin auth state, Supabase client, `parseUsdToMinor()`
- Produces: `saveProduct(formState): Promise<Product>`
- Produces: `uploadProductImage(file: File, productId: string): Promise<string>`
- Produces: `archiveProduct(productId: string): Promise<void>`

- [ ] **Step 1: Write failing product form tests**

Cover:
- blank name rejected
- price with >2 decimals rejected
- negative stock rejected
- invalid image MIME rejected
- image >5 MiB rejected
- owner and admin roles both receive product controls
- unapproved state cannot mount product controls

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/frontend/admin-products.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement product create/edit form**

Fields:
- name, max 120 characters
- description, max 4000
- price in dollars, converted with `parseUsdToMinor`
- stock integer >= 0
- active toggle
- optional image input accepting `image/jpeg,image/png,image/webp`

For a new image, generate a path like `${productId}/${crypto.randomUUID()}.${ext}`. Upload the new object first; after product update succeeds, remove the previous image object if it changed. If database update fails, remove the newly uploaded object so no orphan remains.

- [ ] **Step 4: Implement admin product list and archive action**

Admins query all products, including inactive. `Archive` updates `active=false`; it does not hard-delete the row. Add edit, inventory, and active-state controls.

- [ ] **Step 5: Run tests and verify RLS against local Supabase**

Run:

```bash
npm test -- tests/frontend/admin-products.test.js
supabase test db supabase/tests/product_policies.sql
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/admin-products.js js/admin-dashboard.js index.html css/store.css tests/frontend/admin-products.test.js
git commit -m "feat: add admin product and inventory management"
```

### Task 7: Storefront integration regression pass

**Files:**
- Modify only files required by failing regression tests.

**Interfaces:**
- Confirms public shop and admin product management work together without payment.

- [ ] **Step 1: Run all frontend and database tests**

```bash
npm test
supabase test db supabase/tests/admin_policies.sql supabase/tests/product_policies.sql
```

Expected: PASS.

- [ ] **Step 2: Manual end-to-end local test**

Verify this exact flow:
1. Approved admin signs in.
2. Admin creates `Test Honey`, price `$12.34`, stock `2`, and uploads one JPEG/WebP image.
3. Signed-out public page shows the product at `$12.34`.
4. Visitor adds one, then two units to cart; third unit is prevented.
5. Admin changes stock to `0`.
6. Public refresh shows `Sold Out`; cart warns that the item is no longer available.
7. Admin reactivates stock and archives product; archived product disappears publicly but remains visible in admin list.

- [ ] **Step 3: Check responsive layouts**

At phone and desktop widths, verify product cards, cart controls, image previews, and admin form are usable with no horizontal overflow.

- [ ] **Step 4: Commit any verified fixes**

```bash
git add index.html css/store.css js tests supabase
git commit -m "fix: harden storefront product integration"
```

## Storefront Acceptance Gate

Before starting PayPal + Orders:
- Approved admins can create/edit/archive products and manage stock.
- Public visitors see only active products.
- Sold-out products cannot enter the cart.
- Product image upload rules are enforced by both UI and Storage configuration.
- Cart persistence contains only IDs and quantities.
- No payment or PayPal secret exists in frontend code.
- All frontend and database tests pass.
