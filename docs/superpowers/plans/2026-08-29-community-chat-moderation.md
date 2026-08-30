# Community Chat + Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public guest Community Chat with display names, realtime text messages, one photo per message, abuse controls, and approved-admin moderation/blocking.

**Architecture:** Guests do not create accounts. The browser stores a random guest ID and display name locally, while message submission goes through a Supabase Edge Function that validates the guest ID, block state, rate limit, text, and optional uploaded image metadata. Supabase Realtime delivers new messages. Approved admins moderate through protected Edge Functions using the existing Google admin session.

**Tech Stack:** Existing HTML/CSS/JavaScript site, Supabase Postgres/Realtime/Storage/Edge Functions, Vitest + jsdom, pgTAP/Supabase tests, Deno tests.

**Spec:** `docs/superpowers/specs/2026-08-29-community-chat-store-design.md`

## Global Constraints

- Requires completed Foundation + Google Admin Access plan.
- Community visitors do not need accounts.
- Each browser receives one random stable guest ID saved locally.
- Visitors choose a display name before posting.
- Each message supports text and at most one image.
- Maximum text length: 1,000 characters.
- Supported images: JPEG, PNG, WebP.
- Maximum image size after client compression: 5 MiB.
- Generated storage paths only; never trust or expose original filenames as object keys.
- Blocked guests may read chat but may not post.
- Approved admins may delete messages, remove photos, block guests, and unblock guests.
- Public users cannot execute moderation operations.
- Realtime failure must degrade to refresh/reconnect behavior.
- Preserve the site black-and-gold design and official bee icon.

---

## File Structure

- Create `supabase/migrations/2026082904_chat.sql` — chat tables, RLS, storage bucket, realtime publication.
- Create `supabase/tests/chat_policies.sql` — public/admin policy tests.
- Create `supabase/functions/chat-post/index.ts` — validated guest message submission.
- Create `supabase/functions/chat-post/index.test.ts`
- Create `supabase/functions/chat-moderate/index.ts` — approved-admin delete/photo/block/unblock operations.
- Create `supabase/functions/chat-moderate/index.test.ts`
- Create `js/chat-identity.js` — guest ID/display name persistence.
- Create `js/chat-image.js` — image validation/compression.
- Create `js/chat.js` — history load, post flow, realtime subscription, reconnect.
- Create `js/admin-chat.js` — moderation UI.
- Create `css/chat.css` — responsive chat and moderation styling.
- Create `tests/frontend/chat-identity.test.js`
- Create `tests/frontend/chat-image.test.js`
- Create `tests/frontend/chat.test.js`
- Create `tests/frontend/admin-chat.test.js`
- Modify `index.html` — Community nav/section and admin moderation panel.
- Modify `js/admin-dashboard.js` — mount moderation tools for approved roles.

### Task 1: Create chat tables, block table, storage bucket, and RLS

**Files:**
- Create: `supabase/migrations/2026082904_chat.sql`
- Create: `supabase/tests/chat_policies.sql`

**Interfaces:**
- Produces table: `public.chat_messages(id, guest_id, display_name, body, image_path, created_at, deleted_at)`
- Produces table: `public.chat_blocks(id, guest_id, reason, blocked_by_admin_id, active, created_at)`
- Produces function: `public.is_guest_blocked(guest uuid) returns boolean`
- Produces bucket: `chat-images`

- [ ] **Step 1: Write failing database policy tests**

Cover:
- anon can read non-deleted messages
- anon cannot read deleted messages
- anon cannot directly insert/update/delete chat rows
- anon cannot read block metadata
- approved admin can read deleted messages and blocks
- approved admin can moderate through protected server path
- unapproved authenticated user receives only public chat reads

- [ ] **Step 2: Run tests and confirm failure**

Run: `supabase db reset && supabase test db supabase/tests/chat_policies.sql`

Expected: FAIL because chat schema does not exist.

- [ ] **Step 3: Implement schema**

Use:

```sql
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  body text not null default '' check (char_length(body) <= 1000),
  image_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null,
  reason text not null default '' check (char_length(reason) <= 500),
  blocked_by_admin_id uuid references public.admins(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

Add indexes for recent messages, `guest_id`, and active blocks. Enable RLS. Public read policy on `chat_messages` must require `deleted_at is null`. No public direct writes.

- [ ] **Step 4: Add storage bucket and realtime publication**

Create `chat-images` with public read, 5 MiB limit, and MIME allowlist `image/jpeg,image/png,image/webp`. Do not give anon direct arbitrary upload policy. Add `chat_messages` to the Supabase realtime publication idempotently.

- [ ] **Step 5: Run policy tests**

Run: `supabase db reset && supabase test db supabase/tests/chat_policies.sql`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/2026082904_chat.sql supabase/tests/chat_policies.sql
git commit -m "feat: add chat data and security model"
```

### Task 2: Add guest identity persistence

**Files:**
- Create: `js/chat-identity.js`
- Create: `tests/frontend/chat-identity.test.js`

