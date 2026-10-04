// Products come from the shared store (js/store.js), so changes made in the
// administrator dashboard (new products, stock deductions, sales) show up here.
const categories = Store.categories;
const products = Store.getProducts();
const peso = (n) => "₱" + n.toLocaleString("en-PH");
const img = (p) =>
  p.image ||
  (p.id <= 50
    ? "assets/products/product-" + String(p.id).padStart(2, "0") + ".svg"
    : "assets/logo.svg");
function renderTopFive() {
  const list = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  document.querySelector("#topFive").innerHTML = list
    .map(
      (p, i) =>
        `<article class="top-card" data-id="${p.id}"><span class="rank">${String(i + 1).padStart(2, "0")}</span><img class="top-img" src="${img(p)}" alt="${p.name}"><div class="top-info"><h3>${p.name}</h3><p>${p.family} • ${p.category}</p><span class="price">${peso(p.price)}</span></div></article>`,
    )
    .join("");
  document
    .querySelectorAll(".top-card")
    .forEach((c) => (c.onclick = () => open(+c.dataset.id)));
}
function render(list = products) {
  document.querySelector("#count").textContent = list.length;
  document.querySelector("#empty").hidden = !!list.length;
  document.querySelector("#grid").innerHTML = list
    .map(
      (p) =>
        `<article class="product-card" data-id="${p.id}"><div class="image-wrap"><img class="product-img" src="${img(p)}" alt="${p.name} perfume bottle"><span class="stock ${p.stock <= 6 ? "low" : ""}">${p.stock <= 6 ? "Only " : ""}${p.stock} stock${p.stock === 1 ? "" : "s"}</span></div><div class="info"><div class="family">${p.family} • ${p.category}</div><h3>${p.name}</h3><p class="desc">${p.description}</p><div class="bottom"><strong class="price">${peso(p.price)}</strong><span class="view">View details →</span></div></div></article>`,
    )
    .join("");
  document
    .querySelectorAll(".product-card")
    .forEach((c) => (c.onclick = () => open(+c.dataset.id)));
}
function filter() {
  const q = document.querySelector("#search").value.toLowerCase();
  const s = document.querySelector("#sort").value;
  let list = products.filter((p) =>
    `${p.name} ${p.family} ${p.category} ${p.notes}`.toLowerCase().includes(q),
  );
  if (categories.includes(s)) list = list.filter((p) => p.category === s);
  if (s === "low") list.sort((a, b) => a.price - b.price);
  if (s === "high") list.sort((a, b) => b.price - a.price);
  if (s === "stock") list.sort((a, b) => a.stock - b.stock);
  render(list);
}
function open(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  document.querySelector("#mi").src = img(p);
  document.querySelector("#mi").alt = p.name;
  document.querySelector("#mc").textContent = p.category;
  document.querySelector("#mn").textContent = p.name;
  document.querySelector("#mf").textContent =
    `${p.family} fragrance • ${p.size}`;
  document.querySelector("#md").textContent = p.description;
  document.querySelector("#mnotes").textContent = p.notes;
  document.querySelector("#mp").textContent = peso(p.price);
  document.querySelector("#ms").textContent = p.size;
  document.querySelector("#mst").textContent = p.stock;
  document.querySelector("#modal").classList.add("show");
  document.body.style.overflow = "hidden";
}
function close() {
  document.querySelector("#modal").classList.remove("show");
  document.body.style.overflow = "";
}
document.addEventListener("DOMContentLoaded", () => {
  renderTopFive();
  render();

  document.querySelector("#search").addEventListener("input", filter);
  document.querySelector("#sort").addEventListener("change", filter);
  document.querySelector("#close").addEventListener("click", close);
  document.querySelector("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // SECRET LOGIN: exactly five clicks on the Maison Réve logo.
  // The counter resets if the five clicks are not completed quickly enough.
  let secretClicks = 0;
  let secretTimer = null;
  const secretLogo = document.querySelector("#secretLogo");
  const clickHint = document.querySelector("#secretClickHint");

  secretLogo.addEventListener("click", () => {
    secretClicks += 1;
    clearTimeout(secretTimer);
    if (clickHint && secretClicks < 5) {
      clickHint.textContent = `Maison Réve • ${secretClicks}/5`;
      clickHint.classList.add("visible");
      setTimeout(() => clickHint.classList.remove("visible"), 1000);
    }
    secretTimer = setTimeout(() => {
      secretClicks = 0;
    }, 2500);
    if (secretClicks === 5) {
      secretClicks = 0;
      openLogin();
    }
  });

  // Keyboard accessibility: focus the logo and press Enter five times.
  secretLogo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      secretLogo.click();
    }
  });

  // ---------- FLOATING LOGIN PANEL ----------
  const lg = {
    overlay: document.querySelector("#lgOverlay"),
    form: document.querySelector("#lgForm"),
    email: document.querySelector("#lgEmail"),
    password: document.querySelector("#lgPassword"),
    otp: document.querySelector("#lgOtp"),
    status: document.querySelector("#lgOtpStatus"),
    demoOtp: document.querySelector("#lgDemoOtp"),
    error: document.querySelector("#lgError"),
  };
  const lgBackdrop = lg.overlay.querySelector(".lg-backdrop");
  let generatedOtp = "";
  let otpExpires = 0;
  let lgBusy = false;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function resetLoginForm() {
    lg.form.reset();
    generatedOtp = "";
    otpExpires = 0;
    lg.status.textContent = "";
    lg.status.className = "lg-otp-status";
    lg.demoOtp.hidden = true;
    lg.demoOtp.textContent = "";
    lg.error.textContent = "";
  }

  function openLogin() {
    if (lgBusy || lg.overlay.classList.contains("active")) return;
    lgBusy = true;

    // The reveal expands outward from the logo the owner just clicked.
    const r = secretLogo.getBoundingClientRect();
    lg.overlay.style.setProperty("--ox", r.left + r.width / 2 + "px");
    lg.overlay.style.setProperty("--oy", r.top + r.height / 2 + "px");

    secretLogo.classList.add("pulse");
    lg.overlay.classList.remove("closing", "show");
    lg.overlay.classList.add("active", "opening");
    lg.overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    setTimeout(
      () => {
        secretLogo.classList.remove("pulse");
        lg.overlay.classList.remove("opening");
        lg.overlay.classList.add("show");
        lgBusy = false;
        setTimeout(() => lg.email.focus(), reduceMotion ? 0 : 450);
      },
      reduceMotion ? 0 : 1100,
    );
  }

  function closeLogin() {
    if (lgBusy || !lg.overlay.classList.contains("show")) return;
    lg.overlay.classList.add("closing");
    setTimeout(
      () => {
        lg.overlay.classList.remove("active", "show", "closing", "opening");
        lg.overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        resetLoginForm();
      },
      reduceMotion ? 0 : 350,
    );
  }

  document.querySelector("#lgClose").addEventListener("click", closeLogin);
  lg.overlay.addEventListener("click", (e) => {
    if (e.target === lg.overlay || e.target === lgBackdrop) closeLogin();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLogin();
  });

  document.querySelector("#lgSendOtp").addEventListener("click", () => {
    if (!Store.accountByEmail(lg.email.value)) {
      lg.status.textContent = "Enter a registered administrator email first.";
      lg.status.className = "lg-otp-status bad";
      return;
    }
    generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    otpExpires = Date.now() + 5 * 60 * 1000;
    lg.demoOtp.hidden = false;
    lg.demoOtp.textContent = "DEMO EMAIL OTP: " + generatedOtp;
    lg.status.textContent =
      "A one-time verification code has been generated for the administrator email.";
    lg.status.className = "lg-otp-status good";
  });

  lg.form.addEventListener("submit", (e) => {
    e.preventDefault();
    lg.error.textContent = "";
    const account = Store.findAccount(lg.email.value, lg.password.value);
    if (!account) {
      lg.error.textContent = "Incorrect email or password.";
      return;
    }
    if (!generatedOtp) {
      lg.error.textContent = "Please click Send OTP before signing in.";
      return;
    }
    if (Date.now() > otpExpires) {
      lg.error.textContent = "The OTP has expired. Please request a new code.";
      return;
    }
    if (lg.otp.value.trim() !== generatedOtp) {
      lg.error.textContent = "Invalid OTP verification code.";
      return;
    }
    sessionStorage.setItem("scentLoggedIn", "true");
    sessionStorage.setItem("scentAdminEmail", account.email.toLowerCase());
    Store.touchLogin(account.email);
    playWelcome(account);
  });

  // Elegant "welcome" transition, then on to the administrator dashboard.
  function playWelcome(account) {
    const w = document.querySelector("#welcome");
    document.querySelector("#welcomeName").textContent =
      account.username || account.name;
    w.classList.add("active");
    w.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(
      () => {
        window.location.href = "dashboard.html";
      },
      reduceMotion ? 300 : 3000,
    );
  }

  // Visiting login.html (or index.html#login) opens the panel directly.
  if (location.hash === "#login") {
    history.replaceState(null, "", location.pathname);
    openLogin();
  }

  const links = [...document.querySelectorAll(".header nav a")];
  const secs = ["home", "fragrance", "about"].map((id) =>
    document.getElementById(id),
  );
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((x) => x.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        links.forEach((a) =>
          a.classList.toggle(
            "active",
            a.getAttribute("href") === "#" + visible.target.id,
          ),
        );
      }
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.2, 0.5] },
  );
  secs.forEach((s) => observer.observe(s));
});
