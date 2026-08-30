# Foundation + Google Admin Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase foundation, test harness, Google-only admin authentication, approved-email authorization, owner-only admin management, and private dashboard shell without changing the public site's existing black-and-gold design.

**Architecture:** Keep GitHub Pages as the frontend and add native browser JavaScript modules alongside the existing `script.js`. Supabase Auth handles Google identity, Postgres + RLS enforce admin permissions, and an Edge Function handles owner-only admin-list mutations using server-side authorization. Public Supabase URL/anon key may be shipped to the browser; service-role and OAuth secrets never enter repository JavaScript.

**Tech Stack:** HTML/CSS/JavaScript, Supabase Auth/Postgres/Edge Functions, Vitest + jsdom, pgTAP/Supabase local database tests, Deno tests for Edge Functions.

**Spec:** `docs/superpowers/specs/2026-08-29-community-chat-store-design.md`

## Global Constraints

- Preserve the current black-and-gold visual identity and official bee icon.
- Google is the only admin sign-in provider.
- Admin authority comes from the backend `admins` table, never localStorage, URL parameters, or client-side flags.
- Only `role = 'owner'` may add, remove, activate, deactivate, or change roles for admins.
- Approved non-owner admins must not be able to modify the admin list even if they manually call the Edge Function.
- Normalize admin emails with `trim().toLowerCase()` before comparison or storage.
- Do not commit `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth client secret, or any other server secret.
- Keep existing public page sections and image loaders working.

---

## File Structure

- Create `package.json` — local test scripts and dev dependencies only; production remains static GitHub Pages.
- Create `vitest.config.js` — jsdom test environment.
- Create `js/supabase-client.js` — browser client creation from `window.SITE_CONFIG`.
- Create `js/auth.js` — Google sign-in/sign-out, session observation, normalized admin role state.
- Create `js/admin-dashboard.js` — private dashboard shell, owner-only admin access controls.
- Create `js/admin-access.js` — pure helpers for email normalization and role capability checks.
- Create `css/admin.css` — branded admin/auth UI.
- Create `tests/frontend/admin-access.test.js` — pure access helper tests.
- Create `tests/frontend/auth.test.js` — auth state rendering tests with a mocked Supabase client.
- Create `supabase/migrations/2026082901_admin_foundation.sql` — `admins` table, helper functions, RLS, grants.
- Create `supabase/tests/admin_policies.sql` — database authorization tests.
- Create `supabase/functions/_shared/admin-auth.ts` — token/user/admin authorization helpers.
- Create `supabase/functions/_shared/admin-auth.test.ts` — Deno unit tests.
- Create `supabase/functions/admin-manage/index.ts` — owner-only list/add/update/deactivate operations.
- Modify `index.html` — load Supabase browser library, public config, auth module, admin entry point, dashboard container.
- Modify `styles.css` only for shared navigation/responsive hooks if needed; admin-specific rules stay in `css/admin.css`.

### Task 1: Add frontend test harness and pure access helpers

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `js/admin-access.js`
- Create: `tests/frontend/admin-access.test.js`

**Interfaces:**
- Produces: `normalizeEmail(value: string): string`
- Produces: `canManageAdmins(role: string | null): boolean`
- Produces: `isAdminRole(role: string | null): boolean`

- [ ] **Step 1: Write the failing helper tests**

```js
import { describe, expect, it } from 'vitest';
import { normalizeEmail, canManageAdmins, isAdminRole } from '../../js/admin-access.js';

