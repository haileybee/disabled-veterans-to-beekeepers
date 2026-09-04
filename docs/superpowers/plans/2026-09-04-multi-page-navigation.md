# Multi-Page Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Disabled Veterans to Beekeepers from one long scrolling page into a true multi-page GitHub Pages site, with About Don and Our Mission together on Home and every other major section on its own screen.

**Architecture:** Keep the site as framework-free static HTML. Add flat root-level `.html` pages that share the existing masthead/footer styling and reuse the current JavaScript modules only on pages where their DOM exists. Preserve the dedicated veterans Supabase project and all backend behavior unchanged.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2, GitHub Pages, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-04-multi-page-navigation-design.md`

## Global Constraints

- Home contains About Don and Our Mission.
- Separate pages: `schafer-brothers.html`, `hive-stories.html`, `shop.html`, `community.html`, `support.html`, `contact.html`, `admin.html`.
- Navigation labels: Home, The Schafer Brothers, Hive Stories, Shop, Community, Support, Contact, Admin.
- `About Don` and `The Mission` are not separate navigation destinations.
- Use normal page URLs, not section hashes, for primary navigation.
- Current page receives a visible and semantic active state.
- Reuse existing black/gold visual system, logo, Oswald/Montserrat typography, buttons, responsive masthead, and footer.
- Veterans Community Chat remains connected only to dedicated veterans Supabase project `qnwhxcbjukzzrjoykpau`.
- Do not modify MoMHQ.
- Do not redesign database tables, PayPal behavior, or authentication architecture.
- Keep mobile menu `aria-expanded` behavior and keyboard-accessible links.

---

### Task 1: Add failing multi-page navigation contract tests

**Files:**
- Create: `tests/frontend/multi-page-navigation.test.js`
- Modify: `tests/frontend/site-contract.test.js`

**Interfaces:**
- Consumes: existing static files and Node `fs` assertions.
- Produces: test contract requiring the eight page files and correct per-page module wiring.

- [ ] **Step 1: Write the failing page-existence and navigation test**

Create `tests/frontend/multi-page-navigation.test.js` with assertions equivalent to:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const pages = [
  'index.html', 'schafer-brothers.html', 'hive-stories.html', 'shop.html',
  'community.html', 'support.html', 'contact.html', 'admin.html'
];
const navTargets = [
  'index.html', 'schafer-brothers.html', 'hive-stories.html', 'shop.html',
  'community.html', 'support.html', 'contact.html', 'admin.html'
];

for (const page of pages) {
  test(`${page} has shared page navigation`, () => {
    assert.equal(fs.existsSync(new URL(page, root)), true);
    const html = fs.readFileSync(new URL(page, root), 'utf8');
    for (const href of navTargets) assert.match(html, new RegExp(`href=["']${href.replace('.', '\\.')}`));
    assert.doesNotMatch(html, /href=["']#(?:about|story|hive-stories|mission|shop|community|support|contact|admin)/);
  });
}
```

Add explicit Home assertions:

```js
test('home contains About Don and Our Mission only as home content', () => {
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /About Don/);
  assert.match(html, /Our Mission/);
  assert.doesNotMatch(html, /id="community"/);
  assert.doesNotMatch(html, /id="shop"/);
  assert.doesNotMatch(html, /id="admin"/);
});
```

Add page/module assertions:

```js
test('feature pages load only their required feature modules', () => {
  const community = fs.readFileSync(new URL('community.html', root), 'utf8');
  const shop = fs.readFileSync(new URL('shop.html', root), 'utf8');
  const hive = fs.readFileSync(new URL('hive-stories.html', root), 'utf8');
  const admin = fs.readFileSync(new URL('admin.html', root), 'utf8');
  assert.match(community, /js\/chat\.js/);
  assert.match(shop, /js\/store\.js/);
  assert.match(shop, /js\/checkout\.js/);
  assert.match(hive, /js\/hive-stories\.js/);
  assert.match(admin, /js\/auth\.js/);
  assert.match(admin, /js\/admin\.js/);
  assert.match(admin, /js\/hive-admin\.js/);
});
```

- [ ] **Step 2: Update the old single-page contract test**

Replace the assertion that `index.html` contains Shop/Community/Admin with assertions that their destination pages contain their required elements and that `site-config.js` still uses `qnwhxcbjukzzrjoykpau` and never `zljduaahbyxnuglbugar`.

- [ ] **Step 3: Run tests and verify the new contract fails**

Run:

```bash
npm test
```

Expected: FAIL because the new `.html` page files do not exist yet and `index.html` still contains the old section-hash navigation.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/frontend/multi-page-navigation.test.js tests/frontend/site-contract.test.js
git commit -m "test: define multi-page site contract"
```

