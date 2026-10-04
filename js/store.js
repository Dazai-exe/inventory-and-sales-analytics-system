/* =========================================================
   SCENT — shared data store (used by the landing page,
   the login panel and the administrator dashboard)
   Everything is saved in the browser (localStorage), so it
   works offline with no server or database.
   ========================================================= */
(function (global) {
  "use strict";

  const KEYS = {
    products: "scent_products_v1",
    tx: "scent_transactions_v1",
    accounts: "scent_accounts_v1",
  };

  // A product is "low stock" when it has this many units or fewer.
  const LOW_STOCK = 6;

  const families = ["Floral", "Woody", "Fresh", "Oriental", "Citrus", "Fruity", "Powdery", "Amber", "Musk", "Aromatic"];
  const categories = ["Female", "Male", "Unisex", "Preferred by Both"];
  const names = [
    "Éclat", "Noir", "Rosé", "Aura", "Velvet", "Élan", "Serein", "Lumière", "Opale", "Céleste",
    "Amour", "Étoile", "Musc Blanc", "Belle Nuit", "Fleur d’Or", "Santal", "Iris", "Ambre", "Jardin Secret", "Éternité",
    "Rêve", "Chérie", "Velours Noir", "Pureté", "Majesté", "Mélodie", "Cassis", "Néroli", "Magnolia", "Aube",
    "Braise", "Cèdre", "Lueur", "Soirée", "Vanille Royale", "Ombre", "Perle", "Soleil", "Rosée", "Prestige",
    "Finesse", "Évidence", "Sillage", "Émoi", "Harmonie", "Infini", "Éden", "Signature", "Charme", "Noble",
  ];
  const notes = [
    "bergamot, white jasmine, vanilla",
    "black pepper, cedarwood, amber",
    "rose petals, pear, soft musk",
    "citrus blossom, clean musk, cedar",
    "dark vanilla, sandalwood, tonka bean",
    "lavender, bergamot, vetiver",
    "white tea, iris, soft woods",
    "orange blossom, neroli, musk",
    "pear, peony, cashmere wood",
    "jasmine, amber, vanilla",
  ];
  const desc = [
    "A refined fragrance designed for an elegant everyday presence, opening with luminous notes and settling into a smooth, lasting trail.",
    "A sophisticated composition with a confident character, balanced by warm woods and a polished finish.",
    "A graceful floral blend with a soft sweetness and a clean, memorable dry-down.",
    "A bright and airy scent that feels polished, fresh, and effortlessly luxurious.",
    "A rich evening fragrance built around warm woods, velvety sweetness, and an intimate finish.",
  ];

  /* ---------- storage (falls back to memory if localStorage is blocked) ---------- */
  const mem = {};
  function read(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return mem[key] ? JSON.parse(mem[key]) : null;
    }
  }
  function write(key, value) {
    const text = JSON.stringify(value);
    try {
      localStorage.setItem(key, text);
      delete mem[key];
      return true;
    } catch (e) {
      mem[key] = text;
      return false; // e.g. storage full
    }
  }

  /* ---------- demo data ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedProducts() {
    return names.map((name, i) => ({
      id: i + 1,
      name,
      category: categories[i % 4],
      family: families[i % 10],
      size: "50 ml",
      price: 1899 + ((i * 137) % 1201),
      stock: 4 + ((i * 7) % 23),
      sold: 0,
      notes: notes[i % 10],
      description: desc[i % 5],
    }));
  }

  // About 14 months of sample sales so the analytics charts have something to show.
  function seedTransactions(products) {
    const rand = mulberry32(20260101);
    const weights = products.map((p, i) => (i < 5 ? [10, 9, 8, 7, 6][i] : 1 + (i % 3)));
    const total = weights.reduce((a, b) => a + b, 0);
    const pick = () => {
      let r = rand() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return products[i];
      }
      return products[0];
    };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const DAYS = 420;
    const list = [];
    for (let d = DAYS - 1; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const weekend = day.getDay() === 5 || day.getDay() === 6;
      const trend = 0.7 + 0.6 * ((DAYS - d) / DAYS);
      const n = Math.floor(rand() * 4 * trend + (weekend ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const hour = 10 + Math.floor(rand() * 10);
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(rand() * 60));
        if (when > now) continue;
        const p = pick();
        const q = rand() < 0.6 ? 1 : rand() < 0.75 ? 2 : 3;
        list.push({ pid: p.id, name: p.name, qty: q, unitPrice: p.price, total: q * p.price, ts: when.getTime(), by: "admin" });
      }
    }
    list.sort((a, b) => a.ts - b.ts);
    list.forEach((t, i) => (t.id = i + 1));
    return list;
  }

  function seedAccounts() {
    const mk = (id, name, username, email, registered) => ({
      id, name, username, email, password: "admin123", registered, lastLogin: null, status: "Active",
      owner: id === 1, // the business owner: the only one who can manage accounts
    });
    return [
      mk(1, "Maison Réve Administrator", "admin", "admin@maisonreve.com", "2025-01-15"),
      mk(2, "Isabelle Navarro", "isabelle.n", "isabelle@maisonreve.com", "2025-03-04"),
      mk(3, "Marco Delgado", "marco.d", "marco@maisonreve.com", "2025-05-20"),
      mk(4, "Camille Reyes", "camille.r", "camille@maisonreve.com", "2025-08-11"),
    ];
  }

  function ensureSeeded() {
    if (!read(KEYS.products)) {
      const products = seedProducts();
      const tx = seedTransactions(products);
      tx.forEach((t) => {
        const p = products.find((x) => x.id === t.pid);
        if (p) p.sold += t.qty;
      });
      write(KEYS.products, products);
      write(KEYS.tx, tx);
    } else if (!read(KEYS.tx)) {
      write(KEYS.tx, []);
    }
    if (!read(KEYS.accounts)) write(KEYS.accounts, seedAccounts());
    // older saved data had no owner: make the first account the owner
    const accs = read(KEYS.accounts);
    if (accs.length && !accs.some((a) => a.owner)) {
      accs[0].owner = true;
      write(KEYS.accounts, accs);
    }
  }
  ensureSeeded();

  /* ---------- public API ---------- */
  function availability(stock) {
    if (stock <= 0) return { key: "out", label: "Out of stock" };
    if (stock <= LOW_STOCK) return { key: "low", label: "Low stock" };
    return { key: "high", label: "High stock" };
  }

  const Store = {
    LOW_STOCK, families, categories, availability,

    getProducts: () => read(KEYS.products) || [],
    saveProducts: (list) => write(KEYS.products, list),

    getTransactions: () => read(KEYS.tx) || [],
    addTransaction(t) {
      const list = read(KEYS.tx) || [];
      t.id = list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      list.push(t);
      write(KEYS.tx, list);
      return t;
    },

    getAccounts: () => read(KEYS.accounts) || [],
    saveAccounts: (list) => write(KEYS.accounts, list),
    accountByEmail(email) {
      const e = String(email || "").trim().toLowerCase();
      return Store.getAccounts().find((a) => a.email.toLowerCase() === e) || null;
    },
    findAccount(email, password) {
      const a = Store.accountByEmail(email);
      return a && a.password === password ? a : null;
    },
    touchLogin(email) {
      const list = Store.getAccounts();
      const a = list.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
      if (a) {
        a.lastLogin = Date.now();
        write(KEYS.accounts, list);
      }
    },

    reset() {
      try {
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      } catch (e) {}
      Object.keys(mem).forEach((k) => delete mem[k]);
      ensureSeeded();
    },
  };

  global.Store = Store;
})(window);
