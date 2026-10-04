# Maison Réve — SCENT: Backend Setup Guide

This guide is for the backend programmer connecting a real database and server to the SCENT front-end (landing page + administrator dashboard).

The built-in browser database (`localStorage`, seed data, demo accounts) has been **removed**. The front-end now talks to one object, `Store`, defined in `js/api.js`. Your job is to make that object read and write real data. Nothing else in the UI needs to change, apart from the async note in section 5.

---

## 1. Project structure

```
index.html          Public landing page (+ hidden admin login panel, opened by 5 clicks on the logo)
login.html          Redirects to index.html#login
dashboard.html      Administrator dashboard (Inventory, Stock Control, Sales Analytics, Accounts)
css/style.css       Landing page styles
css/dashboard.css   Dashboard styles
css/login.css       Legacy standalone login styles (not used by index.html)
js/api.js           >>> BACKEND HOOK: the only file you must implement <<<
js/app.js           Landing page logic (products, carousel, login panel, OTP)
js/dashboard.js     Dashboard logic (inventory, cart/checkout, receipts, analytics, void order, accounts)
assets/             logo.png and products/product-01.png … product-50.png (not included in this package)
```

Script order matters: both HTML pages load `js/api.js` **before** their own script.

---

## 2. What you need to implement

Every method below lives in `js/api.js` and is currently an empty placeholder.

| Method | Used by | Must do |
|---|---|---|
| `getProducts()` | landing, dashboard | Return all products (array). |
| `saveProducts(list)` | dashboard | Persist product changes. Return `true` on success, `false` on failure. |
| `getTransactions()` | dashboard | Return all transaction rows, including voided ones. |
| `addTransaction(t)` | dashboard (checkout) | Save one row; return it with its server-assigned `id`. |
| `saveTransactions(list)` | dashboard (void order) | Persist updated rows (voided flags). Return `true`/`false`. |
| `getAccounts()` | dashboard | Return administrator accounts. |
| `saveAccounts(list)` | dashboard | Persist account create/edit/delete. Return `true`/`false`. |
| `accountByEmail(email)` | landing (Send OTP), dashboard (session check) | Return the account or `null`. |
| `findAccount(email, password)` | landing (login) | Return the account if credentials are valid, else `null`. |
| `touchLogin(email)` | landing (after login) | Record the last-login time. |

Constants and helpers already in `api.js` (`LOW_STOCK`, `families`, `categories`, `availability`) are UI values, not database data. Keep them, or load them from the server if you want them configurable.

---

## 3. Data models

All money values are **whole pesos (integers)**. All timestamps (`ts`, `lastLogin`, `voidedAt`) are **Unix milliseconds**.

### Product
```json
{
  "id": 1, "name": "Éclat", "category": "Female", "family": "Floral",
  "size": "50 ml", "price": 1899, "stock": 12, "sold": 40,
  "notes": "bergamot, white jasmine, vanilla",
  "description": "A refined fragrance…",
  "image": "data:image/jpeg;base64,… (optional)", "createdAt": 1767225600000
}
```
- `category` is one of: `Female`, `Male`, `Unisex`, `Preferred by Both`.
- `family` is one of: Floral, Woody, Fresh, Oriental, Citrus, Fruity, Powdery, Amber, Musk, Aromatic.
- **Images:** if `image` is empty, the UI falls back to `assets/products/product-NN.png` (ids 1–50) or `assets/logo.png`. The dashboard currently uploads images as base64 JPEG data URLs (max 600 px). For production, store the file on disk or object storage and return a URL in `image`.

### Transaction row (one row per product line of an order)
```json
{
  "id": 101, "orderId": "MR-20261004-153045-42",
  "pid": 7, "name": "Santal", "qty": 2, "unitPrice": 2100, "total": 4200,
  "ts": 1790000000000, "by": "admin", "customer": "Walk-in customer",
  "voided": false, "voidReason": null, "voidNote": null,
  "voidedAt": null, "voidedBy": null, "restocked": null
}
```
- Rows that share the same `orderId` belong to one purchase. Older rows without an `orderId` are treated as single-line orders (`TXN-00001`).
- **Revenue must never include rows where `voided` is true.** The dashboard already filters them out.

### Account
```json
{
  "id": 1, "name": "Maison Réve Administrator", "username": "admin",
  "email": "admin@maisonreve.com", "registered": "2025-01-15",
  "lastLogin": 1790000000000, "status": "Active", "owner": true, "photo": "(optional)"
}
```
- **Never send password hashes to the browser.** The old demo code stored plain-text passwords in the account object. Do not keep that.
- Only the account with `owner: true` may create, edit, or delete accounts. The UI hides those buttons for others, but you **must enforce this on the server**.

---