---

### Task 2: Build Home and shared page shell

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `script.js`

**Interfaces:**
- Consumes: current masthead, official logo loader, Don photo loader, footer, black/gold styles.
- Produces: canonical shared nav markup and Home page containing only About Don + Our Mission primary content.

- [ ] **Step 1: Replace primary navigation URLs in `index.html`**

Use exactly these links in this order:

```html
<nav class="site-nav" aria-label="Main navigation">
  <a href="index.html" aria-current="page">Home</a>
  <a href="schafer-brothers.html">The Schafer Brothers</a>
  <a href="hive-stories.html">Hive Stories</a>
  <a href="shop.html">Shop</a>
  <a href="community.html">Community</a>
  <a href="support.html">Support</a>
  <a href="contact.html">Contact</a>
  <a href="admin.html">Admin</a>
</nav>
```

- [ ] **Step 2: Reduce Home content to About Don + Mission**

Keep the current About Don section, including Don's photo and external story link. Keep the current four mission cards (Empower, Educate, Heal, Build Community). Remove the full Schafer Brothers gallery, Hive Stories, Shop, Community Chat, Support, Admin, and Contact sections from `index.html`.

Add a compact Home CTA row after the Mission section:

```html
<div class="home-next-actions" aria-label="Explore Disabled Veterans to Beekeepers">
  <a class="gold-cta compact" href="community.html">Join the Community</a>
  <a class="outline-button" href="support.html">Support the Mission</a>
</div>
```

- [ ] **Step 3: Add shared interior/active-navigation styles**

Append focused styles to `styles.css`:

```css
.site-nav a[aria-current="page"] { text-decoration: underline; text-underline-offset: .45rem; font-weight: 700; }
.page-main { min-height: 65vh; }
.page-hero { padding: clamp(3rem, 8vw, 6rem) 1.25rem 2rem; text-align: center; }
.page-hero .section-inner { max-width: 900px; margin: 0 auto; }
.home-next-actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; padding: 1rem 1.25rem 4rem; }
@media (max-width: 720px) { .home-next-actions > * { width: 100%; text-align: center; } }
```

- [ ] **Step 4: Make shared logo link point to Home page**

Use `href="index.html"` instead of `href="#home"`. Keep mobile menu behavior in `script.js`; existing null checks stay intact.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: still FAIL only on missing interior pages.

- [ ] **Step 6: Commit Home shell**

```bash
git add index.html styles.css script.js
git commit -m "feat: make home the Don and mission screen"
```

---

### Task 3: Create the seven interior screens

**Files:**
- Create: `schafer-brothers.html`
- Create: `hive-stories.html`
- Create: `shop.html`
- Create: `community.html`
- Create: `support.html`
- Create: `contact.html`
- Create: `admin.html`

**Interfaces:**
- Consumes: existing section markup from pre-split `index.html`, shared CSS files, `script.js`, dedicated `site-config.js`, Supabase modules.
- Produces: one URL per major section, each with its own `aria-current="page"` nav link.

- [ ] **Step 1: Create `schafer-brothers.html`**

Use the shared `<head>`, masthead, footer, fonts, and stylesheets. Mark The Schafer Brothers nav link active. Place the current newspaper gallery and service-story copy inside `<main class="page-main">`. Load `script.js` so `loadArticleScans()` reconstructs all three article scans. Change the story CTA from `href="#support"` to `href="support.html"`.

