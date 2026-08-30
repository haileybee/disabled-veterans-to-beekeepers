# Disabled Veterans to Beekeepers: Community Chat + Store Design

Date: 2026-08-29

## Goal

Expand the existing static GitHub Pages website into a small community and commerce site without changing its black-and-gold visual identity. The new system adds:

1. A public guest Community Chat with text and one photo per message.
2. A public storefront with real PayPal checkout.
3. A private Google Sign-In admin dashboard.
4. An approved-email access list controlled by one main owner account.
5. Admin moderation tools for the Community Chat.

The current public site remains the primary frontend. Backend services are added behind it rather than replacing the site.

## Chosen Architecture

### Frontend
- Existing GitHub Pages site: HTML, CSS, JavaScript.
- Preserve the current black, gold, veteran, and bee visual design.
- Add separate JavaScript modules for auth, chat, store/cart, admin, and PayPal checkout instead of continuing to grow one large script.

### Backend
- Supabase database for products, orders, chat messages, admin permissions, moderation state, and site settings.
- Supabase Realtime for new chat messages.
- Supabase Storage for product images and community-chat photos.
- Supabase Auth with Google as the only admin sign-in provider.
- Supabase Edge Functions for trusted server-side operations such as PayPal order creation, PayPal payment verification, and protected owner-only administration actions.

### Payments
- PayPal Checkout only.
- Prices are always validated server-side before a PayPal order is created.
- A PayPal webhook is used as the trusted source of payment completion.

## Roles and Permissions

### Public visitor
Can:
- browse the public website
- browse the store
- add products to cart
- pay through PayPal
- enter a display name for Community Chat
- send text messages
- attach up to one photo to a chat message
- read chat history

Cannot:
- access admin screens
- edit products
- alter prices or stock
- delete other users' messages
- manage approved admins

### Approved admin
Signs in with Google. Access is granted only when the verified Google email exists in the approved admin list.

Can:
- create products
- upload product images
- set and edit prices
- set and edit stock quantities
- mark products active or sold out
- edit or remove products
- view orders
- update order fulfillment status
- delete inappropriate chat messages or photos
- block abusive guest identities from posting

Cannot:
- add or remove approved admins
- promote themselves to owner

### Main owner
The main owner has all approved-admin capabilities plus:
- add approved admin emails
- remove approved admin emails
- change admin roles

Owner status is enforced in the backend, not by frontend code.

## Owner Bootstrap and Admin Approval

The first owner account is established during backend setup using the owner's verified Google email. After that, the owner manages the approved-email list from the private dashboard.

Admin access flow:
1. User clicks Admin Sign In.
2. Google completes authentication.
3. Supabase returns a verified identity.
4. Backend checks the normalized email against the admins table.
5. If the email is approved and active, the dashboard loads with the user's role.
6. If the email is not approved, the session may remain authenticated with Google, but admin data and admin actions remain inaccessible.

No admin authority is granted from localStorage, URL parameters, or client-side flags.

## Community Chat

### Guest identity
Community members do not create accounts.

The browser receives a random guest ID saved locally. The visitor chooses a display name. The display name and guest ID are associated with each message. The guest ID is not presented publicly but is available to moderation logic.

This makes the chat low-friction while still giving moderators a stable identity to block on that device.

### Message format
Each message supports:
- display name
- text body
- optional one photo
- timestamp
- moderation state
- guest ID

The UI displays newest messages live through Supabase Realtime and loads recent history when the chat opens.

### Photos
- Maximum: one photo per message.
- Accept image formats suitable for browsers, including JPEG, PNG, and WebP.
- Upload size is capped to prevent oversized files.
- The browser compresses large images before upload when practical.
- Storage paths use generated IDs rather than user-provided filenames.
- Removing a moderated message also removes or disables access to its attached photo.

### Moderation
Approved admins can:
- delete a message
- remove a message's photo
- block a guest ID
- unblock a guest ID

Blocked guests can still read public content but cannot send new chat messages from that guest identity.

Moderation actions are protected by backend authorization. The public browser cannot call privileged delete or block operations successfully without an approved admin session.