## 4. Suggested database schema (PostgreSQL syntax; adapt for MySQL/SQL Server)

```sql
CREATE TABLE accounts (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  username      VARCHAR(20)  NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,            -- bcrypt/argon2, never plain text
  photo         TEXT,
  status        VARCHAR(10)  NOT NULL DEFAULT 'Active',
  is_owner      BOOLEAN      NOT NULL DEFAULT FALSE,
  registered    DATE         NOT NULL DEFAULT CURRENT_DATE,
  last_login    TIMESTAMPTZ
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(40) NOT NULL UNIQUE,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('Female','Male','Unisex','Preferred by Both')),
  family      VARCHAR(20) NOT NULL,
  size        VARCHAR(12) NOT NULL DEFAULT '50 ml',
  price       INTEGER     NOT NULL CHECK (price > 0),
  stock       INTEGER     NOT NULL CHECK (stock >= 0),   -- DB-level guard against negative stock
  sold        INTEGER     NOT NULL DEFAULT 0,
  notes       VARCHAR(80),
  description VARCHAR(260),
  image       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  order_id    VARCHAR(40) PRIMARY KEY,
  customer    VARCHAR(40) NOT NULL DEFAULT 'Walk-in customer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  VARCHAR(20) NOT NULL,
  voided      BOOLEAN     NOT NULL DEFAULT FALSE,
  void_reason VARCHAR(60),
  void_note   VARCHAR(80),
  voided_at   TIMESTAMPTZ,
  voided_by   VARCHAR(20),
  restocked   BOOLEAN
);

CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    VARCHAR(40) NOT NULL REFERENCES orders(order_id),
  product_id  INTEGER     NOT NULL REFERENCES products(id),
  name        VARCHAR(40) NOT NULL,                 -- snapshot of the name at sale time
  qty         INTEGER     NOT NULL CHECK (qty > 0),
  unit_price  INTEGER     NOT NULL,                 -- snapshot of the price at sale time
  total       INTEGER     NOT NULL
);
CREATE INDEX idx_orders_created ON orders(created_at);
```

The front-end's flat "transaction row" is a join of `order_items` with its `orders` row. Store name and price as a **snapshot** on each line, so later edits to a product never rewrite past sales.

---

## 5. Connecting the front-end (`js/api.js`)

### Important: the UI expects synchronous data
`dashboard.js` and `app.js` call `Store.getProducts()` and the other methods as if they returned data immediately. A real API is asynchronous. You have two options:

**Option A (least change, recommended):** preload everything once, keep a cache, and let the existing synchronous getters read from it.

```js
const cache = { products: [], transactions: [], accounts: [] };

async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    credentials: "include",                        // send the session cookie
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.status === 204 ? null : res.json();
}

// Call this ONCE before the page scripts run (see "Startup" below).
Store.init = async () => {
  cache.products = await api("/products");
  cache.transactions = await api("/transactions");   // dashboard only
  cache.accounts = await api("/accounts");           // dashboard only
};

Store.getProducts = () => cache.products;
Store.getTransactions = () => cache.transactions;
Store.getAccounts = () => cache.accounts;
```

**Startup:** wrap each page script so it waits for `Store.init()`. For example, at the very top of `app.js` and `dashboard.js`, change the first line of execution to run inside `Store.init().then(() => { … })`, or load the scripts dynamically after `await Store.init()`.

The write methods (`saveProducts`, `addTransaction`, …) must return `true`/`false` synchronously, because the UI uses that result to show "storage full" errors. With Option A, update the cache and send the request in the background, then roll back and show an error if the request fails.

**Option B (cleaner, more work):** convert every `Store.*` call site to `async/await`. Search for `Store.` in `app.js` and `dashboard.js`. There are roughly 30 call sites.