**Interfaces:**
- Produces: `getOrCreateGuestId(): string`
- Produces: `getDisplayName(): string`
- Produces: `setDisplayName(name: string): string`
- Storage keys: `dvtb_chat_guest_id_v1`, `dvtb_chat_display_name_v1`

- [ ] **Step 1: Write failing identity tests**

Test:
- first call creates UUID
- later call returns same UUID
- corrupt stored UUID is replaced
- display name trims whitespace
- blank display name rejected
- >40 chars rejected

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/chat-identity.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement identity helpers**

Validate guest IDs using a UUID regex and generate with `crypto.randomUUID()`. Store only ID and display name. Do not store moderation role or block state locally as authoritative values.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/frontend/chat-identity.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/chat-identity.js tests/frontend/chat-identity.test.js
git commit -m "feat: add persistent guest chat identity"
```

### Task 3: Add one-photo validation and browser compression

**Files:**
- Create: `js/chat-image.js`
- Create: `tests/frontend/chat-image.test.js`

**Interfaces:**
- Produces: `validateChatImage(file: File): void`
- Produces: `prepareChatImage(file: File): Promise<File|Blob>`
- Maximum final bytes: `5 * 1024 * 1024`

- [ ] **Step 1: Write failing image tests**

Cover:
- JPEG accepted
- PNG accepted
- WebP accepted
- GIF/PDF rejected
- >5 MiB final image rejected
- only one file may be passed to message composer

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/chat-image.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement validation and compression**

For large browser-decodable images, resize longest edge to at most 1920 px and encode to JPEG/WebP around quality 0.82 until under 5 MiB when practical. If still over limit, reject with a clear error. Preserve original file when already valid and small.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/frontend/chat-image.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/chat-image.js tests/frontend/chat-image.test.js
git commit -m "feat: validate and compress chat photos"
```

### Task 4: Implement server-validated guest posting and rate limits

**Files:**
- Create: `supabase/functions/chat-post/index.ts`
- Create: `supabase/functions/chat-post/index.test.ts`

**Interfaces:**
- Request: multipart/form-data containing `guestId`, `displayName`, `body`, optional `image`
- Response: sanitized public message record

- [ ] **Step 1: Write failing Deno tests**

Cover:
- valid text-only message accepted
- valid text + one image accepted
- blank text with no image rejected
- display name >40 rejected
- body >1000 rejected
- invalid UUID rejected
- blocked guest receives 403
- invalid MIME rejected
- image >5 MiB rejected
- second image field rejected
- rapid repeated posts receive 429

- [ ] **Step 2: Run and confirm failure**

Run: `deno test supabase/functions/chat-post/index.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement input validation and block check**

Normalize text by trimming surrounding whitespace, preserve ordinary punctuation/newlines, and render as text in the browser rather than HTML. Query `is_guest_blocked(guestId)` before any upload or insert.

- [ ] **Step 4: Implement basic rate limit**

Use recent `chat_messages` timestamps for the guest ID plus an IP-derived coarse limiter available from request headers where supported. Initial guest rule: no more than 5 accepted messages in 30 seconds and at least 2 seconds between accepted messages. Do not store raw IP addresses in the public message table.

- [ ] **Step 5: Implement safe image upload then message insert**

Generated path: `${guestId}/${crypto.randomUUID()}.${validatedExt}`. Upload first. If message insert fails, delete the newly uploaded object. Message insert stores generated path only.

- [ ] **Step 6: Run function tests**

Run: `deno test supabase/functions/chat-post/index.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/chat-post
git commit -m "feat: add validated guest chat posting"
```

### Task 5: Build public chat history, composer, and realtime updates

**Files:**
- Create: `js/chat.js`
- Create: `css/chat.css`
- Create: `tests/frontend/chat.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: guest identity helpers, image helper, Supabase client.
- Produces: `loadChatHistory()`
- Produces: `sendChatMessage()`
- Produces: `subscribeToChat()`

- [ ] **Step 1: Write failing frontend tests**