### Abuse controls
Initial release includes:
- maximum message length
- upload type and size checks
- basic posting rate limits
- blocked guest enforcement
- server-side sanitization/validation of text input

## Storefront

### Public product cards
Each product can contain:
- name
- description
- price
- stock quantity
- primary image
- active/sold-out status
- created and updated timestamps

The first release uses one primary product image per product. The database can be extended later for image galleries without changing the basic product model.

### Cart
The cart is stored in the visitor's browser for convenience.

The browser may display current prices, but browser values are never trusted when payment begins.

Before checkout, the backend reloads the selected product records and computes the authoritative order total.

### Stock behavior
- Products with zero stock display as sold out and cannot be added to checkout.
- The backend rechecks stock while creating the PayPal order.
- Stock is reduced only after confirmed successful payment.
- The payment-completion handler is designed to be idempotent so duplicate PayPal webhook delivery does not reduce stock twice.

## PayPal Checkout Flow

1. Customer adds items to cart.
2. Customer presses PayPal Checkout.
3. Frontend sends product IDs and quantities to a Supabase Edge Function.
4. Edge Function loads live product prices and stock from Supabase.
5. Invalid, inactive, or unavailable items are rejected.
6. Edge Function calculates the real total.
7. Edge Function creates a PayPal order using server-side credentials.
8. Customer approves payment in PayPal.
9. PayPal completion/webhook is verified server-side.
10. A paid order is saved or finalized in Supabase.
11. Stock is reduced exactly once.
12. Customer receives an on-site order confirmation.

PayPal secrets are never stored in GitHub Pages JavaScript.

## Orders

Order records include:
- internal order ID
- PayPal order/capture identifiers
- customer contact/shipping data returned through the approved payment flow when available
- subtotal/total
- payment status
- fulfillment status
- order date

Order item records snapshot:
- product ID
- product name at time of sale
- unit price at time of sale
- quantity

Snapshotting protects order history from later product edits.

Initial fulfillment statuses:
- New
- Processing
- Shipped
- Completed
- Cancelled

Automated refund tooling is not part of the first release. Refunds can be handled in PayPal and later synchronized if needed.

## Admin Store Dashboard

Approved admins see a private dashboard after Google authentication and backend permission checks.

### Products
Admins can:
- add a product
- upload/change its image
- set name and description
- set price
- set inventory quantity
- activate/deactivate product
- edit product
- delete/archive product

### Orders
Admins can:
- view newest orders first
- open order details
- see payment state
- update fulfillment status

### Community moderation
Admins can:
- view chat messages with moderation controls
- delete messages/photos
- block/unblock guest identities

### Owner-only admin management
Only the main owner sees the Admin Access section.

The owner can:
- enter a Google account email
- approve it as an admin
- remove an approved admin
- view current admins and roles

The backend rejects these operations from non-owner admins even if somebody manually exposes the frontend controls.

## Proposed Data Model

### admins
- id
- email
- role: owner | admin
- active
- created_at

### products
- id
- name
- description
- price_minor_units
- currency
- stock_quantity
- image_path
- active
- created_at
- updated_at

Money is stored as integer minor units rather than floating-point values.

### orders
- id
- paypal_order_id
- paypal_capture_id
- payment_status
- fulfillment_status
- total_minor_units
- currency
- customer_email
- shipping_json
- created_at
- updated_at

### order_items
- id
- order_id
- product_id
- product_name_snapshot
- unit_price_minor_units
- quantity

### chat_messages
- id
- guest_id
- display_name
- body
- image_path
- created_at
- deleted_at

### chat_blocks
- id
- guest_id
- reason
- blocked_by_admin_id
- active
- created_at

### site_settings
Used only for small owner-managed settings that do not justify separate tables.

## Supabase Security

Row Level Security is enabled for all application tables.

Public policies allow only the minimum required actions, for example:
- reading active products
- reading non-deleted chat messages
- submitting validated guest chat messages through the intended path

Admin writes require an authenticated Google user whose email is present and active in the admins table.

