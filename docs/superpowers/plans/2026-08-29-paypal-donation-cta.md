# PayPal Donation CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the website's public Support/Donate calls-to-action to the supplied PayPal donation page while keeping product purchases on the separate PayPal store checkout flow.

**Architecture:** This is a frontend-only CTA change. The supplied PayPal donation URL opens PayPal directly in a new tab with safe link attributes. It does not replace or share logic with the store's PayPal Orders v2 checkout.

**Tech Stack:** Existing HTML/CSS/JavaScript GitHub Pages site.

**Spec:** `docs/superpowers/specs/2026-08-29-community-chat-store-design.md`

## Global Constraints

- Donation URL: `https://www.paypal.com/donate/?business=E6Y3STY5WYUGU&no_recurring=0&item_name=Support+Disabled+Veterans+finding+new+paths+with+beekeeping+education%2C+resources%2C+and+freedom%21&currency_code=USD`
- Donation links must open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Keep donation CTAs visually consistent with the existing black-and-gold site and official bee icon.
- Do not route product purchases through the donation URL.
- Do not change the donation amount in the website; PayPal controls the donor amount on its page.

---

### Task 1: Wire public Support CTAs to PayPal Donate

**Files:**
- Modify: `index.html`
- Test: `tests/frontend/donation-link.test.js`

**Interfaces:**
- Produces public links with class/data hook `data-paypal-donate`.

- [ ] **Step 1: Write the failing link test**

```js
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

describe('PayPal donation CTA', () => {
  it('uses the supplied PayPal Donate URL safely', () => {
    expect(html).toContain('https://www.paypal.com/donate/?business=E6Y3STY5WYUGU');
    expect(html).toContain('data-paypal-donate');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- tests/frontend/donation-link.test.js`

Expected: FAIL because the donation URL is not yet wired into `index.html`.

- [ ] **Step 3: Update donation-facing calls-to-action**

The Support section's primary donation button should link directly to the supplied PayPal Donate URL and include `data-paypal-donate`. Keep `Get Involved`/contact navigation separate if it serves a non-donation purpose. Where copy says `Donate` or `Support Veteran Beekeepers` and the action clearly means giving money, use the PayPal donation URL.

Example markup:

```html
<a class="gold-cta" data-paypal-donate
   href="https://www.paypal.com/donate/?business=E6Y3STY5WYUGU&amp;no_recurring=0&amp;item_name=Support+Disabled+Veterans+finding+new+paths+with+beekeeping+education%2C+resources%2C+and+freedom%21&amp;currency_code=USD"
   target="_blank" rel="noopener noreferrer">
  <img class="bee-mark bee-button-mark" src="assets/bee-mark.svg?v=41" alt="" aria-hidden="true">
  Donate With PayPal
</a>
```

- [ ] **Step 4: Run test and click-through smoke test**

Run: `npm test -- tests/frontend/donation-link.test.js`

Expected: PASS. In a browser, clicking the CTA opens the PayPal Donate page in a new tab while the veterans site remains open.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/frontend/donation-link.test.js
git commit -m "feat: connect support CTA to PayPal donations"
```

## Donation CTA Acceptance Gate

- Supplied PayPal Donate URL is preserved exactly in meaning and parameters.
- Donation opens safely in a new tab.
- Product checkout remains separate.
- Existing contact and public-site navigation continue to work.