### Suggested REST endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/products` | List products (public — the landing page uses it, with no login) |
| POST / PUT / DELETE | `/api/products[/:id]` | Create, edit, delete product (admin) |
| POST | `/api/checkout` | Create an order from the cart (admin) — see 6.1 |
| GET | `/api/transactions?from=&to=` | Transaction rows, optionally by date range (admin) |
| POST | `/api/orders/:orderId/void` | Void an order — see 6.2 (admin) |
| GET / POST / PUT / DELETE | `/api/accounts[/:id]` | Account management (**owner only**) |
| POST | `/api/auth/send-otp` | Send an OTP email — see 6.3 |
| POST | `/api/auth/login` | Verify email + password + OTP, start a session |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/auth/me` | Current admin (for the dashboard session check) |

The landing page must only ever see products. Do not expose transactions or accounts to unauthenticated requests.

---

## 6. Rules the server must enforce

The browser can be tampered with, so these checks cannot live only in `dashboard.js`.

### 6.1 Checkout (multi-product cart)
The dashboard builds a cart of several products, each with a quantity, then submits it once. The server should do this in **one database transaction**:
1. Lock the affected product rows (`SELECT … FOR UPDATE`).
2. Reject the whole order if any product has `stock < qty`.
3. Insert the `orders` row and one `order_items` row per product, using the **server's** current price (do not trust the price sent by the browser).
4. Decrease `products.stock` and increase `products.sold` by `qty`.
5. Generate the `orderId` on the server (format `MR-YYYYMMDD-HHMMSS-NN`, or any unique ID).
6. Return the order so the UI can show the receipt.

### 6.2 Void order
Request body: `{ "reason": "Returned by customer", "note": "", "restock": true }`.
In one transaction:
1. Reject if the order is already voided.
2. Mark the order voided and save `reason`, `note`, `voidedAt`, `voidedBy`, `restocked`.
3. If `restock` is true, add each line's `qty` back to `products.stock`.
4. Decrease `products.sold` by each line's `qty` (not below 0).
5. All revenue queries must exclude voided orders.

Allowed reasons (the dropdown in `dashboard.html`): *Customer cancelled the order, Returned by customer, Damaged or defective product, Wrong item or wrong quantity, Payment failed or refunded, Encoding / cashier error, Duplicate transaction.* Validate against this list.

### 6.3 Login, OTP and sessions
The old demo code generated the OTP **in the browser** and printed it on screen ("DEMO EMAIL OTP"). This is not secure and must be replaced:
- `Send OTP` → server generates a 6-digit code, stores only its hash with a 5-minute expiry and an attempt limit, and emails it to the administrator. Never return the code to the browser.
- `Verify & Sign In` → server checks the password hash and the OTP, then starts a session using an `HttpOnly`, `Secure`, `SameSite` cookie.
- In `app.js`, remove the `lgDemoOtp` display and the client-side `generatedOtp` / `otpExpires` checks, and call your endpoints instead.
- The dashboard currently trusts `sessionStorage.scentLoggedIn` and `scentAdminEmail`. That is only a UI convenience. Real access control is your server session; protect every admin endpoint with it.
- Add login rate limiting and lockout after repeated failures.

### 6.4 Accounts
- Hash passwords with bcrypt or argon2. Minimum 6 characters (matches the form), 8+ recommended.
- Usernames and emails must be unique. Only the owner can add, edit, or delete accounts. The owner account cannot be deleted.

---

## 7. Analytics notes

`dashboard.js` calculates all charts and totals (daily, weekly, annual, date range, top 5, KPIs) in the browser from the full list of non-voided transactions. This is fine for a small shop. If the history grows large, have `/api/transactions` accept `from` and `to` dates, or move the grouping to SQL and return pre-aggregated figures. `Store.getTransactions()` is the single place to adapt.

---

## 8. Environment and deployment checklist

1. Choose a stack (any works: Node/Express, Laravel, Django, ASP.NET, etc.).
2. Create the database and run the schema in section 4.
3. Create the first account (`is_owner = true`) with a hashed password, using a seed script rather than hard-coding it.
4. Keep secrets in environment variables, never in the repo: `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `OTP_FROM_EMAIL`.
5. Serve the front-end files as static files from the same origin as `/api` (avoids CORS). If they are on different origins, enable CORS for that origin only and set `credentials: "include"`.
6. Use HTTPS in production.
7. Product images: decide on storage (disk or cloud). Keep the existing `assets/products/product-NN.png` naming for the first 50 products, or return full URLs in `image`.
8. Back up the database regularly.

---

## 9. Testing checklist

- [ ] Landing page loads products, the carousel shows the top 5 by `sold`, and the product modal opens.
- [ ] Logo clicked 5 times opens the login; wrong password and wrong OTP are rejected; a correct login reaches the dashboard.
- [ ] Opening `dashboard.html` directly without a session redirects to `index.html`.
- [ ] Inventory: add, edit, delete one and several products.
- [ ] Stock Control: add 3 different products with different quantities → one checkout → stock drops correctly → receipt shows all lines.
- [ ] Checkout is rejected if stock changed in another session and is now too low.
- [ ] Sales Analytics: today / week / year / custom range totals match the database; PDF and JPEG export work (there is no PNG option).
- [ ] Void order: pick a reason → stock returns, `sold` decreases, revenue and top-5 drop, the order appears under "Voided orders", and voiding twice is blocked.
- [ ] Accounts: a non-owner cannot create, edit, or delete (verify the **API** refuses, not just the hidden buttons).

---

## 10. Known leftovers to be aware of

- `login.css` is the legacy standalone login page style and is not used by `index.html`.
- `Store.reset()` and the "Reset demo data" button were removed along with the built-in database.
- `js/api.js` methods currently return empty data, so until you implement them the site shows empty lists and nobody can log in.
