# Screen Navigation, Home Story, and Admin Chat Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the long-scrolling site into one-screen-at-a-time hash navigation, make Donald Schafer’s approved story the Home screen with the site PayPal donation URL, and add live Community-admin search by display name or message text.

**Architecture:** Keep the existing single-page HTML and dynamic modules. Mark each top-level section as a screen, add a small hash router that toggles `hidden` and `aria-current`, and keep the shared header/navigation/footer outside the routed screens. Add a pure chat-filter helper so search behavior can be unit-tested independently of Supabase.

**Tech Stack:** Static HTML/CSS/JavaScript, Node 22 built-in test runner, GitHub Pages, existing Supabase modules.

**Spec:** `docs/superpowers/specs/2026-09-04-screen-navigation-home-story-design.md`

## Global Constraints

- Donald Schafer’s supplied story text must remain word-for-word unchanged except the final `gofund.me/812a256ad` reference is replaced by the site’s existing PayPal donation URL.
- Header, official logo, navigation, and footer remain shared on every screen.
- Only one main-content screen is visible at a time.
- Admin authentication and existing Shop, Hive Stories, Community, and Admin module entrypoints remain intact.
- Community-admin search matches only message text and display name.

---

### Task 1: Contract Tests

**Files:**
- Create: `tests/frontend/screen-navigation-chat-search.test.js`

**Interfaces:**
- Consumes: `index.html`, `js/screen-navigation.js`, `js/admin-chat-search.js`, `js/admin.js`.
- Produces: regression coverage for routed screens, approved Home copy/PayPal replacement, and name/text-only chat filtering.

- [ ] **Step 1: Write failing tests** that require the new screen markers/router and import a not-yet-existing `filterChatMessages` helper.
- [ ] **Step 2: Run `npm test`** and verify the new tests fail before implementation.
- [ ] **Step 3: Commit the failing tests.**

### Task 2: Screen Navigation and Home Story

**Files:**
- Modify: `index.html`
- Create: `js/screen-navigation.js`
- Create: `css/screen-navigation.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing section IDs and hash links.
- Produces: `data-site-screen` sections and a hash router that manages `hidden` and `aria-current="page"`.

- [ ] **Step 1: Add a dedicated `#home` screen** with the official logo and Donald’s approved story.
- [ ] **Step 2: Replace only the final fundraising URL** with the existing PayPal donation URL and ensure no `gofund` string remains in site markup.
- [ ] **Step 3: Mark every top-level destination with `data-site-screen`** and initially hide all except Home.
- [ ] **Step 4: Add the router** with direct-hash loading, Back/Forward handling, invalid-hash Home fallback, and active-nav `aria-current`.
- [ ] **Step 5: Add responsive Home/active-navigation styling** without changing the current visual identity.
- [ ] **Step 6: Add syntax checks for the new JavaScript files to `npm test`.**

### Task 3: Community Admin Search

**Files:**
- Create: `js/admin-chat-search.js`
- Modify: `js/admin.js`
- Modify: `css/admin-fix.css`

**Interfaces:**
- Produces: `filterChatMessages(messages, query)` returning messages whose `display_name` or `body` contains the case-insensitive query.
- Consumes: current 100-message Community moderation result set.

- [ ] **Step 1: Implement the pure filter helper** with blank-query passthrough and null-safe matching.
- [ ] **Step 2: Add `Search Community Chat` input** beneath the Recent Community Chat heading.
- [ ] **Step 3: Re-render the filtered message list live while preserving Delete, Remove Photo, Block Guest, and Unblock behavior.**
- [ ] **Step 4: Show `No matching messages.` when a non-empty query has no results.**
- [ ] **Step 5: Add admin search-field styling.**

### Task 4: Verification and Publish

**Files:**
- Verify all changed files.

**Interfaces:**
- Consumes: GitHub Actions `Test website` and `Deploy website to GitHub Pages` workflows.
- Produces: a passing tested deployment on the live GitHub Pages site.

- [ ] **Step 1: Run the full `npm test` workflow** and confirm zero failures.
- [ ] **Step 2: Confirm GitHub Pages deployment completes successfully.**
- [ ] **Step 3: Inspect the live site HTML/navigation behavior and verify Home, About Don, Schafer Brothers, Hive Stories, Mission, Shop, Community, Support, Contact, and Admin isolate correctly.**
- [ ] **Step 4: Confirm Home contains the PayPal donation URL and no GoFundMe reference.**