describe('admin access helpers', () => {
  it('normalizes Google emails', () => {
    expect(normalizeEmail('  Owner@Example.COM ')).toBe('owner@example.com');
  });

  it('allows only owners to manage admins', () => {
    expect(canManageAdmins('owner')).toBe(true);
    expect(canManageAdmins('admin')).toBe(false);
    expect(canManageAdmins(null)).toBe(false);
  });

  it('recognizes only supported privileged roles', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('visitor')).toBe(false);
  });
});
```

- [ ] **Step 2: Add test configuration and run the test to verify it fails**

`package.json` must include:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^26.0.0",
    "vitest": "^3.2.0"
  }
}
```

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js']
  }
});
```

Run: `npm install && npm test -- tests/frontend/admin-access.test.js`

Expected: FAIL because `js/admin-access.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```js
export function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

export function canManageAdmins(role) {
  return role === 'owner';
}

export function isAdminRole(role) {
  return role === 'owner' || role === 'admin';
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npm test -- tests/frontend/admin-access.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js js/admin-access.js tests/frontend/admin-access.test.js
git commit -m "test: add admin access test foundation"
```

### Task 2: Create the admin database model and RLS boundary

**Files:**
- Create: `supabase/migrations/2026082901_admin_foundation.sql`
- Create: `supabase/tests/admin_policies.sql`

**Interfaces:**
- Produces table: `public.admins(id uuid, email text, role text, active boolean, created_at timestamptz)`
- Produces SQL helper: `public.current_user_email() returns text`
- Produces SQL helper: `public.is_active_admin() returns boolean`
- Produces SQL helper: `public.is_owner() returns boolean`

- [ ] **Step 1: Write policy tests before the migration**

Use Supabase/pgTAP tests that seed three identities: owner, approved admin, unapproved Google user. Cover these assertions:

```sql
select plan(6);
select is(public.normalize_admin_email('  Owner@Example.COM '), 'owner@example.com', 'email normalized');
select ok(public.test_admin_access('owner@example.com'), 'owner recognized');
select ok(public.test_admin_access('admin@example.com'), 'approved admin recognized');
select is(public.test_admin_access('nobody@example.com'), false, 'unapproved user rejected');
select ok(public.test_owner_access('owner@example.com'), 'owner recognized as owner');
select is(public.test_owner_access('admin@example.com'), false, 'admin is not owner');
select * from finish();
```

The migration must expose test-safe helper wrappers only when running locally, or the test file may call the underlying stable helpers by setting JWT claims with `set_config`.

- [ ] **Step 2: Run database tests and confirm failure**

Run: `supabase db reset && supabase test db supabase/tests/admin_policies.sql`

Expected: FAIL because the `admins` table/helpers do not exist.

- [ ] **Step 3: Implement the migration**

The migration must include these exact security properties:

```sql
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('owner','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.normalize_admin_email(value text)
returns text language sql immutable as $$
  select lower(trim(coalesce(value, '')))
$$;

create or replace function public.current_user_email()
returns text language sql stable as $$
  select public.normalize_admin_email(auth.jwt() ->> 'email')
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = public.current_user_email() and active = true
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = public.current_user_email()
      and active = true
      and role = 'owner'
  )
$$;

alter table public.admins enable row level security;
```

Add RLS so an authenticated user may read only their own active admin row, while owners may read all rows. Do not grant anon any access to `admins`. Do not add client-side insert/update/delete policies; list mutation will be through `admin-manage`.

- [ ] **Step 4: Run database tests**

Run: `supabase db reset && supabase test db supabase/tests/admin_policies.sql`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026082901_admin_foundation.sql supabase/tests/admin_policies.sql
git commit -m "feat: add admin authorization model"
```

### Task 3: Add Google admin sign-in and access-denied state

**Files:**
- Create: `js/supabase-client.js`
- Create: `js/auth.js`
- Create: `tests/frontend/auth.test.js`
- Create: `css/admin.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `normalizeEmail`, `isAdminRole` from `js/admin-access.js`
- Produces: `getAdminState(): { user: object|null, role: 'owner'|'admin'|null, approved: boolean }`
- Produces: `signInWithGoogle(): Promise<void>`
- Produces: `signOutAdmin(): Promise<void>`
- Produces browser event: `admin-state-changed`

- [ ] **Step 1: Write failing auth rendering tests**

