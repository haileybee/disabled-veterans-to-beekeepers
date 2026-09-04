# Disabled Veterans to Beekeepers Multi-Page Navigation Design

## Goal
Convert the current single scrolling page into a true multi-page website while keeping the existing black-and-gold brand, content, Supabase-backed features, and GitHub Pages hosting intact.

## Approved Information Architecture

### Home (`index.html`)
The home screen contains the two pieces of information the user asked to keep together:
- About Don
- About the Mission

The home screen should feel like the introduction to the organization, not a directory of every feature. It may include compact calls to action that lead to the other screens, but the full versions of those sections live on their own pages.

### The Schafer Brothers (`schafer-brothers.html`)
Contains the existing newspaper/article gallery and the story about the five Schafer brothers, including the Wall of Honor information and the `Keeper of the Bees` inspiration currently attached to the service story.

### Hive Stories (`hive-stories.html`)
Contains the existing dynamic Hive Stories feed and continues loading data from the dedicated Disabled Veterans to Beekeepers Supabase project.

### Shop (`shop.html`)
Contains the existing product grid, cart, stock-aware storefront, and PayPal checkout integration. Existing JavaScript modules and backend behavior stay the same unless a path adjustment is required.

### Community (`community.html`)
Contains Community Chat only. It keeps the veterans site's own dedicated chat database, Realtime updates, display names, one-photo-per-message support, and moderation backend. It must never connect to MoMHQ.

### Support (`support.html`)
Contains the PayPal donation call to action and supporting copy explaining how donations help the mission.

### Contact (`contact.html`)
Contains the existing email, TikTok, Facebook, Michigan Upper Peninsula location copy, and logo.

### Admin (`admin.html`)
Contains the private owner/admin sign-in and management tools. It keeps existing Google/Supabase admin access behavior and is not linked as a prominent public call to action beyond the shared navigation.

## Navigation
Every page uses the same masthead, logo, black-and-gold styling, mobile menu, and footer.

Navigation labels:
- Home
- The Schafer Brothers
- Hive Stories
- Shop
- Community
- Support
- Contact
- Admin

`About Don` and `The Mission` are removed as separate navigation destinations because both live on Home.

Links use normal page URLs instead of section hashes. The current page should receive an active state for orientation. Mobile navigation should still collapse behind the existing hamburger button.

## Shared Assets and Scripts
Reuse the existing styles, logo loaders, image chunk loaders, Supabase client, auth, store, checkout, chat, admin, and Hive Stories modules rather than duplicating business logic.

Page-specific scripts should only be loaded where needed to avoid errors from missing DOM elements:
- Home: base site script only
- Schafer Brothers: base site script + article scan loader behavior
- Hive Stories: Supabase + Hive Stories module
- Shop: Supabase + store + checkout modules
- Community: Supabase + chat module
- Admin: Supabase + auth + admin + Hive admin modules
- Support/Contact: base site script only

If the existing `script.js` can safely no-op on missing elements, it may remain shared across pages.

## Visual Behavior
The site should feel like one cohesive website even though each section is now a separate screen. Preserve:
- existing masthead and official logo
- black background / gold accent system
- Oswald and Montserrat typography
- current button treatments
- responsive mobile behavior

Each interior page gets a clear page heading and enough top spacing that content does not feel jammed against the masthead.

## URLs and GitHub Pages
Use flat `.html` files in the repository root for reliable GitHub Pages behavior without introducing a build framework or router. This keeps deployment simple and avoids breaking the existing static hosting setup.

## Existing Feature Safety
The redesign must not alter backend ownership or data boundaries:
- Veterans Community Chat remains connected only to the dedicated veterans Supabase project.
- MoMHQ remains completely separate.
- Store/admin/Hive Stories continue using the veterans backend.
- Donation link remains the existing PayPal donation URL.

## Accessibility
Each page keeps semantic headings, alt text, keyboard-accessible navigation, visible focus states, and the mobile menu's `aria-expanded` behavior. Active navigation should be exposed visually without relying on color alone.

## Testing
Before merge:
1. Run existing Node syntax and contract tests.
2. Add navigation contract tests that assert all new page files exist and shared navigation points to page URLs rather than old section hashes.
3. Verify Home includes both About Don and Our Mission content.
4. Verify Community page loads the veterans chat module and dedicated Supabase config.
5. Verify Shop, Hive Stories, and Admin pages still load their required modules.
6. Run GitHub Actions on the feature branch/PR.
7. After merge, verify the GitHub Pages deployment succeeds and inspect the deployed page URLs.

## Non-Goals
- No redesign of backend tables or chat architecture.
- No MoMHQ changes.
- No new framework or SPA router.
- No change to PayPal credentials or checkout behavior beyond keeping existing functionality available on its new page.