Owner-only changes additionally require role = owner.

Highly sensitive operations such as PayPal order creation, payment verification, and owner-level admin management run through Edge Functions using server-side credentials and explicit authorization checks.

## Storage Buckets

### product-images
- public readable product assets
- admin upload/delete only

### chat-images
- readable for public chat display
- tightly validated upload path
- admins can remove moderated media

Uploads validate content type and maximum file size. User filenames are not trusted as storage object keys.

## Frontend Structure

Suggested structure:

- `index.html` existing site plus navigation entries/containers for Shop and Community
- `styles.css` existing global design
- `chat.css` chat-specific layout if needed
- `store.css` store/cart/admin components if needed
- `js/supabase.js` client initialization
- `js/auth.js` Google admin sign-in and role state
- `js/chat.js` guest identity, message loading, realtime, photo posting
- `js/store.js` product catalog and cart
- `js/checkout.js` PayPal checkout integration
- `js/admin.js` product/order/moderation/admin management UI

Exact file splitting may be adjusted during implementation to keep modules focused and avoid duplicated state.

## Visual Design

New interfaces should feel native to the existing site:
- black backgrounds
- gold borders and actions
- existing typography wherever practical
- official bee icon rather than bee emoji decorations
- responsive mobile-first behavior for chat, cart, product cards, and admin screens

The admin area may use denser layouts for usability but should retain the same visual brand.

## Error Handling

### Chat
- Failed image uploads do not create half-finished messages.
- Failed message sends display a retryable error.
- Realtime disconnects fall back to manual refresh/reconnect behavior.
- Blocked users receive a clear posting-disabled message.

### Store
- Price or stock changes detected at checkout are shown to the customer before payment continues.
- Payment cancellation returns the customer to the cart without creating a paid order.
- Payment verification failures do not decrement stock.
- Duplicate payment callbacks are safe.

### Admin
- Unauthorized users see an access-denied screen rather than partially rendered tools.
- Failed product/order/admin changes preserve the form state and show an error.

## Testing Strategy

### Authentication and permissions
- unapproved Google account cannot access admin data/actions
- approved admin can manage store/orders/chat
- approved admin cannot change admin list
- owner can add/remove approved admins
- removed admin immediately loses privileged access on subsequent protected operations

### Chat
- guest can set display name and send text
- guest can attach one valid image
- second image is rejected by UI
- invalid/oversized upload is rejected
- realtime message appears to another client
- admin can delete message and image
- admin can block and unblock guest ID
- blocked guest cannot post

### Store
- active in-stock products display
- sold-out items cannot be purchased
- cart quantity behavior is correct
- server price overrides manipulated browser price
- server stock overrides manipulated browser state

### PayPal
- successful sandbox transaction creates/finalizes one paid order
- cancelled transaction does not reduce inventory
- duplicate webhook does not duplicate order or reduce stock twice
- invalid webhook/capture data is rejected

### Responsive UI
- phone-sized chat and store views remain usable
- cart checkout is usable on mobile
- owner dashboard remains usable on phone and desktop

## Build Order

1. Supabase project schema, RLS policies, storage, and Edge Function foundation.
2. Google admin authentication and owner/admin authorization.
3. Admin product management and public storefront.
4. Cart and PayPal sandbox checkout with verified webhook handling.
5. Orders dashboard and stock synchronization.
6. Guest Community Chat text flow and realtime updates.
7. One-photo-per-message uploads.
8. Admin chat moderation and guest blocking.
9. Responsive styling, security pass, integration tests, and production PayPal configuration.

## Initial Release Boundaries

Included:
- guest community chat
- one photo per chat message
- Google-only approved admin login
- owner-managed approved-email list
- product CRUD
- inventory
- PayPal checkout
- order records
- chat moderation

Deferred unless requested later:
- customer accounts
- private/direct messages
- reactions/likes
- product reviews
- coupons
- automated tax engine
- automated refunds
- multiple product images/gallery
- advanced shipping-rate integrations
- email marketing

These boundaries keep the first production version focused while leaving clean extension points for later features.