Test three states with a mocked Supabase client: signed out, Google-authenticated but unapproved, and approved owner. Verify that the dashboard container is hidden unless approved and that the unapproved state displays `This Google account is not approved for admin access.`

```js
expect(renderAdminGate({ user: null, approved: false, role: null })).toContain('Sign in with Google');
expect(renderAdminGate({ user: { email: 'x@example.com' }, approved: false, role: null })).toContain('not approved');
expect(renderAdminGate({ user: { email: 'owner@example.com' }, approved: true, role: 'owner' })).toContain('Admin Dashboard');
```

- [ ] **Step 2: Run auth test and confirm failure**

Run: `npm test -- tests/frontend/auth.test.js`

Expected: FAIL because auth module/render helpers do not exist.

- [ ] **Step 3: Implement Supabase client and auth state**

`js/supabase-client.js` must fail loudly when public configuration is missing:

```js
export function getSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.SITE_CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase public configuration is missing.');
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
```

`signInWithGoogle()` must call:

```js
await client.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${location.origin}${location.pathname}#admin` }
});
```

After any auth session change, query `admins` for the normalized signed-in email using the current session. If no active row returns, set `approved = false`, hide private tools, and never infer a role from OAuth metadata.

- [ ] **Step 4: Add branded admin gate to `index.html` and `css/admin.css`**

Add a navigation item `Admin` and an `#admin` section containing:
- signed-out Google button
- access-denied panel
- approved dashboard shell
- sign-out button

Load the Supabase v2 browser library before the module scripts, load a `site-config.js` file containing only the public project URL and anon key, and load `js/auth.js` as `type="module"`.

- [ ] **Step 5: Run tests and browser smoke test**

Run: `npm test`

Then serve locally and verify existing logo/article image loaders, navigation, and new admin section coexist.

Expected: all Vitest tests PASS and no existing public section disappears.

- [ ] **Step 6: Commit**

```bash
git add index.html css/admin.css js/supabase-client.js js/auth.js tests/frontend/auth.test.js
git commit -m "feat: add Google admin sign in gate"
```

### Task 4: Add shared Edge Function admin authorization

**Files:**
- Create: `supabase/functions/_shared/admin-auth.ts`
- Create: `supabase/functions/_shared/admin-auth.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(value: string): string`
- Produces: `requireAdmin(req: Request, supabaseAdmin: SupabaseClient): Promise<{ userId: string, email: string, role: 'owner'|'admin' }>`
- Produces: `requireOwner(req: Request, supabaseAdmin: SupabaseClient): Promise<{ userId: string, email: string, role: 'owner' }>`

- [ ] **Step 1: Write failing Deno tests**

Test missing bearer token, invalid token, inactive admin, approved admin, and owner-only enforcement. Mock `auth.getUser(token)` and `admins` lookup so tests do not require network.

- [ ] **Step 2: Run tests to confirm failure**

Run: `deno test supabase/functions/_shared/admin-auth.test.ts`

Expected: FAIL because implementation does not exist.

- [ ] **Step 3: Implement authorization helper**

Authorization must:
1. Read `Authorization: Bearer <jwt>`.
2. Call `supabaseAdmin.auth.getUser(jwt)`.
3. Normalize `user.email`.
4. Query `admins` by normalized email and `active = true`.
5. Return only `owner` or `admin`.
6. Throw 401 for missing/invalid auth and 403 for unapproved or insufficient role.

Do not trust role or email passed in request JSON.

- [ ] **Step 4: Run Deno tests**

Run: `deno test supabase/functions/_shared/admin-auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/admin-auth.ts supabase/functions/_shared/admin-auth.test.ts
git commit -m "feat: add server admin authorization helper"
```

### Task 5: Implement owner-only approved-email management

**Files:**
- Create: `supabase/functions/admin-manage/index.ts`
- Create: `supabase/functions/admin-manage/index.test.ts`
- Modify: `js/admin-dashboard.js`
- Modify: `index.html`
- Modify: `css/admin.css`
- Create: `tests/frontend/admin-dashboard.test.js`

