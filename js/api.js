/* =========================================================
   SCENT — data adapter (BACKEND HOOK)
   ---------------------------------------------------------
   The built-in browser database (localStorage seed data, demo
   accounts, sample transactions) has been REMOVED.
   The front-end still talks to a single object called `Store`,
   so the backend programmer only has to implement the methods
   below (e.g. with fetch() calls to the server API) and nothing
   else in the UI has to change.

   Every method is currently an empty placeholder returning
   "no data". Replace each TODO with the real API call.
   NOTE: these are synchronous placeholders. If your API is
   async, convert the callers in app.js / dashboard.js to
   async/await (search for "Store.").
   ========================================================= */
(function (global) {
  "use strict";

  // UI constants (not database data): used by dropdowns and badges.
  const LOW_STOCK = 6; // a product is "low stock" at this many units or fewer
  const families = ["Floral", "Woody", "Fresh", "Oriental", "Citrus", "Fruity", "Powdery", "Amber", "Musk", "Aromatic"];
  const categories = ["Female", "Male", "Unisex", "Preferred by Both"];

  // Pure UI helper: turns a stock number into a badge key + label.
  function availability(stock) {
    if (stock <= 0) return { key: "out", label: "Out of stock" };
    if (stock <= LOW_STOCK) return { key: "low", label: "Low stock" };
    return { key: "high", label: "High stock" };
  }

  const Store = {
    LOW_STOCK, families, categories, availability,

    /* ---- PRODUCTS ----
       Product shape: { id, name, category, family, size, price, stock, sold, notes, description, image? } */
    getProducts: () => [], // TODO: GET  /products
    saveProducts: (list) => true, // TODO: PUT/POST products (return false on failure)

    /* ---- TRANSACTIONS (one row per product line of an order) ----
       Row shape: { id, orderId, pid, name, qty, unitPrice, total, ts, by, customer,
                    voided?, voidReason?, voidNote?, voidedAt?, voidedBy?, restocked? } */
    getTransactions: () => [], // TODO: GET  /transactions
    addTransaction: (t) => t, // TODO: POST /transactions (server should assign t.id)
    saveTransactions: (list) => true, // TODO: persist voided rows (or PATCH /orders/:orderId/void)

    /* ---- ACCOUNTS ----
       Account shape: { id, name, username, email, registered, lastLogin, status, owner, photo? } */
    getAccounts: () => [], // TODO: GET  /accounts
    saveAccounts: (list) => true, // TODO: persist accounts
    accountByEmail: (email) => null, // TODO: look up an administrator by email
    findAccount: (email, password) => null, // TODO: POST /login (verify password ON THE SERVER)
    touchLogin: (email) => {}, // TODO: record last login time
  };

  global.Store = Store;
})(window);
