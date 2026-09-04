# Screen Navigation and Home Story Design

## Goal
Convert the current long-scrolling Disabled Veterans to Beekeepers website into an app-like single-page experience where the shared header, logo, and navigation remain visible while only one main content screen is shown at a time.

## Approved navigation model
Use the existing single-page website and section IDs rather than creating separate HTML files. Each top navigation item becomes a screen selector. The selected screen is the only main-content section visible.

Screens:
- Home
- About Don
- The Schafer Brothers
- Hive Stories
- The Mission
- Shop
- Community
- Support
- Contact
- Admin

The header, official logo, and navigation remain visible on every screen. The footer remains shared site chrome at the bottom.

## Routing behavior
- Keep hash URLs so existing links remain useful, for example `#about`, `#story`, and `#hive-stories`.
- Loading a deep link such as `#hive-stories` opens that screen directly.
- Clicking top navigation updates the visible screen and browser history.
- Browser Back and Forward switch between screens.
- Internal links such as Support CTAs also switch to their destination screen.
- The active top navigation item is visibly highlighted and receives `aria-current="page"`.
- Unknown or missing hashes fall back to Home.

## Screen isolation
Only the active main-content section is visible. All other main-content screens use the HTML `hidden` state so content from About Don, The Schafer Brothers, Hive Stories, Mission, Shop, Community, Support, Contact, and Admin never appears underneath the active screen.

The Admin screen keeps its existing authentication and role behavior. Hiding and showing the Admin screen must not clear the current authentication state.

## Home screen
Home is a dedicated main-content screen. It contains the official Disabled Veterans to Beekeepers logo followed by Donald Schafer's story.

Donald's text must remain word-for-word unchanged except for the final fundraising URL. The literal trailing `gofund.me/812a256ad` is replaced with the existing PayPal donation URL already used by the website. No GoFundMe wording, URL, button, or reference may remain anywhere on the Home screen.

### Home story copy

**Help Disabled Veterans Find Purpose Through Beekeeping**

Hello, my name is Donald Schafer, and I’m a disabled U.S. Veteran and proud owner of Schafer Farms.

I joined the military as a young man out of love for my country and a deep commitment to serve others. I was raised with the values of honor, courage, and commitment — and for my family, military service is a legacy. Serving during the Global War on Terrorism was not just my duty — it was my honor.

Unfortunately, my military career came to an unexpected end when I suffered a debilitating shoulder injury. I suddenly couldn’t do the only job I had ever known. Like many disabled veterans returning home, I struggled — physically, emotionally, and mentally.

I felt lost.
I felt alone.
I felt like my purpose was gone.

The physical limitations made me feel less than whole — not just as a soldier, but as a man, a husband, and a human being. The brothers and sisters I once leaned on weren’t there anymore. The battlefield had changed — now I was fighting for my mental health, and I was fighting it alone.

I battled PTSD, anxiety, depression, and worst of all — isolation.
At times, I had dark thoughts... that maybe life wasn’t worth living.

Sadly, my story isn’t unique. In 2022, veteran suicide rates reached 30.6 per 100,000 — a staggering number that reflects a deep crisis in our community.
But I believe we can do better.
And I believe I’ve found a way to help.

---

**Why Beekeeping?**

A few years ago, I started working with bees. What began as a hobby became healing.

The structure of the hive reminded me of the military — each bee with a role, each depending on the others. Beekeeping gave me a new mission, a renewed sense of purpose, and peace I hadn't felt in years. For the first time in a long time, I felt like I was part of something bigger again.

---

**The Mission: Disabled Veterans to Beekeepers**

I want to share this gift with other veterans who are struggling like I was.

My goal is to provide starter beehive kits and mentorship to help veterans find purpose, peace, and healing — while also helping rebuild the declining bee population. It's a win-win for our veterans and our planet.

Bees are vital to our ecosystem. Without them, we lose the fruits, vegetables, and plants that feed and sustain us. By helping bees, we help ourselves — and by helping veterans, we save lives.

---

**How You Can Help**

With your donation, you’ll be helping to:

Provide beekeeping starter kits for disabled veterans

Offer training and support

Support mental health recovery through meaningful work

Help protect the environment and bee populations

This isn’t just a fundraiser — it’s a movement. A mission. A chance to give veterans their purpose back and help the earth heal in the process.

Please stand with me.
Let’s become a well-oiled machine again — just like the hive.

Thank you for your support.
— Donald Schafer
Disabled Veteran | Beekeeper | Founder, Disabled Veterans to Beekeepers

The final link is the site's existing PayPal donation URL:
`https://www.paypal.com/donate/?business=E6Y3STY5WYUGU&no_recurring=0&item_name=Support+Disabled+Veterans+finding+new+paths+with+beekeeping+education%2C+resources%2C+and+freedom%21&currency_code=USD`

## Existing content placement
- About Don screen: only the current About Don content.
- The Schafer Brothers screen: only the current newspaper/story content.
- Hive Stories screen: only the current dynamic Hive Stories content.
- The Mission screen: only the current mission cards.
- Shop screen: only store products and cart.
- Community screen: only Community Chat.
- Support screen: only support/donation content.
- Contact screen: only contact information and social links.
- Admin screen: only the discreet login or authenticated management dashboard.

## Styling
- Preserve the current visual identity, fonts, official logo, bee graphics, and overall color palette.
- Add a Home-story layout that is readable on mobile and desktop with comfortable line length and section spacing.
- The Home logo should be prominent but not blurry or stretched.
- Active navigation uses the existing palette rather than introducing a new theme.
- Screen transitions should be immediate or use only a subtle fade, with no vertical jump through hidden sections.

## Accessibility and resilience
- Use semantic sections and headings.
- Keep hidden screens out of the accessibility tree through the `hidden` attribute.
- Set `aria-current="page"` on the active navigation link.
- Preserve the mobile menu behavior.
- If JavaScript receives an invalid hash, show Home rather than leaving a blank page.
- Existing dynamic modules for Hive Stories, Shop, Community, and Admin must continue to initialize normally even when their screen starts hidden.

## Verification requirements
Automated contract tests must cover:
1. A dedicated Home main-content screen exists.
2. Home contains Donald's approved story wording.
3. The GoFundMe URL and the string `gofund` are absent from Home/site markup used for the new screen.
4. The existing PayPal donation URL is present on Home.
5. Each top-level destination is marked as a screen and only one can be active.
6. Navigation logic supports direct hashes and Back/Forward.
7. The active navigation link receives `aria-current="page"`.
8. Existing Admin authentication module entrypoints remain present.
9. Existing Hive Stories, Store, and Community module entrypoints remain present.

Manual verification must confirm desktop and mobile navigation switch screens without exposing content from adjacent screens.