**Interfaces:**
- Consumes: `requireOwner()`
- Edge Function operations:
  - `GET` -> `{ admins: Array<{id,email,role,active,created_at}> }`
  - `POST { email, role }` -> approved/updated admin
  - `PATCH { id, role?, active? }` -> updated admin
- Owner UI consumes these operations using the current Supabase access token.

- [ ] **Step 1: Write failing Edge Function tests**

Cover:
- non-owner gets 403
- owner can add normalized `admin@example.com`
- owner can deactivate an admin
- request cannot create unsupported role
- request cannot deactivate the final active owner

- [ ] **Step 2: Run function tests to verify failure**

Run: `deno test supabase/functions/admin-manage/index.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement `admin-manage`**

Use `requireOwner()` before reading or mutating the list. Validate role with:

```ts
const VALID_ROLES = new Set(['owner', 'admin']);
```

Reject blank/invalid email and prevent removal/deactivation of the final active owner by counting active owners inside the same protected operation before applying the change.

- [ ] **Step 4: Write failing owner dashboard UI test**

Verify `Admin Access` controls render only for `role === 'owner'`, and that an `admin` role does not receive the add/remove form.

- [ ] **Step 5: Implement the owner dashboard controls**

The owner panel must provide:
- email input
- role select (`Admin`, `Owner`)
- approve button
- current admin list with active state
- deactivate/reactivate action
- role change action

All mutations call the Edge Function with the current access token; never write directly to `admins` from browser code.

- [ ] **Step 6: Run frontend and Deno tests**

Run:

```bash
npm test -- tests/frontend/admin-dashboard.test.js
deno test supabase/functions/admin-manage/index.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/admin-manage js/admin-dashboard.js index.html css/admin.css tests/frontend/admin-dashboard.test.js
git commit -m "feat: add owner managed admin allowlist"
```

### Task 6: Bootstrap and verify the first owner safely

**Files:**
- Create: `docs/admin-setup.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: deployed Supabase project, Google provider configuration, `admins` table.
- Produces: documented one-time owner bootstrap procedure and production verification checklist.

- [ ] **Step 1: Document exact required public and secret configuration names**

Document browser/public values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Document Supabase Edge Function secrets:
- `SUPABASE_SERVICE_ROLE_KEY`

Document Supabase dashboard Google provider setup and authorized redirect URL equal to the production GitHub Pages admin return URL.

- [ ] **Step 2: Document one-time owner bootstrap SQL**

The document must tell the implementer to replace the email literal with the owner's verified Google email before executing, then run exactly one insert/upsert:

```sql
insert into public.admins (email, role, active)
values (public.normalize_admin_email('OWNER_VERIFIED_GOOGLE_EMAIL'), 'owner', true)
on conflict (email) do update set role = 'owner', active = true;
```

The string `OWNER_VERIFIED_GOOGLE_EMAIL` is deployment input, not committed application configuration.

- [ ] **Step 3: Verify permission cases against the deployed project**

Using three Google accounts where available, verify:
- owner reaches dashboard and Admin Access panel
- approved admin reaches dashboard but never sees Admin Access
- unapproved account receives access denied
- deactivated admin loses privileged access on next protected call

- [ ] **Step 4: Run all foundation tests**

Run:

```bash
npm test
supabase test db supabase/tests/admin_policies.sql
deno test supabase/functions/_shared/admin-auth.test.ts supabase/functions/admin-manage/index.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/admin-setup.md README.md
git commit -m "docs: add admin deployment and owner bootstrap guide"
```

## Foundation Acceptance Gate

Before starting Storefront + Product Management:
- Existing public website still renders correctly on desktop and phone.
- Google sign-in works on the production origin.
- Unapproved accounts cannot read or mutate privileged data.
- Approved admin and owner roles are distinguished server-side.
- Only the owner can manage the approved-email list.
- No server secret exists in committed frontend files.
- All frontend, database, and Edge Function tests above pass.