Verify:
- first visit asks for display name before composer is enabled
- text-only send builds correct request
- one image preview renders
- second image selection replaces/rejects rather than attaching two
- message text is rendered via `textContent`, not `innerHTML`
- realtime insert appends once
- duplicate realtime/history ID is deduplicated
- deleted row event removes message from public view
- disconnect shows reconnect status and manual refresh button

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/chat.test.js`

Expected: FAIL.

- [ ] **Step 3: Add Community section to site**

Add `Community` navigation and a branded section with:
- display-name setup/edit control
- recent-message feed
- text composer with 1000-character counter
- one photo picker/preview/remove button
- Send button
- connection status
- refresh/reconnect action

- [ ] **Step 4: Implement history and realtime**

Load the newest 50 non-deleted messages, display oldest-to-newest within the visible feed, and subscribe to inserts/updates for `chat_messages`. Keep a Set of message IDs to prevent duplicates.

- [ ] **Step 5: Implement send flow**

Disable Send during upload/post. On failure, preserve typed text and image selection and show retryable error. On success, clear composer only after server response.

- [ ] **Step 6: Run tests and mobile smoke test**

Run: `npm test -- tests/frontend/chat.test.js`

Expected: PASS. At ~360 px width the message feed, image preview, composer, and Send button remain usable.

- [ ] **Step 7: Commit**

```bash
git add index.html css/chat.css js/chat.js tests/frontend/chat.test.js
git commit -m "feat: add realtime guest community chat"
```

### Task 6: Implement protected moderation Edge Function

**Files:**
- Create: `supabase/functions/chat-moderate/index.ts`
- Create: `supabase/functions/chat-moderate/index.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` from `_shared/admin-auth.ts`
- Supported actions:
  - `{ action: 'delete-message', messageId }`
  - `{ action: 'remove-photo', messageId }`
  - `{ action: 'block-guest', guestId, reason }`
  - `{ action: 'unblock-guest', guestId }`

- [ ] **Step 1: Write failing moderation tests**

Cover:
- unauthenticated -> 401
- unapproved -> 403
- approved admin can soft-delete message
- deleting message removes attached storage object
- remove-photo clears `image_path` and deletes object while keeping text
- block-guest sets active block
- unblock-guest deactivates active blocks
- invalid action rejected

- [ ] **Step 2: Run and confirm failure**

Run: `deno test supabase/functions/chat-moderate/index.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement moderation actions**

`delete-message` sets `deleted_at=now()` rather than hard-deleting the database row. Any attached image object must be removed. `remove-photo` deletes object then sets `image_path=null`. Block/unblock operations must record or preserve who performed the action via admin ID where available.

- [ ] **Step 4: Run tests**

Run: `deno test supabase/functions/chat-moderate/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/chat-moderate
git commit -m "feat: add protected community moderation"
```

### Task 7: Add admin chat moderation UI

**Files:**
- Create: `js/admin-chat.js`
- Create: `tests/frontend/admin-chat.test.js`
- Modify: `js/admin-dashboard.js`
- Modify: `index.html`
- Modify: `css/chat.css`

**Interfaces:**
- Consumes approved admin auth state and `chat-moderate` Edge Function.
- Produces moderation list with message/photo/delete/block controls.

- [ ] **Step 1: Write failing admin chat tests**

Verify:
- approved admin sees moderation controls
- owner sees same moderation controls
- public/unapproved user does not
- Delete Message calls protected action
- Remove Photo calls protected action
- Block Guest includes optional reason
- Unblock Guest updates local view after success
- failed action preserves item and displays error

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/frontend/admin-chat.test.js`

Expected: FAIL.

- [ ] **Step 3: Implement moderation panel**

Show recent messages newest-first with display name, timestamp, text, thumbnail, guest ID shortened for moderator readability, and moderation controls. Add a separate active-blocks list with unblock actions.

- [ ] **Step 4: Run frontend and Deno tests**

```bash
npm test -- tests/frontend/admin-chat.test.js
deno test supabase/functions/chat-moderate/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/admin-chat.js js/admin-dashboard.js index.html css/chat.css tests/frontend/admin-chat.test.js
git commit -m "feat: add admin community moderation tools"
```

### Task 8: Chat integration and security regression pass

**Files:**
- Modify only files required by failing tests or verified defects.

**Interfaces:**
- Confirms guest posting, realtime, image cleanup, block enforcement, and admin moderation integrate correctly.

- [ ] **Step 1: Run full chat suite**

```bash
npm test
supabase test db supabase/tests/chat_policies.sql
deno test supabase/functions/chat-post/index.test.ts supabase/functions/chat-moderate/index.test.ts
```

Expected: PASS.

- [ ] **Step 2: Two-browser realtime acceptance test**

Browser A and Browser B use different guest IDs. A sends text; B receives it live. B sends text + one photo; A receives it live. Refresh both and verify history persists.

- [ ] **Step 3: Moderation acceptance test**

Admin deletes B's photo but leaves text. Both public clients update. Admin blocks B. B can still read but receives clear posting-disabled response. Admin unblocks B; B can post again.

- [ ] **Step 4: Abuse and cleanup test**

Verify oversized/invalid images are rejected, rapid spam reaches 429, failed message insert removes any newly uploaded object, and soft-deleted message media is not left publicly accessible.

- [ ] **Step 5: Responsive and accessibility check**

Verify phone/desktop layouts, keyboard focus, labels for photo controls, visible connection/error states, and text contrast against black background.

- [ ] **Step 6: Commit verified fixes**

```bash
git add index.html css/chat.css js tests supabase
git commit -m "fix: harden community chat integration"
```

## Community Chat Acceptance Gate

- Guest can choose a display name and post without an account.
- Text and one valid photo per message work.
- Recent history persists and realtime updates reach another client.
- Public message rendering cannot inject HTML.
- Blocked guests can read but cannot post.
- Approved admins can delete messages/photos and block/unblock guests.
- Public/unapproved users cannot perform moderation actions.
- Image validation, rate limits, and cleanup paths are tested.
- All frontend, database, and Deno tests pass.
