/* =========================================================
   SCENT — Administrator Dashboard
   Tabs: Inventory • Stock Control • Sales Analytics • Accounts
   ========================================================= */
(function () {
  "use strict";

  /* ---------- access check ---------- */
  const sessionEmail = sessionStorage.getItem("scentAdminEmail");
  const me = Store.accountByEmail(sessionEmail);
  if (sessionStorage.getItem("scentLoggedIn") !== "true" || !me) {
    sessionStorage.removeItem("scentLoggedIn");
    location.replace("index.html");
    return;
  }
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && sessionStorage.getItem("scentLoggedIn") !== "true")
      location.replace("index.html");
  });

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const peso = (n) => "₱" + Math.round(n).toLocaleString("en-PH");
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const imgOf = (p) =>
    p.image || (p.id <= 50 ? `assets/products/product-${String(p.id).padStart(2, "0")}.svg` : "assets/logo.svg");
  const imgByPid = (pid) => {
    const p = products.find((x) => x.id === pid);
    return p ? imgOf(p) : pid <= 50 ? `assets/products/product-${String(pid).padStart(2, "0")}.svg` : "assets/logo.svg";
  };

  // default "photo" for each account (a neat silhouette)
  function avatarSrc(a) {
    if (a.photo) return a.photo;
    const h = [...a.email].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    const hue = [28, 32, 36, 24, 40][h % 5];
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='hsl(${hue} 45% 62%)'/><stop offset='1' stop-color='hsl(${hue} 40% 36%)'/></linearGradient></defs>` +
      `<rect width='100' height='100' fill='url(#g)'/><circle cx='50' cy='38' r='17' fill='#f7f3ed'/>` +
      `<path d='M16 100c2-24 18-36 34-36s32 12 34 36z' fill='#f7f3ed'/></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function toast(msg, type) {
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 320);
    }, 3400);
  }

  /* ---------- state ---------- */
  let products = Store.getProducts();
  let transactions = Store.getTransactions();

  /* ---------- dialogs ---------- */
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d && d.id !== "confirmDialog") d.close();
    });
    $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  });

  function confirmAction({ title, message, confirmText, tone }) {
    return new Promise((resolve) => {
      const dlg = $("#confirmDialog");
      $("#cfTitle").textContent = title;
      $("#cfMessage").textContent = message;
      const ok = $("#cfOk");
      ok.textContent = confirmText;
      ok.className = "btn " + (tone === "danger" ? "danger" : "dark");
      dlg.returnValue = "";
      const done = () => resolve(dlg.returnValue === "ok");
      dlg.addEventListener("close", done, { once: true });
      ok.onclick = () => dlg.close("ok");
      $("#cfCancel").onclick = () => dlg.close("cancel");
      dlg.showModal();
    });
  }

  /* =========================================================
     SIDEBAR + TABS
     ========================================================= */
  $("#userPhoto").src = avatarSrc(me);
  $("#userName").textContent = me.username;
  $("#userEmail").textContent = me.email;
  $("#year").textContent = new Date().getFullYear();

  const renderers = {
    inventory: () => renderInventory(),
    stock: () => renderStockControl(),
    analytics: () => renderAnalytics(),
    accounts: () => renderAccounts(),
  };

  function switchTab(name) {
    $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
    sessionStorage.setItem("scentTab", name);
    renderers[name]();
    closeMenu();
    window.scrollTo({ top: 0 });
  }
  $$(".nav-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  const openMenu = () => {
    $("#sidebar").classList.add("open");
    $("#scrim").classList.add("show");
  };
  const closeMenu = () => {
    $("#sidebar").classList.remove("open");
    $("#scrim").classList.remove("show");
  };
  $("#menuBtn").addEventListener("click", openMenu);
  $("#scrim").addEventListener("click", closeMenu);

  // curtain: opening animation, then logout animation
  const curtain = $("#curtain");
  curtain.addEventListener("animationend", () => {
    if (!curtain.classList.contains("leaving")) curtain.classList.add("done");
  });
  if (reduceMotion) curtain.classList.add("done");

  $("#logoutBtn").addEventListener("click", () => {
    $("#curtainSmall").textContent = "SIGNING OUT";
    $("#curtainText").textContent = "See you soon, " + me.username + ".";
    curtain.classList.remove("done");
    curtain.classList.add("leaving");
    setTimeout(
      () => {
        sessionStorage.removeItem("scentLoggedIn");
        sessionStorage.removeItem("scentAdminEmail");
        sessionStorage.removeItem("scentTab");
        location.replace("index.html");
      },
      reduceMotion ? 100 : 1500,
    );
  });

  /* =========================================================
     TAB 1 — INVENTORY
     ========================================================= */
  const invSelected = new Set();
  let invQuery = "";

  function invList() {
    const q = invQuery.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.family.toLowerCase().includes(q));
  }

  function renderInventory() {
    const list = invList();
    // forget selections of products that no longer exist
    [...invSelected].forEach((id) => {
      if (!products.some((p) => p.id === id)) invSelected.delete(id);
    });
    $("#invBody").innerHTML = list
      .map((p) => {
        const a = Store.availability(p.stock);
        const sel = invSelected.has(p.id);
        return `<tr data-id="${p.id}" class="${sel ? "selected" : ""}">
          <td class="c-check"><input type="checkbox" class="row-check" ${sel ? "checked" : ""} aria-label="Select ${esc(p.name)}"></td>
          <td><img class="thumb" src="${imgOf(p)}" alt="${esc(p.name)}"></td>
          <td><strong>${esc(p.name)}</strong><small>${esc(p.family)} • ${esc(p.size || "")}</small></td>
          <td>${esc(p.category)}</td>
          <td class="num">${p.stock}</td>
          <td class="num">${peso(p.price)}</td>
          <td><span class="pill ${a.key}">${a.label}</span></td>
          <td class="actions"><button class="icon-btn edit" data-act="edit">Edit</button><button class="icon-btn del" data-act="delete">Delete</button></td>
        </tr>`;
      })
      .join("");
    $("#invEmpty").hidden = list.length > 0;
    $("#invCount").textContent = `${list.length} of ${products.length} products`;
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const n = invSelected.size;
    const btn = $("#invDeleteSel");
    btn.disabled = n === 0;
    btn.textContent = `Delete Selected (${n})`;
    const visible = invList();
    const all = $("#invAll");
    all.checked = visible.length > 0 && visible.every((p) => invSelected.has(p.id));
    all.indeterminate = !all.checked && visible.some((p) => invSelected.has(p.id));
  }

  $("#invSearch").addEventListener("input", (e) => {
    invQuery = e.target.value;
    renderInventory();
  });

  $("#invBody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = +tr.dataset.id;
    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "edit") openProductDialog(id);
      else deleteProducts([id]);
      return;
    }
    if (invSelected.has(id)) invSelected.delete(id);
    else invSelected.add(id);
    tr.classList.toggle("selected", invSelected.has(id));
    tr.querySelector(".row-check").checked = invSelected.has(id);
    updateSelectionUI();
  });

  $("#invAll").addEventListener("change", (e) => {
    invList().forEach((p) => (e.target.checked ? invSelected.add(p.id) : invSelected.delete(p.id)));
    renderInventory();
  });

  $("#invDeleteSel").addEventListener("click", () => deleteProducts([...invSelected]));

  async function deleteProducts(ids) {
    const items = products.filter((p) => ids.includes(p.id));
    if (!items.length) return;
    const ok = await confirmAction({
      title: items.length === 1 ? "Delete product" : `Delete ${items.length} products`,
      message:
        items.length === 1
          ? `You are about to delete “${items[0].name}” from the inventory. This cannot be undone.`
          : `You are about to delete ${items.length} selected products from the inventory. This cannot be undone.`,
      confirmText: "Confirm Delete",
      tone: "danger",
    });
    if (!ok) return;
    products = products.filter((p) => !ids.includes(p.id));
    ids.forEach((id) => invSelected.delete(id));
    Store.saveProducts(products);
    renderInventory();
    toast(items.length === 1 ? `“${items[0].name}” deleted.` : `${items.length} products deleted.`);
  }

  /* ----- add / edit product dialog ----- */
  const pf = {
    dlg: $("#productDialog"),
    form: $("#pfForm"),
    name: $("#pfName"),
    cat: $("#pfCategory"),
    fam: $("#pfFamily"),
    price: $("#pfPrice"),
    stock: $("#pfStock"),
    size: $("#pfSize"),
    notes: $("#pfNotes"),
    desc: $("#pfDesc"),
    file: $("#pfImage"),
    preview: $("#pfPreview"),
    previewEmpty: $("#pfPreviewEmpty"),
    error: $("#pfError"),
  };
  pf.cat.innerHTML = Store.categories.map((c) => `<option>${c}</option>`).join("");
  pf.fam.innerHTML = Store.families.map((c) => `<option>${c}</option>`).join("");
  let pfEditingId = null;
  let pfImage = null; // data URL of a newly chosen image

  function showPreview(src) {
    pf.preview.hidden = !src;
    pf.previewEmpty.hidden = !!src;
    if (src) pf.preview.src = src;
  }

  function openProductDialog(id) {
    pfEditingId = id || null;
    pfImage = null;
    pf.error.textContent = "";
    pf.file.value = "";
    const p = id ? products.find((x) => x.id === id) : null;
    $("#pfEyebrow").textContent = p ? "EDIT PRODUCT" : "NEW PRODUCT";
    $("#pfTitle").textContent = p ? "Update Product" : "Add Product";
    $("#pfSubmit").textContent = p ? "Save Changes" : "Save Product";
    pf.name.value = p ? p.name : "";
    pf.cat.value = p ? p.category : Store.categories[0];
    pf.fam.value = p ? p.family : Store.families[0];
    pf.price.value = p ? p.price : "";
    pf.stock.value = p ? p.stock : "";
    pf.size.value = p ? p.size || "" : "50 ml";
    pf.notes.value = p ? p.notes || "" : "";
    pf.desc.value = p ? p.description || "" : "";
    showPreview(p ? imgOf(p) : null);
    pf.dlg.showModal();
    pf.name.focus();
  }
  $("#invAdd").addEventListener("click", () => openProductDialog(null));

  // read the chosen picture and shrink it so it fits in browser storage
  pf.file.addEventListener("change", () => {
    const f = pf.file.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      pf.error.textContent = "Please choose an image file.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 600;
        const r = Math.min(1, max / Math.max(im.width || max, im.height || max));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((im.width || max) * r));
        c.height = Math.max(1, Math.round((im.height || max) * r));
        const x = c.getContext("2d");
        x.fillStyle = "#efe8de";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        pfImage = c.toDataURL("image/jpeg", 0.85);
        showPreview(pfImage);
        pf.error.textContent = "";
      };
      im.onerror = () => (pf.error.textContent = "That image could not be read.");
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  pf.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = pf.name.value.trim();
    const price = Number(pf.price.value);
    const stockRaw = pf.stock.value.trim();
    const stock = Number(stockRaw);
    const err = (m) => (pf.error.textContent = m);

    if (!name) return err("Please enter the product name.");
    if (products.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== pfEditingId))
      return err("A product with this name already exists.");
    if (!pf.price.value || !(price > 0)) return err("Enter a retail price greater than zero.");
    if (stockRaw === "" || !Number.isInteger(stock) || stock < 0) return err("Stock quantity must be a whole number, 0 or more.");
    if (!pfEditingId && !pfImage) return err("Please upload a product image.");

    const fields = {
      name,
      category: pf.cat.value,
      family: pf.fam.value,
      price: Math.round(price),
      stock,
      size: pf.size.value.trim() || "50 ml",
      notes: pf.notes.value.trim(),
      description: pf.desc.value.trim(),
    };
    const before = products;
    let next;
    if (pfEditingId) {
      next = products.map((p) => (p.id === pfEditingId ? { ...p, ...fields, ...(pfImage ? { image: pfImage } : {}) } : p));
    } else {
      const id = products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      next = [...products, { id, sold: 0, createdAt: Date.now(), image: pfImage, ...fields }];
    }
    if (!Store.saveProducts(next)) {
      Store.saveProducts(before);
      return err("Browser storage is full. Try a smaller image.");
    }
    products = next;
    pf.dlg.close();
    renderInventory();
    toast(pfEditingId ? `“${name}” updated.` : `“${name}” added to the inventory.`);
  });

  /* =========================================================
     TAB 2 — STOCK CONTROL
     ========================================================= */
  let scQuery = "";
  let scCat = "all";

  function renderStockControl() {
    const q = scQuery.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (scCat === "all" || p.category === scCat) &&
        (!q || `${p.name} ${p.family} ${p.category}`.toLowerCase().includes(q)),
    );
    $("#scGrid").innerHTML = list
      .map((p) => {
        const a = Store.availability(p.stock);
        const badge = p.stock === 0 ? "Out of stock" : p.stock <= Store.LOW_STOCK ? `Only ${p.stock} left` : `${p.stock} in stock`;
        return `<article class="sc-card ${p.stock === 0 ? "out" : ""}" data-id="${p.id}" tabindex="0" role="button" aria-label="Deduct ${esc(p.name)}">
          <div class="sc-img"><img src="${imgOf(p)}" alt="${esc(p.name)} perfume bottle"><span class="sc-badge ${a.key}">${badge}</span></div>
          <div class="sc-info"><div class="fam">${esc(p.family)} • ${esc(p.category)}</div><h3>${esc(p.name)}</h3>
          <div class="sc-bottom"><strong>${peso(p.price)}</strong><span class="go">${p.stock === 0 ? "Unavailable" : "Deduct →"}</span></div></div>
        </article>`;
      })
      .join("");
    $("#scEmpty").hidden = list.length > 0;
    $("#scCount").textContent = `${list.length} fragrance${list.length === 1 ? "" : "s"}`;
  }

  $("#scSearch").addEventListener("input", (e) => {
    scQuery = e.target.value;
    renderStockControl();
  });
  $("#scCat").addEventListener("change", (e) => {
    scCat = e.target.value;
    renderStockControl();
  });
  function onCard(e) {
    const card = e.target.closest(".sc-card");
    if (!card) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    const p = products.find((x) => x.id === +card.dataset.id);
    if (!p) return;
    if (p.stock <= 0) return toast(`“${p.name}” is out of stock.`, "error");
    openStockDialog(p.id);
  }
  $("#scGrid").addEventListener("click", onCard);
  $("#scGrid").addEventListener("keydown", onCard);

  /* ----- stock control panel ----- */
  const sd = { dlg: $("#stockDialog"), qty: $("#sdQty"), error: $("#sdError") };
  let sdProductId = null;

  function sdQtyValue() {
    return Number(sd.qty.value);
  }
  function sdUpdate() {
    const p = products.find((x) => x.id === sdProductId);
    if (!p) return;
    const q = sdQtyValue();
    const valid = Number.isInteger(q) && q >= 1 && q <= p.stock;
    $("#sdUnits").textContent = valid ? q : "—";
    $("#sdTotal").textContent = valid ? peso(q * p.price) : "—";
    $("#sdAfter").textContent = valid ? p.stock - q : "—";
    sd.error.textContent = "";
    if (sd.qty.value !== "" && !valid)
      sd.error.textContent = q > p.stock ? `Only ${p.stock} in stock.` : "Enter a whole number of 1 or more.";
  }

  function openStockDialog(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    sdProductId = id;
    $("#sdImg").src = imgOf(p);
    $("#sdImg").alt = p.name;
    $("#sdName").textContent = p.name;
    $("#sdMeta").textContent = `${p.family} • ${p.category} • ${p.size || ""}`;
    $("#sdStock").textContent = p.stock;
    $("#sdPrice").textContent = peso(p.price);
    sd.qty.max = p.stock;
    sd.qty.value = 1;
    sdUpdate();
    sd.dlg.showModal();
    sd.qty.select();
  }

  sd.qty.addEventListener("input", sdUpdate);
  $("#sdMinus").addEventListener("click", () => {
    sd.qty.value = Math.max(1, (sdQtyValue() || 1) - 1);
    sdUpdate();
  });
  $("#sdPlus").addEventListener("click", () => {
    const p = products.find((x) => x.id === sdProductId);
    sd.qty.value = Math.min(p.stock, (sdQtyValue() || 0) + 1);
    sdUpdate();
  });

  $("#sdForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p = products.find((x) => x.id === sdProductId);
    if (!p) return;
    const q = sdQtyValue();
    if (!Number.isInteger(q) || q < 1) return (sd.error.textContent = "Enter a whole number of 1 or more.");
    if (q > p.stock) return (sd.error.textContent = `Only ${p.stock} in stock.`);
    const ok = await confirmAction({
      title: "Deduct product",
      message: `Deduct ${q} × ${p.name} from the inventory? A sales transaction of ${peso(q * p.price)} will be recorded.`,
      confirmText: "Confirm Deduct",
    });
    if (!ok) return;

    // always deduct from the current product record
    const cur = products.find((x) => x.id === sdProductId);
    if (!cur || q > cur.stock) return toast("Stock changed — please try again.", "error");
    const before = products;
    const next = products.map((x) => (x.id === cur.id ? { ...x, stock: x.stock - q, sold: (x.sold || 0) + q } : x));
    if (!Store.saveProducts(next)) {
      Store.saveProducts(before);
      return toast("Could not save: browser storage is full.", "error");
    }
    products = next;
    const t = Store.addTransaction({
      pid: cur.id,
      name: cur.name,
      qty: q,
      unitPrice: cur.price,
      total: q * cur.price,
      ts: Date.now(),
      by: me.username,
    });
    transactions.push(t);
    sd.dlg.close();
    renderStockControl();
    toast(`Transaction ${txId(t)} recorded: ${q} × ${cur.name} (${peso(t.total)}).`);
  });

  const txId = (t) => "TXN-" + String(t.id).padStart(5, "0");

  /* =========================================================
     TAB 3 — SALES ANALYTICS
     ========================================================= */
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const startOfWeek = (d) => addDays(startOfDay(d), -((startOfDay(d).getDay() + 6) % 7)); // Monday
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtFull = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtDateTime = (ts) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const an = {
    mode: "daily",
    year: new Date().getFullYear(),
    from: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: ymd(new Date()),
  };

  const sumBetween = (s, e) => {
    const a = +s,
      b = +e;
    let total = 0;
    for (const t of transactions) if (t.ts >= a && t.ts < b) total += t.total;
    return total;
  };

  function kpiValues() {
    const now = new Date();
    const today = startOfDay(now);
    const yr = new Date(now.getFullYear(), 0, 1);
    return {
      today: sumBetween(today, addDays(today, 1)),
      week: sumBetween(startOfWeek(now), addDays(startOfWeek(now), 7)),
      year: sumBetween(yr, new Date(now.getFullYear() + 1, 0, 1)),
      total: transactions.reduce((s, t) => s + t.total, 0),
      count: transactions.length,
      yearLabel: String(now.getFullYear()),
    };
  }

  // builds the bars for the chosen view
  function buildBuckets() {
    const now = new Date();
    const today = startOfDay(now);
    const bars = [];
    let win, title, periodLabel, group;

    const dayBars = (from, to) => {
      for (let d = new Date(from); d <= to; d = addDays(d, 1))
        bars.push({ s: d, e: addDays(d, 1), label: fmtShort(d), tip: fmtFull(d) });
    };
    const weekBars = (from, to, clip) => {
      for (let s = new Date(from); s <= to; s = addDays(s, 7)) {
        const e = addDays(s, 7);
        const last = clip && e > addDays(to, 1) ? to : addDays(e, -1);
        bars.push({ s, e: clip && e > addDays(to, 1) ? addDays(to, 1) : e, label: fmtShort(s), tip: `${fmtShort(s)} – ${fmtShort(last)}` });
      }
    };

    if (an.mode === "daily") {
      const from = addDays(today, -29);
      dayBars(from, today);
      win = [from, addDays(today, 1)];
      title = "Daily income";
      periodLabel = `Last 30 days (${fmtShort(from)} – ${fmtFull(today)})`;
      group = "per day";
    } else if (an.mode === "weekly") {
      const from = addDays(startOfWeek(today), -77);
      weekBars(from, startOfWeek(today));
      win = [from, addDays(startOfWeek(today), 7)];
      title = "Weekly income";
      periodLabel = `Last 12 weeks (${fmtShort(from)} – ${fmtFull(addDays(startOfWeek(today), 6))})`;
      group = "per week";
    } else if (an.mode === "annual") {
      for (let m = 0; m < 12; m++)
        bars.push({ s: new Date(an.year, m, 1), e: new Date(an.year, m + 1, 1), label: MONTHS[m], tip: `${MONTHS[m]} ${an.year}` });
      win = [new Date(an.year, 0, 1), new Date(an.year + 1, 0, 1)];
      title = `Annual income ${an.year}`;
      periodLabel = `Year ${an.year} (by month)`;
      group = "per month";
    } else {
      const from = parseYmd(an.from);
      const to = parseYmd(an.to);
      const days = Math.round((to - from) / 864e5) + 1;
      win = [from, addDays(to, 1)];
      title = "Income for selected dates";
      periodLabel = `${fmtFull(from)} – ${fmtFull(to)}`;
      if (days <= 45) {
        dayBars(from, to);
        group = "per day";
      } else if (days <= 400) {
        weekBars(from, to, true);
        group = "per week";
      } else {
        for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
          const s = m < from ? from : m;
          const nextM = new Date(m.getFullYear(), m.getMonth() + 1, 1);
          const e = nextM > addDays(to, 1) ? addDays(to, 1) : nextM;
          bars.push({ s, e, label: `${MONTHS[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`, tip: `${MONTHS[m.getMonth()]} ${m.getFullYear()}` });
        }
        group = "per month";
      }
    }
    bars.forEach((b) => (b.value = sumBetween(b.s, b.e)));
    return { bars, win, title, periodLabel, group, mode: an.mode };
  }

  function periodStats(win) {
    const [a, b] = [+win[0], +win[1]];
    const rows = transactions.filter((t) => t.ts >= a && t.ts < b);
    const revenue = rows.reduce((s, t) => s + t.total, 0);
    const qty = rows.reduce((s, t) => s + t.qty, 0);
    const map = new Map();
    rows.forEach((t) => {
      const m = map.get(t.pid) || { pid: t.pid, name: t.name, qty: 0, revenue: 0 };
      m.qty += t.qty;
      m.revenue += t.total;
      m.name = t.name;
      map.set(t.pid, m);
    });
    const top = [...map.values()].sort((x, y) => y.qty - x.qty || y.revenue - x.revenue).slice(0, 5);
    return {
      revenue,
      qty,
      orders: rows.length,
      avg: rows.length ? revenue / rows.length : 0,
      top,
      latest: rows.slice(-60).reverse(),
    };
  }

  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  };
  const abbr = (v) => {
    if (v >= 1e6) return "₱" + +(v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "₱" + +(v / 1e3).toFixed(1) + "k";
    return "₱" + Math.round(v);
  };

  function chartSVG(bars) {
    const W = 920, H = 330, m = { l: 70, r: 14, t: 16, b: 44 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const maxV = niceMax(Math.max(...bars.map((b) => b.value), 0));
    const has = bars.some((b) => b.value > 0);
    const band = iw / bars.length;
    const bw = Math.min(band * 0.64, 44);
    const step = Math.ceil(bars.length / 12);
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - (ih * i) / 4;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`;
    }
    let ax = "";
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - (ih * i) / 4;
      ax += `<text x="${m.l - 10}" y="${y + 4}" text-anchor="end">${abbr((maxV * i) / 4)}</text>`;
    }
    let rects = "";
    bars.forEach((b, i) => {
      const h = (b.value / maxV) * ih;
      const x = m.l + band * i + (band - bw) / 2;
      rects += `<rect class="bar" x="${x.toFixed(1)}" y="${(m.t + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="3" data-tip="${esc(b.tip)}" data-val="${esc(peso(b.value))}"/>`;
      if (i % step === 0) ax += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(b.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income bar chart">
      <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfae7e"/><stop offset="1" stop-color="#927751"/></linearGradient></defs>
      <g class="grid">${g}</g><g class="axis">${ax}</g>${rects}
      ${has ? "" : `<text class="nodata" x="${W / 2}" y="${H / 2 - 10}" text-anchor="middle">No sales recorded in this period</text>`}
    </svg>`;
  }

  function renderAnalytics() {
    // KPI cards
    const k = kpiValues();
    const bottle = '<svg viewBox="0 0 120 200"><use href="#bt-a"/></svg>';
    $("#anKpis").innerHTML = [
      ["Today’s income", peso(k.today), "Sales recorded today", ""],
      ["This week", peso(k.week), "Monday to Sunday", ""],
      [`This year (${k.yearLabel})`, peso(k.year), "Annual income so far", ""],
      ["Total revenue", peso(k.total), `${k.count.toLocaleString("en-PH")} transactions overall`, "dark"],
    ]
      .map(([l, v, s, c]) => `<div class="kpi ${c}"><small>${l}</small><strong>${v}</strong><span>${s}</span>${bottle}</div>`)
      .join("");

    // controls
    $$("#anModes button").forEach((b) => b.classList.toggle("active", b.dataset.mode === an.mode));
    $("#anYearWrap").hidden = an.mode !== "annual";
    $("#anRangeWrap").hidden = an.mode !== "custom";
    const years = new Set([new Date().getFullYear(), ...transactions.map((t) => new Date(t.ts).getFullYear())]);
    $("#anYear").innerHTML = [...years].sort((a, b) => b - a).map((y) => `<option ${y === an.year ? "selected" : ""}>${y}</option>`).join("");
    $("#anFrom").value = an.from;
    $("#anTo").value = an.to;
    $("#anFrom").max = $("#anTo").max = ymd(new Date());

    const err = $("#anError");
    err.textContent = "";
    if (an.mode === "custom") {
      if (!an.from || !an.to) err.textContent = "Choose both a start and an end date.";
      else if (parseYmd(an.from) > parseYmd(an.to)) err.textContent = "The start date must be on or before the end date.";
    }
    if (err.textContent) {
      $("#anChart").innerHTML = "";
      return;
    }

    const b = buildBuckets();
    const s = periodStats(b.win);
    $("#anRangeLabel").textContent = `${b.title} • ${b.periodLabel} • bars show income ${b.group}`;
    $("#anChart").innerHTML = chartSVG(b.bars);

    $("#anStats").innerHTML = [
      ["Revenue in period", peso(s.revenue), b.periodLabel],
      ["Average order sum", peso(s.avg), "Revenue ÷ number of transactions"],
      ["Total product quantity sold", s.qty.toLocaleString("en-PH"), "Units deducted from stock"],
      ["Transactions", s.orders.toLocaleString("en-PH"), "Recorded in this period"],
    ]
      .map(([l, v, sub], i) => `<div class="kpi ${i === 0 ? "dark" : ""}"><small>${l}</small><strong>${v}</strong><span>${esc(sub)}</span>${bottle}</div>`)
      .join("");

    // top 5
    $("#anTopNote").textContent = `Ranked by units sold • ${b.periodLabel}`;
    const maxQ = Math.max(...s.top.map((t) => t.qty), 1);
    $("#anTop").innerHTML = s.top.length
      ? s.top
          .map(
            (t, i) => `<div class="top-row"><span class="rk">${String(i + 1).padStart(2, "0")}</span><img src="${imgByPid(t.pid)}" alt="">
            <div><b>${esc(t.name)}</b><small>${t.qty} unit${t.qty === 1 ? "" : "s"} sold • ${peso(t.revenue)}</small>
            <div class="top-bar"><i style="width:${(t.qty / maxQ) * 100}%"></i></div></div></div>`,
          )
          .join("")
      : '<div class="empty">No sales in this period.</div>';

    // transactions
    $("#anTxNote").textContent = s.orders ? `Showing the latest ${Math.min(s.orders, 60)} of ${s.orders.toLocaleString("en-PH")} in this period` : "No transactions in this period.";
    $("#anTx").innerHTML = s.latest
      .map((t) => `<tr><td>${txId(t)}</td><td>${fmtDateTime(t.ts)}</td><td>${esc(t.name)}</td><td class="num">${t.qty}</td><td class="num">${peso(t.total)}</td></tr>`)
      .join("");
  }

  $("#anModes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    an.mode = b.dataset.mode;
    renderAnalytics();
  });
  $("#anYear").addEventListener("change", (e) => {
    an.year = +e.target.value;
    renderAnalytics();
  });
  $("#anFrom").addEventListener("change", (e) => {
    an.from = e.target.value;
    renderAnalytics();
  });
  $("#anTo").addEventListener("change", (e) => {
    an.to = e.target.value;
    renderAnalytics();
  });

  // chart tooltip
  const tip = $("#tip");
  $("#anChart").addEventListener("mousemove", (e) => {
    const bar = e.target.closest(".bar");
    if (!bar) return (tip.hidden = true);
    tip.innerHTML = `<small>${bar.dataset.tip}</small><strong>${bar.dataset.val}</strong>`;
    tip.style.left = e.clientX + "px";
    tip.style.top = e.clientY - 6 + "px";
    tip.hidden = false;
  });
  $("#anChart").addEventListener("mouseleave", () => (tip.hidden = true));

  /* ----- printing the report: PDF / PNG / JPEG ----- */
  function collectReport() {
    const b = buildBuckets();
    return { b, s: periodStats(b.win), k: kpiValues(), generated: new Date() };
  }

  function drawReport(canvas, r) {
    const W = 1240, H = 1754, S = 2;
    canvas.width = W * S;
    canvas.height = H * S;
    const c = canvas.getContext("2d");
    c.scale(S, S);
    const SERIF = 'Georgia, "Times New Roman", serif';
    const SANS = '"Segoe UI", Arial, Helvetica, sans-serif';
    const M = 70;
    const GOLD = "#b89b72", GOLD2 = "#927751", INK = "#211c18", TAUPE = "#756b61", LINE = "#ddd3c4";

    const txt = (s, x, y, o = {}) => {
      c.font = o.font || `16px ${SANS}`;
      c.fillStyle = o.color || INK;
      c.textAlign = o.align || "left";
      c.textBaseline = "alphabetic";
      if ("letterSpacing" in c) c.letterSpacing = o.ls || "0px";
      c.fillText(s, x, y);
      if ("letterSpacing" in c) c.letterSpacing = "0px";
    };
    const fit = (s, maxW, font) => {
      c.font = font;
      if (c.measureText(s).width <= maxW) return s;
      while (s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1);
      return s + "…";
    };
    const rr = (x, y, w, h, rad) => {
      c.beginPath();
      c.moveTo(x + rad, y);
      c.arcTo(x + w, y, x + w, y + h, rad);
      c.arcTo(x + w, y + h, x, y + h, rad);
      c.arcTo(x, y + h, x, y, rad);
      c.arcTo(x, y, x + w, y, rad);
      c.closePath();
    };
    const bottle = (x, y, h, alpha) => {
      const w = h * 0.6;
      c.save();
      c.globalAlpha = alpha;
      c.strokeStyle = "#e6cfa2";
      c.lineWidth = 2;
      rr(x + w * 0.35, y, w * 0.3, h * 0.16, 3); c.stroke();
      c.strokeRect(x + w * 0.43, y + h * 0.16, w * 0.14, h * 0.07);
      rr(x, y + h * 0.26, w, h * 0.74, h * 0.12); c.stroke();
      rr(x + w * 0.18, y + h * 0.54, w * 0.64, h * 0.24, 3); c.stroke();
      c.restore();
    };
    const title = (s, y) => {
      txt(s, M, y, { font: `26px ${SERIF}` });
      c.fillStyle = GOLD;
      c.fillRect(M, y + 10, 60, 2);
    };

    // page + header
    c.fillStyle = "#f7f3ed";
    c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, 190);
    g.addColorStop(0, "#211c18");
    g.addColorStop(0.6, "#4a3626");
    g.addColorStop(1, "#a97a43");
    c.fillStyle = g;
    c.fillRect(0, 0, W, 190);
    bottle(W - 330, 28, 140, 0.55);
    bottle(W - 250, 48, 120, 0.4);
    bottle(W - 175, 22, 150, 0.6);
    txt("MAISON RÉVE", M, 88, { font: `46px ${SERIF}`, color: "#ffffff", ls: "7px" });
    txt("SCENT  •  SALES ANALYTICS REPORT", M, 128, { font: `15px ${SANS}`, color: "#e6d3b0", ls: "5px" });
    txt("Stock Control with Earnings Notification Tracker", M, 156, { font: `italic 15px ${SERIF}`, color: "#d9c9ad" });

    // period line
    txt("REPORT PERIOD", M, 246, { font: `bold 12px ${SANS}`, color: GOLD2, ls: "4px" });
    txt(r.b.periodLabel, M, 284, { font: `30px ${SERIF}` });
    const gen = r.generated.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    txt(`Prepared by ${me.username} (${me.email})  •  Generated ${gen}`, M, 312, { font: `14px ${SANS}`, color: TAUPE });

    // stat boxes
    const box = (x, y, w, h, label, value, sub, dark) => {
      c.fillStyle = dark ? "#2b2119" : "#ffffff";
      c.fillRect(x, y, w, h);
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      c.fillStyle = dark ? "#d9bf91" : GOLD;
      c.fillRect(x, y, w, 4);
      txt(label.toUpperCase(), x + 18, y + 34, { font: `bold 11.5px ${SANS}`, color: dark ? "#d9bf91" : GOLD2, ls: "2px" });
      txt(value, x + 18, y + 74, { font: `32px ${SERIF}`, color: dark ? "#ffffff" : INK });
      txt(fit(sub, w - 36, `13px ${SANS}`), x + 18, y + 98, { font: `13px ${SANS}`, color: dark ? "#d8ccba" : TAUPE });
    };
    const bw = (W - 2 * M - 3 * 18) / 4;
    const row = (y, items) => items.forEach((it, i) => box(M + i * (bw + 18), y, bw, 116, ...it));

    txt("Income snapshot", M, 372, { font: `bold 13px ${SANS}`, color: GOLD2, ls: "3px" });
    row(386, [
      ["Today’s income", peso(r.k.today), "Sales recorded today"],
      ["This week", peso(r.k.week), "Monday to Sunday"],
      [`This year (${r.k.yearLabel})`, peso(r.k.year), "Annual income so far"],
      ["Total revenue", peso(r.k.total), `${r.k.count.toLocaleString("en-PH")} transactions overall`, true],
    ]);
    txt("Selected period", M, 546, { font: `bold 13px ${SANS}`, color: GOLD2, ls: "3px" });
    row(560, [
      ["Revenue in period", peso(r.s.revenue), "Total sales value", true],
      ["Average order sum", peso(r.s.avg), "Revenue ÷ transactions"],
      ["Total quantity sold", r.s.qty.toLocaleString("en-PH"), "Units deducted from stock"],
      ["Transactions", r.s.orders.toLocaleString("en-PH"), "Recorded in this period"],
    ]);

    // chart
    title(`${r.b.title}`, 726);
    txt(`Bars show income ${r.b.group}`, W - M, 724, { font: `14px ${SANS}`, color: TAUPE, align: "right" });
    const cx = M + 66, cy = 760, cw = W - 2 * M - 66, ch = 230;
    const bars = r.b.bars;
    const maxV = niceMax(Math.max(...bars.map((b) => b.value), 0));
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = cy + ch - (ch * i) / 4;
      c.beginPath();
      c.moveTo(cx, y);
      c.lineTo(cx + cw, y);
      c.stroke();
      txt(abbr((maxV * i) / 4), cx - 10, y + 4, { font: `12px ${SANS}`, color: TAUPE, align: "right" });
    }
    const band = cw / bars.length, barW = Math.min(band * 0.64, 40), step = Math.ceil(bars.length / 12);
    const bg = c.createLinearGradient(0, cy, 0, cy + ch);
    bg.addColorStop(0, "#cfae7e");
    bg.addColorStop(1, "#927751");
    bars.forEach((b, i) => {
      const h = (b.value / maxV) * ch;
      const x = cx + band * i + (band - barW) / 2;
      c.fillStyle = bg;
      if (h > 0) {
        rr(x, cy + ch - h, barW, h, Math.min(3, h / 2));
        c.fill();
      }
      if (i % step === 0) txt(b.label, x + barW / 2, cy + ch + 24, { font: `12px ${SANS}`, color: TAUPE, align: "center" });
    });
    if (!bars.some((b) => b.value > 0))
      txt("No sales recorded in this period", cx + cw / 2, cy + ch / 2, { font: `italic 22px ${SERIF}`, color: TAUPE, align: "center" });

    // top 5
    title("Top 5 most selling products", 1076);
    const maxQ = Math.max(...r.s.top.map((t) => t.qty), 1);
    if (!r.s.top.length) txt("No sales in this period.", M, 1126, { font: `italic 18px ${SERIF}`, color: TAUPE });
    r.s.top.forEach((t, i) => {
      const y = 1112 + i * 46;
      txt(String(i + 1).padStart(2, "0"), M, y + 30, { font: `26px ${SERIF}`, color: GOLD });
      txt(fit(t.name, 330, `bold 18px ${SANS}`), M + 56, y + 22, { font: `bold 18px ${SANS}` });
      txt(`${t.qty} unit${t.qty === 1 ? "" : "s"} sold`, M + 56, y + 40, { font: `13px ${SANS}`, color: TAUPE });
      c.fillStyle = "#e9dfd0";
      c.fillRect(M + 420, y + 14, 480, 10);
      c.fillStyle = "#a98655";
      c.fillRect(M + 420, y + 14, (t.qty / maxQ) * 480, 10);
      txt(peso(t.revenue), W - M, y + 26, { font: `bold 18px ${SANS}`, align: "right" });
    });

    // transactions
    title("Latest transactions", 1396);
    const ty = 1424;
    c.fillStyle = "#efe8de";
    c.fillRect(M, ty, W - 2 * M, 32);
    const cols = [M + 14, M + 150, M + 420, W - M - 150, W - M - 14];
    ["ID", "DATE & TIME", "PRODUCT", "QTY", "TOTAL"].forEach((h, i) =>
      txt(h, cols[i], ty + 21, { font: `bold 11.5px ${SANS}`, color: TAUPE, ls: "2px", align: i >= 3 ? "right" : "left" }),
    );
    const rows = r.s.latest.slice(0, Math.floor((H - 78 - 12 - (ty + 32)) / 34)); // keep rows above the footer
    if (!rows.length) txt("No transactions in this period.", M + 14, ty + 58, { font: `italic 16px ${SERIF}`, color: TAUPE });
    rows.forEach((t, i) => {
      const y = ty + 32 + i * 34;
      c.fillStyle = i % 2 ? "#faf6f0" : "#ffffff";
      c.fillRect(M, y, W - 2 * M, 34);
      txt(txId(t), cols[0], y + 23, { font: `14.5px ${SANS}` });
      txt(fmtDateTime(t.ts), cols[1], y + 23, { font: `14.5px ${SANS}` });
      txt(fit(t.name, 330, `14.5px ${SANS}`), cols[2], y + 23, { font: `14.5px ${SANS}` });
      txt(String(t.qty), cols[3], y + 23, { font: `14.5px ${SANS}`, align: "right" });
      txt(peso(t.total), cols[4], y + 23, { font: `bold 14.5px ${SANS}`, align: "right" });
    });
    c.strokeStyle = LINE;
    c.strokeRect(M + 0.5, ty + 0.5, W - 2 * M - 1, 32 + Math.max(rows.length, 1) * 34);

    // footer
    c.fillStyle = GOLD;
    c.fillRect(M, H - 78, W - 2 * M, 1);
    txt("Maison Réve  •  SCENT Administrator Report", M, H - 46, { font: `13px ${SANS}`, color: TAUPE });
    txt("Confidential — for internal use", W - M, H - 46, { font: `13px ${SANS}`, color: TAUPE, align: "right" });
  }

  // a tiny PDF writer: one A4 page that holds the report picture
  function pdfFromJpeg(jpeg, w, h) {
    const PW = 595.28, PH = 841.89;
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let len = 0;
    const push = (x) => {
      const b = typeof x === "string" ? enc.encode(x) : x;
      parts.push(b);
      len += b.length;
    };
    const obj = (n, body) => {
      offsets[n] = len;
      push(`${n} 0 obj\n${body}\nendobj\n`);
    };
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = len;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push("\nendstream\nendobj\n");
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    let x = "xref\n0 6\n0000000000 65535 f \n";
    for (let n = 1; n <= 5; n++) x += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    push(x);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len);
    let p = 0;
    parts.forEach((b) => {
      out.set(b, p);
      p += b.length;
    });
    return out;
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function exportReport(kind) {
    if ($("#anError").textContent) return toast("Fix the date range first.", "error");
    try {
      const canvas = document.createElement("canvas");
      drawReport(canvas, collectReport());
      const stamp = ymd(new Date());
      const base = `Maison-Reve-Sales-Report-${stamp}`;
      if (kind === "png") {
        canvas.toBlob((b) => download(b, base + ".png"), "image/png");
      } else if (kind === "jpeg") {
        canvas.toBlob((b) => download(b, base + ".jpg"), "image/jpeg", 0.93);
      } else {
        const b64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        download(new Blob([pdfFromJpeg(bytes, canvas.width, canvas.height)], { type: "application/pdf" }), base + ".pdf");
      }
      toast(`Report exported as ${kind.toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      toast("Sorry, the report could not be created.", "error");
    }
  }
  $$("[data-export]").forEach((b) => b.addEventListener("click", () => exportReport(b.dataset.export)));

  /* =========================================================
     TAB 4 — ACCOUNTS
     ========================================================= */
  const isOwner = !!me.owner; // only the owner may create, edit or delete accounts

  function renderAccounts() {
    const list = Store.getAccounts();
    $("#acCount").textContent = `${list.length} registered administrator account${list.length === 1 ? "" : "s"}`;
    $("#acAdd").hidden = !isOwner;
    $("#acNote").hidden = isOwner;
    $(".ac-actions-th").hidden = !isOwner;
    const d = (s) => (s ? fmtFull(typeof s === "number" ? new Date(s) : parseYmd(s)) : "—");
    $("#acBody").innerHTML = list
      .map((a) => {
        const actions = isOwner
          ? `<td class="actions"><button class="icon-btn edit" data-act="edit">Edit</button><button class="icon-btn del" data-act="delete" ${a.owner ? 'disabled title="The owner account cannot be deleted"' : ""}>Delete</button></td>`
          : "";
        return `<tr data-id="${a.id}">
        <td><img class="avatar" src="${avatarSrc(a)}" alt="${esc(a.name)}"></td>
        <td><strong>${esc(a.name)}</strong>${a.owner ? '<span class="badge-owner">OWNER</span>' : ""}${a.email === me.email ? '<span class="badge-you">YOU</span>' : ""}</td>
        <td>${esc(a.username)}</td><td>${esc(a.email)}</td>
        <td>${d(a.registered)}</td>
        <td>${a.lastLogin ? fmtDateTime(a.lastLogin) : "—"}</td>
        <td><span class="pill high">${esc(a.status)}</span></td>${actions}</tr>`;
      })
      .join("");
  }

  /* ----- owner-only: add / edit / delete accounts ----- */
  const ac = {
    dlg: $("#accountDialog"), form: $("#acForm"), name: $("#acName"), user: $("#acUser"),
    email: $("#acEmail"), pass: $("#acPass"), file: $("#acPhoto"), preview: $("#acPreview"), error: $("#acError"),
  };
  let acEditingId = null;
  let acPhoto = null; // data URL of a newly chosen photo

  function openAccountDialog(id) {
    if (!isOwner) return;
    acEditingId = id || null;
    acPhoto = null;
    ac.error.textContent = "";
    ac.file.value = "";
    const a = id ? Store.getAccounts().find((x) => x.id === id) : null;
    $("#acEyebrow").textContent = a ? "EDIT ACCOUNT" : "NEW ACCOUNT";
    $("#acTitle").textContent = a ? "Update Account" : "Add Account";
    $("#acSubmit").textContent = a ? "Save Changes" : "Save Account";
    $("#acPassLabel").textContent = a ? "New password (leave blank to keep the current one)" : "Password *";
    ac.name.value = a ? a.name : "";
    ac.user.value = a ? a.username : "";
    ac.email.value = a ? a.email : "";
    ac.pass.value = "";
    ac.preview.src = avatarSrc(a || { email: "new@account" });
    ac.dlg.showModal();
    ac.name.focus();
  }

  ac.file.addEventListener("change", () => {
    const f = ac.file.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return (ac.error.textContent = "Please choose an image file.");
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const size = 200, c = document.createElement("canvas");
        c.width = c.height = size;
        const x = c.getContext("2d"), m = Math.min(im.width, im.height) || size;
        x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, size, size); // square crop
        acPhoto = c.toDataURL("image/jpeg", 0.85);
        ac.preview.src = acPhoto;
        ac.error.textContent = "";
      };
      im.onerror = () => (ac.error.textContent = "That image could not be read.");
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  $("#acAdd").addEventListener("click", () => openAccountDialog(null));

  ac.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isOwner) return;
    const err = (m) => (ac.error.textContent = m);
    const name = ac.name.value.trim(), username = ac.user.value.trim();
    const email = ac.email.value.trim().toLowerCase(), pass = ac.pass.value;
    const list = Store.getAccounts();
    if (!name) return err("Please enter the full name.");
    if (!/^[\w.-]{3,20}$/.test(username)) return err("Username must be 3–20 letters, numbers, dots, dashes or underscores.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Please enter a valid email address.");
    if (list.some((a) => a.id !== acEditingId && a.email.toLowerCase() === email)) return err("That email is already registered.");
    if (list.some((a) => a.id !== acEditingId && a.username.toLowerCase() === username.toLowerCase())) return err("That username is already taken.");
    if (!acEditingId && pass.length < 6) return err("Password must be at least 6 characters.");
    if (acEditingId && pass && pass.length < 6) return err("The new password must be at least 6 characters.");

    let next, ownEmailChanged = false;
    if (acEditingId) {
      next = list.map((a) => {
        if (a.id !== acEditingId) return a;
        ownEmailChanged = a.email === me.email && email !== me.email;
        return { ...a, name, username, email, ...(pass ? { password: pass } : {}), ...(acPhoto ? { photo: acPhoto } : {}) };
      });
    } else {
      const id = list.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      next = [...list, { id, name, username, email, password: pass, registered: new Date().toISOString().slice(0, 10), lastLogin: null, status: "Active", owner: false, ...(acPhoto ? { photo: acPhoto } : {}) }];
    }
    if (!Store.saveAccounts(next)) return err("Browser storage is full. Try a smaller photo.");
    ac.dlg.close();
    if (ownEmailChanged) {
      sessionStorage.setItem("scentAdminEmail", email); // keep the owner signed in
      location.reload();
      return;
    }
    renderAccounts();
    toast(acEditingId ? `“${name}” updated.` : `Account “${name}” created.`);
  });

  $("#acBody").addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]");
    if (!act || !isOwner || act.disabled) return;
    const id = +act.closest("tr").dataset.id;
    if (act.dataset.act === "edit") return openAccountDialog(id);
    const a = Store.getAccounts().find((x) => x.id === id);
    if (!a || a.owner) return;
    const ok = await confirmAction({
      title: "Delete account",
      message: `You are about to delete the account of “${a.name}” (${a.email}). They will no longer be able to sign in. This cannot be undone.`,
      confirmText: "Confirm Delete",
      tone: "danger",
    });
    if (!ok) return;
    Store.saveAccounts(Store.getAccounts().filter((x) => x.id !== id));
    renderAccounts();
    toast(`Account “${a.name}” deleted.`);
  });

  $("#resetDemo").addEventListener("click", async () => {
    const ok = await confirmAction({
      title: "Reset demo data",
      message: "This restores the sample products, transactions and accounts. Any products you added and sales you recorded will be lost.",
      confirmText: "Confirm Reset",
      tone: "danger",
    });
    if (!ok) return;
    Store.reset();
    location.reload();
  });

  /* ---------- start ---------- */
  const saved = sessionStorage.getItem("scentTab");
  switchTab(renderers[saved] ? saved : "inventory");
})();