- [ ] **Step 2: Create `hive-stories.html`**

Include the shared shell and the current `#hive-stories-grid` section. Load:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="site-config.js?v=52"></script>
<script src="script.js?v=52"></script>
<script type="module" src="js/hive-stories.js?v=52"></script>
```

Do not load store/chat/admin modules.

- [ ] **Step 3: Create `shop.html`**

Include the current `#store-products`, `#cart-count`, and `#store-cart` DOM structure. Load Supabase, `site-config.js`, shared `script.js`, `js/store.js`, and `js/checkout.js`. Mark Shop active.

- [ ] **Step 4: Create `community.html`**

Include the current Community Chat markup exactly once, including `#community-messages`, `#community-form`, display name, one image file input, message textarea, submit button, and `#community-status`. Load Supabase, `site-config.js`, shared `script.js`, and `js/chat.js` only. Mark Community active.

- [ ] **Step 5: Create `support.html`**

Move the existing PayPal donation CTA to this screen. Preserve the exact donation business ID `E6Y3STY5WYUGU`, item name, USD currency, `target="_blank"`, and `rel="noopener noreferrer"`. Change Get Involved to `href="contact.html"`.

- [ ] **Step 6: Create `contact.html`**

Move the existing logo, Upper Peninsula copy, email button, TikTok button, and Facebook button to this screen. Load only shared `script.js`.

- [ ] **Step 7: Create `admin.html`**

Include the current `#admin-gate` and `#hive-admin-tools` DOM. Load Supabase, `site-config.js`, shared `script.js`, then:

```html
<script type="module" src="js/auth.js?v=52"></script>
<script type="module" src="js/admin.js?v=52"></script>
<script type="module" src="js/hive-admin.js?v=52"></script>
```

Mark Admin active. Do not load public chat/store modules.

- [ ] **Step 8: Run all contract tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit interior pages**

```bash
git add schafer-brothers.html hive-stories.html shop.html community.html support.html contact.html admin.html
git commit -m "feat: split veterans site into separate screens"
```

---

### Task 4: Verify URLs, module boundaries, and deployment readiness

**Files:**
- Modify only if test failures require it: `script.js`, `js/*.js`, `tests/frontend/*.test.js`

**Interfaces:**
- Consumes: all pages from Tasks 2-3.
- Produces: green branch suitable for PR/merge to GitHub Pages.

- [ ] **Step 1: Run syntax checks and contracts on exact branch head**

```bash
npm test
```

Expected: all tests PASS and all listed JavaScript files pass `node --check` via the package script.

- [ ] **Step 2: Verify dedicated backend boundary in committed config**

Check `site-config.js` contains:

```js
SUPABASE_URL: 'https://qnwhxcbjukzzrjoykpau.supabase.co'
```

and does not contain `zljduaahbyxnuglbugar`.

- [ ] **Step 3: Verify feature-page DOM IDs expected by modules**

Confirm:

```text
community.html: community-messages, community-form, community-status
shop.html: store-products, store-cart, cart-count
hive-stories.html: hive-stories-grid
admin.html: admin-gate, hive-admin-tools
```

- [ ] **Step 4: Open a pull request from `feat/multi-page-navigation` to `main`**

PR summary must state that this is a static page split only, keeps veterans Supabase unchanged, and makes no MoMHQ changes.

- [ ] **Step 5: Wait for GitHub Actions and require green test status**

Expected: `Veterans Site Tests` concludes `success` on the PR head.

- [ ] **Step 6: Merge only after green checks**

Use merge commit or repository-standard method. Do not force-update `main` if it has moved; merge the branch so concurrent website changes are retained.

- [ ] **Step 7: Verify GitHub Pages deployment**

Confirm the Pages workflow for the merged `main` commit concludes `success`.

- [ ] **Step 8: Verify deployed page routes**

Confirm these routes deploy without 404:

```text
/index.html
/schafer-brothers.html
/hive-stories.html
/shop.html
/community.html
/support.html
/contact.html
/admin.html
```

Expected: each screen renders the shared masthead/footer, its active navigation state, and only its intended main content.
