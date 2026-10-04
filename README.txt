SCENT — Stock Control with Earnings Notification Tracker for Maison Réve
PHASE 1: PUBLIC LANDING PAGE

Offline-first: no Google Fonts, CDN, external images, or online libraries.
Includes 50 local SVG perfume illustrations.

Features:
- Home landing page with Maison Réve branding and perfume-inspired design
- Eye-catching Top 5 most-selling section BEFORE the fragrance list
- 50 clickable fragrance product cards
- Search by name, family, category, and notes
- Sort/filter by Male, Female, Unisex, Preferred by Both, price, and stock
- Full product detail modal
- Visible stock remaining on every product
- No cart, checkout, customer order, or POS function
- About section inside the landing page; About navigation scrolls to it
- Owner contact section
- Hidden login: click the Maison Réve logo 5 times within about 2.2 seconds
- Demo login: admin / admin123

Next phase can connect the login to the Administrator/Staff system, Inventory, automatic Sales Analytics, Reports, and printing.


FIXES IN THIS VERSION:
- Fixed JavaScript function naming conflict that prevented products/top sellers from rendering.
- Five-click logo login trigger now initializes reliably and has a temporary click counter hint.
- Added footer copyright.
- Bottle logos are text-based and customizable through CSS variables in css/style.css.
- Added administrator email + password + OTP verification UI.
- Offline OTP is simulated locally because a real email OTP requires a backend/email service; the generated demo code is shown on-screen.


PHASE 3: ADMINISTRATOR DASHBOARD (dashboard.html)
- After OTP login: "Identity verified / Welcome back" transition, then the dashboard.
- Left sidebar with 4 tabs (Inventory, Stock Control, Sales Analytics, Accounts),
  user photo + username at the bottom-left with a Log out button above it.
- Inventory: product table (image, name, category, stock, price, availability:
  yellow = low, green = high, red = out of stock), search, Add Product panel,
  Edit, Delete / Delete Selected (both ask for confirmation).
- Stock Control: fragrance cards; click a card to deduct units (with total sum and
  confirmation). Every deduction is saved as a Transaction and appears in Sales Analytics.
- Sales Analytics: daily / weekly / annual / date-range income charts, total revenue,
  top 5 sellers, average order sum, total quantity sold, latest transactions.
  Print report as PDF, PNG or JPEG.
- Accounts: list of registered administrator accounts (no roles).
- Data is stored in the browser (localStorage) and shared with the landing page
  (stock levels and Top 5 update automatically). No server, CDN or online library needed.
- Demo login: admin@maisonreve.com / admin123 (OTP is shown on screen).


UPDATE: ACCOUNTS + UPLOAD FIX
- Fixed the stray "Choose File" button that overlapped "Upload image" in the product panel.
- Accounts tab: only the OWNER (admin@maisonreve.com) can add, edit or delete accounts.
  Other administrators see the list in view-only mode. The owner account cannot be deleted.
  Add/Edit uses a panel (name, username, email, password, optional photo); delete asks for confirmation.
- Demo logins (password admin123): admin@maisonreve.com (owner), isabelle@maisonreve.com (administrator, view-only accounts).
