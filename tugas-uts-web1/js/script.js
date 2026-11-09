/* =====================================================
   Toko Buku UT — script.js
   Satu file JS untuk semua halaman. Setiap halaman diberi
   <body data-page="..."> sehingga hanya fungsi init halaman itu
   yang dijalankan. Data berasal dari data.js (dataPengguna,
   dataKatalogBuku, dataTracking).
   ===================================================== */
"use strict";

/* ---------- Utilitas ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");
const parseHarga = (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 0;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// localStorage / sessionStorage aman (try/catch bila diblokir browser)
const makeStore = (area) => ({
  get(key, def) {
    try { const v = window[area].getItem(key); return v === null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(key, val) { try { window[area].setItem(key, JSON.stringify(val)); } catch { /* abaikan */ } },
  del(key) { try { window[area].removeItem(key); } catch { /* abaikan */ } },
});
const local = makeStore("localStorage");
const session = makeStore("sessionStorage");

function toast(msg, type = "") {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "show " + type;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = ""), 2800);
}

// Validasi form: tampilkan / hapus pesan error di bawah input
function setError(input, msg) {
  const field = input.closest(".field");
  if (!field) return !msg;
  field.classList.toggle("invalid", Boolean(msg));
  const out = $(".error-msg", field);
  if (out) out.textContent = msg || "";
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  return !msg;
}
const clearErrors = (form) => $$("input, select, textarea", form).forEach((i) => setError(i, ""));

// Modal memakai elemen <dialog>
const openModal = (id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal(); };
const closeModal = (id) => { const d = document.getElementById(id); if (d && d.open) d.close(); };
function initModals() {
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.open)));
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.close)));
  $$("dialog").forEach((d) =>
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); }) // klik backdrop
  );
}

/* ---------- Data pengguna terdaftar (dari data.js + hasil "Daftar") ---------- */
local.get("users", []).forEach((u) => {
  if (!dataPengguna.some((p) => p.email === u.email)) dataPengguna.push(u);
});
// Stok tambahan yang pernah ditambahkan lewat halaman stok
local.get("stokBaru", []).forEach((b) => {
  if (!dataKatalogBuku.some((k) => k.kodeBarang === b.kodeBarang)) dataKatalogBuku.push(b);
});

/* ---------- Sesi & guard ---------- */
const currentUser = () => session.get("user", null);

function guardPage() {
  const user = currentUser();
  if (!user) { window.location.replace("index.html"); return null; }
  const nameEl = $("#userName");
  if (nameEl) nameEl.textContent = user.nama + " (" + user.role + ")";
  const out = $("#btnLogout");
  if (out) out.addEventListener("click", () => {
    if (confirm("Yakin ingin keluar?")) { session.del("user"); window.location.href = "index.html"; }
  });
  return user;
}

const getOrders = () => local.get("pesanan", []);
const ordersOfUser = (user) =>
  getOrders().filter((o) => user.role === "Admin" || o.akun === user.email);

/* =====================================================
   1. LOGIN (index.html)
   ===================================================== */
function initLogin() {
  if (currentUser()) { window.location.replace("dashboard.html"); return; }

  const form = $("#formLogin");
  const email = $("#email");
  const pass = $("#password");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = email.value.trim().toLowerCase();
    const okEmail = setError(email, !v ? "Email wajib diisi." : !EMAIL_RE.test(v) ? "Format email tidak valid." : "");
    const okPass = setError(pass, !pass.value ? "Password wajib diisi." : "");
    if (!okEmail || !okPass) return;

    const user = dataPengguna.find((u) => u.email.toLowerCase() === v && u.password === pass.value);
    if (!user) {
      alert("Email/password yang anda masukkan salah");
      $("#loginError").hidden = false;
      pass.value = "";
      pass.focus();
      return;
    }
    session.set("user", { id: user.id, nama: user.nama, email: user.email, role: user.role });
    window.location.href = "dashboard.html";
  });
  [email, pass].forEach((i) => i.addEventListener("input", () => { $("#loginError").hidden = true; setError(i, ""); }));

  // --- Lupa Password (modal) ---
  const fForm = $("#formLupa");
  fForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#lupaEmail"), msg = $("#lupaMsg");
    const v = inp.value.trim().toLowerCase();
    msg.className = ""; msg.textContent = "";
    if (!setError(inp, !v ? "Email wajib diisi." : !EMAIL_RE.test(v) ? "Format email tidak valid." : "")) return;
    const found = dataPengguna.some((u) => u.email.toLowerCase() === v);
    msg.className = found ? "alert-ok" : "alert-err";
    msg.textContent = found
      ? "Tautan reset password (simulasi) telah dikirim ke " + v + "."
      : "Email tidak terdaftar pada sistem.";
  });

  // --- Daftar (modal) ---
  const rForm = $("#formDaftar");
  rForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nama = $("#regNama"), em = $("#regEmail"), pw = $("#regPass"), pw2 = $("#regPass2");
    const v = em.value.trim().toLowerCase();
    const ok = [
      setError(nama, nama.value.trim().length < 3 ? "Nama minimal 3 karakter." : ""),
      setError(em, !EMAIL_RE.test(v) ? "Format email tidak valid."
        : dataPengguna.some((u) => u.email.toLowerCase() === v) ? "Email sudah terdaftar." : ""),
      setError(pw, pw.value.length < 6 ? "Password minimal 6 karakter." : ""),
      setError(pw2, pw2.value !== pw.value ? "Konfirmasi password tidak sama." : ""),
    ].every(Boolean);
    if (!ok) return;

    const baru = {
      id: dataPengguna.length + 1, nama: nama.value.trim(), email: v, password: pw.value, role: "User",
    };
    dataPengguna.push(baru);
    local.set("users", [...local.get("users", []), baru]);
    rForm.reset();
    closeModal("dlgDaftar");
    email.value = v;
    pass.focus();
    toast("Pendaftaran berhasil! Silakan login.", "ok");
  });

  // bersihkan error saat modal ditutup
  $$("dialog").forEach((d) => d.addEventListener("close", () => {
    const f = $("form", d); if (f) { f.reset(); clearErrors(f); }
    const m = $("#lupaMsg"); if (m) { m.className = ""; m.textContent = ""; }
  }));
}

/* =====================================================
   2. DASHBOARD (dashboard.html)
   ===================================================== */
function greetingByTime(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return { teks: "Selamat Pagi", ikon: "🌅" };
  if (h >= 11 && h < 15) return { teks: "Selamat Siang", ikon: "☀️" };
  if (h >= 15 && h < 18) return { teks: "Selamat Sore", ikon: "🌇" };
  return { teks: "Selamat Malam", ikon: "🌙" };
}

function initDashboard(user) {
  const g = $("#greeting"), clock = $("#clock"), date = $("#dateText");
  const tick = () => {
    const now = new Date();
    const sapa = greetingByTime(now);
    g.textContent = sapa.ikon + " " + sapa.teks + ", " + user.nama.split(" ")[0] + "!";
    clock.firstChild.nodeValue = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    date.textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };
  tick();
  setInterval(tick, 1000);

  const orders = ordersOfUser(user);
  $("#statJudul").textContent = dataKatalogBuku.length;
  $("#statStok").textContent = dataKatalogBuku.reduce((a, b) => a + Number(b.stok), 0).toLocaleString("id-ID");
  $("#statPesanan").textContent = orders.length;
  $("#statBelanja").textContent = rupiah(orders.reduce((a, o) => a + o.total, 0));
}

/* =====================================================
   3. STOK / KATALOG (stok.html)
   ===================================================== */
function statusStok(n) {
  if (n < 100) return ["Kritis", "low"];
  if (n < 250) return ["Menipis", "warn"];
  return ["Tersedia", "ok"];
}

function buildStokRow(item, no) {
  const tr = document.createElement("tr");
  tr.dataset.kode = item.kodeBarang;

  const cell = (text, cls) => { const td = document.createElement("td"); td.textContent = text; if (cls) td.className = cls; return td; };

  tr.appendChild(cell(no, "num"));

  const tdCover = document.createElement("td");
  if (item.cover) {
    const img = document.createElement("img");
    img.src = item.cover; img.alt = "Sampul " + item.namaBarang; img.className = "thumb"; img.loading = "lazy";
    tdCover.appendChild(img);
  } else tdCover.textContent = "—";
  tr.appendChild(tdCover);

  tr.appendChild(cell(item.kodeBarang));
  tr.appendChild(cell(item.namaBarang));
  tr.appendChild(cell(item.jenisBarang));
  tr.appendChild(cell("Edisi " + item.edisi));

  const tdStok = document.createElement("td");
  tdStok.className = "num";
  const [label, kls] = statusStok(Number(item.stok));
  tdStok.append(Number(item.stok).toLocaleString("id-ID") + " ");
  const badge = document.createElement("span");
  badge.className = "badge " + kls; badge.textContent = label;
  tdStok.appendChild(badge);
  tr.appendChild(tdStok);

  tr.appendChild(cell(typeof item.harga === "number" ? rupiah(item.harga) : item.harga, "num"));

  const tdAksi = document.createElement("td");
  if (item.custom) {
    const del = document.createElement("button");
    del.type = "button"; del.className = "btn btn-danger btn-sm"; del.textContent = "Hapus";
    del.dataset.hapus = item.kodeBarang;
    tdAksi.appendChild(del);
  } else tdAksi.textContent = "—";
  tr.appendChild(tdAksi);
  return tr;
}

function initStok() {
  const tbody = $("#bodyStok");
  const info = $("#infoStok");

  function render(filter = "") {
    tbody.replaceChildren();
    const q = filter.trim().toLowerCase();
    const list = dataKatalogBuku.filter((b) => !q || b.namaBarang.toLowerCase().includes(q) || b.kodeBarang.toLowerCase().includes(q));
    if (!list.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = 9; td.className = "empty"; td.textContent = "Tidak ada buku yang cocok.";
      tr.appendChild(td); tbody.appendChild(tr);
    } else list.forEach((b, i) => tbody.appendChild(buildStokRow(b, i + 1)));
    info.textContent = "Menampilkan " + list.length + " dari " + dataKatalogBuku.length + " judul buku";
  }
  render();

  $("#cari").addEventListener("input", (e) => render(e.target.value));

  // pilihan cover dari gambar yang sudah ada
  const selCover = $("#fCover");
  [...new Set(dataKatalogBuku.map((b) => b.cover).filter(Boolean))].forEach((c) => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c.replace("img/", ""); selCover.appendChild(o);
  });

  const form = $("#formStok");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const kode = $("#fKode"), nama = $("#fNama"), edisi = $("#fEdisi"), stok = $("#fStok"), harga = $("#fHarga");
    const k = kode.value.trim().toUpperCase();
    const ok = [
      setError(kode, !/^[A-Z]{4}\d{4}$/.test(k) ? "Format kode: 4 huruf + 4 angka (contoh: EKMA4100)."
        : dataKatalogBuku.some((b) => b.kodeBarang === k) ? "Kode barang sudah ada." : ""),
      setError(nama, nama.value.trim().length < 3 ? "Nama buku minimal 3 karakter." : ""),
      setError(edisi, !(Number(edisi.value) >= 1 && Number.isInteger(Number(edisi.value))) ? "Edisi harus bilangan bulat ≥ 1." : ""),
      setError(stok, !(stok.value !== "" && Number(stok.value) >= 0 && Number.isInteger(Number(stok.value))) ? "Stok harus bilangan bulat ≥ 0." : ""),
      setError(harga, !(Number(harga.value) > 0) ? "Harga harus lebih dari 0." : ""),
    ].every(Boolean);
    if (!ok) { toast("Periksa kembali isian form.", "err"); return; }

    const baru = {
      kodeBarang: k, namaBarang: nama.value.trim(), jenisBarang: $("#fJenis").value,
      edisi: String(edisi.value), stok: Number(stok.value), harga: rupiah(Number(harga.value)),
      cover: selCover.value, custom: true,
    };
    dataKatalogBuku.push(baru);
    local.set("stokBaru", [...local.get("stokBaru", []), baru]);

    $("#cari").value = "";
    render();
    const row = tbody.querySelector('[data-kode="' + k + '"]');
    if (row) { row.classList.add("new-row"); row.scrollIntoView({ behavior: "smooth", block: "center" }); }
    form.reset(); clearErrors(form);
    closeModal("dlgStok");
    toast("Stok baru \"" + baru.namaBarang + "\" berhasil ditambahkan.", "ok");
  });
  $("#dlgStok").addEventListener("close", () => { form.reset(); clearErrors(form); });

  // hapus baris (hanya baris yang ditambahkan pengguna)
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hapus]");
    if (!btn) return;
    const kode = btn.dataset.hapus;
    if (!confirm("Hapus stok " + kode + "?")) return;
    const idx = dataKatalogBuku.findIndex((b) => b.kodeBarang === kode);
    if (idx > -1) dataKatalogBuku.splice(idx, 1);
    local.set("stokBaru", local.get("stokBaru", []).filter((b) => b.kodeBarang !== kode));
    render($("#cari").value);
    toast("Baris stok dihapus.");
  });
}

/* =====================================================
   4. CHECKOUT / PEMESANAN (checkout.html)
   ===================================================== */
function initCheckout(user) {
  let cart = session.get("cart", []); // [{kode, qty}]
  const bySku = (kode) => dataKatalogBuku.find((b) => b.kodeBarang === kode);
  const tbody = $("#bodyPesanan");
  const selBuku = $("#selBuku");

  dataKatalogBuku.forEach((b) => {
    const o = document.createElement("option");
    o.value = b.kodeBarang;
    o.textContent = b.namaBarang + " — " + b.harga + " (stok " + b.stok + ")";
    selBuku.appendChild(o);
  });

  // prefill identitas pemesan dari akun yang login
  $("#pNama").value = user.nama;
  $("#pEmail").value = user.email;

  const total = () => cart.reduce((a, it) => a + parseHarga(bySku(it.kode).harga) * it.qty, 0);

  function renderCart() {
    session.set("cart", cart);
    tbody.replaceChildren();
    if (!cart.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = 5; td.className = "empty"; td.textContent = "Belum ada buku di pesanan. Tambahkan dari form di atas.";
      tr.appendChild(td); tbody.appendChild(tr);
    }
    cart.forEach((it, i) => {
      const b = bySku(it.kode), harga = parseHarga(b.harga);
      const tr = document.createElement("tr");

      const tdNama = document.createElement("td");
      tdNama.textContent = b.namaBarang;
      const kode = document.createElement("small"); kode.style.display = "block"; kode.style.color = "#6b7385"; kode.textContent = b.kodeBarang;
      tdNama.appendChild(kode);

      const tdHarga = document.createElement("td"); tdHarga.className = "num"; tdHarga.textContent = rupiah(harga);

      const tdQty = document.createElement("td");
      const q = document.createElement("input");
      q.type = "number"; q.min = 1; q.max = b.stok; q.value = it.qty; q.className = "qty-input";
      q.setAttribute("aria-label", "Jumlah " + b.namaBarang);
      q.addEventListener("change", () => {
        const n = parseInt(q.value, 10);
        if (!(n >= 1)) { toast("Jumlah minimal 1.", "err"); q.value = it.qty; return; }
        if (n > b.stok) { toast("Stok hanya tersisa " + b.stok + ".", "err"); q.value = it.qty; return; }
        it.qty = n; renderCart();
      });
      tdQty.appendChild(q);

      const tdSub = document.createElement("td"); tdSub.className = "num"; tdSub.textContent = rupiah(harga * it.qty);

      const tdAksi = document.createElement("td");
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn btn-danger btn-sm"; del.textContent = "Hapus";
      del.addEventListener("click", () => { cart.splice(i, 1); renderCart(); });
      tdAksi.appendChild(del);

      tr.append(tdNama, tdHarga, tdQty, tdSub, tdAksi);
      tbody.appendChild(tr);
    });
    $("#totalBayar").textContent = rupiah(total());
    $("#errCart").textContent = "";
  }
  renderCart();

  // tambah item
  $("#formItem").addEventListener("submit", (e) => {
    e.preventDefault();
    const qty = $("#qty");
    const b = bySku(selBuku.value);
    const n = parseInt(qty.value, 10);
    const okBuku = setError(selBuku, !b ? "Pilih buku terlebih dahulu." : "");
    const exist = cart.find((c) => c.kode === selBuku.value);
    const okQty = setError(qty, !(n >= 1) ? "Jumlah minimal 1."
      : b && n + (exist ? exist.qty : 0) > b.stok ? "Melebihi stok (" + b.stok + ")." : "");
    if (!okBuku || !okQty) return;
    if (exist) exist.qty += n; else cart.push({ kode: b.kodeBarang, qty: n });
    renderCart();
    selBuku.value = ""; qty.value = 1;
    toast("Ditambahkan ke pesanan.", "ok");
  });

  // kirim pesanan
  const form = $("#formPemesan");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nama = $("#pNama"), em = $("#pEmail"), tel = $("#pTelp"), alamat = $("#pAlamat"), eks = $("#pEkspedisi");
    const bayar = form.elements["bayar"].value;
    const ok = [
      setError(nama, nama.value.trim().length < 3 ? "Nama minimal 3 karakter." : ""),
      setError(em, !EMAIL_RE.test(em.value.trim()) ? "Format email tidak valid." : ""),
      setError(tel, !/^(\+62|62|0)8\d{8,11}$/.test(tel.value.replace(/[\s-]/g, "")) ? "Nomor HP tidak valid (contoh 081234567890)." : ""),
      setError(alamat, alamat.value.trim().length < 10 ? "Alamat minimal 10 karakter." : ""),
      setError(eks, !eks.value ? "Pilih ekspedisi." : ""),
    ].every(Boolean);
    const okBayar = Boolean(bayar);
    $("#errBayar").textContent = okBayar ? "" : "Pilih metode pembayaran.";
    const okCart = cart.length > 0;
    $("#errCart").textContent = okCart ? "" : "Pesanan masih kosong.";
    if (!ok || !okBayar || !okCart) { toast("Data pesanan belum lengkap.", "err"); return; }

    const orders = getOrders();
    let nomor;
    do { nomor = "2025" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"); }
    while (orders.some((o) => o.nomorDO === nomor) || dataTracking[nomor]);

    const sekarang = new Date();
    const order = {
      nomorDO: nomor, akun: user.email, tanggal: sekarang.toISOString(),
      nama: nama.value.trim(), email: em.value.trim(), telepon: tel.value.trim(), alamat: alamat.value.trim(),
      ekspedisi: eks.value, pembayaran: bayar, total: total(),
      items: cart.map((c) => { const b = bySku(c.kode); return { kode: b.kodeBarang, nama: b.namaBarang, harga: parseHarga(b.harga), qty: c.qty }; }),
    };
    orders.push(order);
    local.set("pesanan", orders);

    $("#sukDO").textContent = nomor;
    $("#sukTotal").textContent = rupiah(order.total);
    $("#sukBayar").textContent = bayar;
    $("#linkLacak").href = "tracking.html?do=" + nomor;
    cart = []; renderCart();
    form.reset(); clearErrors(form);
    $("#pNama").value = user.nama; $("#pEmail").value = user.email;
    openModal("dlgSukses");
  });
}

/* =====================================================
   5. TRACKING (tracking.html)
   ===================================================== */
const LANGKAH = ["Diproses", "Dikirim", "Dalam Perjalanan", "Diterima"];

function langkahAktif(t) {
  const last = t.perjalanan.length ? t.perjalanan[t.perjalanan.length - 1].keterangan : "";
  if (/^selesai/i.test(last)) return 4;
  if (/perjalanan/i.test(t.status)) return 3;
  if (/dikirim/i.test(t.status)) return 2;
  return 1;
}

// cari di data.js dulu, lalu di pesanan yang dibuat lewat checkout
function cariPengiriman(nomor) {
  if (dataTracking[nomor]) return dataTracking[nomor];
  const o = getOrders().find((x) => x.nomorDO === nomor);
  if (!o) return null;
  const tgl = o.tanggal.slice(0, 10);
  return {
    nomorDO: o.nomorDO, nama: o.nama, status: "Diproses", ekspedisi: o.ekspedisi, tanggalKirim: tgl,
    paket: o.items.reduce((a, i) => a + i.qty, 0) + " buku (" + o.items.length + " judul)",
    total: rupiah(o.total),
    perjalanan: [{ waktu: tgl + " " + o.tanggal.slice(11, 19), keterangan: "Pesanan diterima dan sedang disiapkan oleh gudang." }],
  };
}

function initTracking() {
  const form = $("#formTracking"), input = $("#nomorDO"), out = $("#hasil");

  function tampil(nomor) {
    out.replaceChildren();
    const t = cariPengiriman(nomor);
    if (!t) {
      const d = document.createElement("div");
      d.className = "alert-err"; d.setAttribute("role", "alert");
      d.textContent = "Nomor Delivery Order \"" + nomor + "\" tidak ditemukan. Periksa kembali nomor Anda.";
      out.appendChild(d);
      return;
    }
    const step = langkahAktif(t);
    const warna = step === 4 ? "ok" : step === 3 ? "info" : "warn";

    const card = document.createElement("article");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "result-head";
    const h = document.createElement("h2"); h.textContent = "DO " + t.nomorDO;
    const badge = document.createElement("span"); badge.className = "badge " + warna; badge.textContent = step === 4 ? "Selesai" : t.status;
    head.append(h, badge);

    const dl = document.createElement("dl"); dl.className = "detail-list";
    [["Nama Pemesan", t.nama], ["Ekspedisi", t.ekspedisi], ["Tanggal Kirim", new Date(t.tanggalKirim).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
     ["Jenis Paket", t.paket], ["Total Pembayaran", t.total]].forEach(([k, v]) => {
      const box = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      box.append(dt, dd); dl.appendChild(box);
    });

    // progress bar + langkah
    const bar = document.createElement("div");
    bar.className = "progress"; bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", 0); bar.setAttribute("aria-valuemax", 100); bar.setAttribute("aria-valuenow", step * 25);
    const fill = document.createElement("span"); bar.appendChild(fill);

    const ol = document.createElement("ol"); ol.className = "steps";
    LANGKAH.forEach((l, i) => {
      const li = document.createElement("li");
      li.dataset.n = i + 1; li.textContent = l;
      if (i < step) li.classList.add("done");
      ol.appendChild(li);
    });

    const hj = document.createElement("h3"); hj.textContent = "Riwayat Perjalanan"; hj.style.marginTop = "1.4rem";
    const tl = document.createElement("ul"); tl.className = "timeline";
    [...t.perjalanan].reverse().forEach((p) => {
      const li = document.createElement("li");
      const time = document.createElement("time"); time.textContent = p.waktu;
      li.append(time, document.createTextNode(p.keterangan));
      tl.appendChild(li);
    });

    card.append(head, bar, ol, dl, hj, tl);
    out.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = step * 25 + "%")));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!setError(input, !v ? "Nomor Delivery Order wajib diisi." : !/^\d{6,12}$/.test(v) ? "Nomor DO terdiri dari 6–12 angka." : "")) {
      out.replaceChildren(); return;
    }
    tampil(v);
  });

  const q = new URLSearchParams(window.location.search).get("do");
  if (q) { input.value = q; tampil(q); }

  $$("[data-contoh]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.contoh; setError(input, ""); tampil(b.dataset.contoh); }));
}

/* =====================================================
   6. LAPORAN PEMESANAN (laporan.html)
   ===================================================== */
function initLaporan(user) {
  const orders = ordersOfUser(user);
  const perBuku = {};
  orders.forEach((o) => o.items.forEach((i) => {
    const r = perBuku[i.kode] || (perBuku[i.kode] = { nama: i.nama, qty: 0, nilai: 0 });
    r.qty += i.qty; r.nilai += i.qty * i.harga;
  }));
  const rows = Object.values(perBuku).sort((a, b) => b.nilai - a.nilai);

  $("#lapPesanan").textContent = orders.length;
  $("#lapItem").textContent = rows.reduce((a, r) => a + r.qty, 0);
  $("#lapNilai").textContent = rupiah(rows.reduce((a, r) => a + r.nilai, 0));
  $("#lapLingkup").textContent = user.role === "Admin" ? "Semua pengguna (Admin)" : "Akun Anda";

  const tbody = $("#bodyLaporan");
  tbody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 4; td.className = "empty"; td.textContent = "Belum ada data pemesanan. Buat pesanan di halaman Pemesanan.";
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  const max = Math.max(...rows.map((r) => r.nilai));
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const c = (t, cls) => { const td = document.createElement("td"); td.textContent = t; if (cls) td.className = cls; return td; };
    const tdBar = document.createElement("td");
    tdBar.style.minWidth = "160px";
    const bar = document.createElement("div"); bar.className = "progress";
    const f = document.createElement("span"); f.style.width = Math.round((r.nilai / max) * 100) + "%"; bar.appendChild(f);
    tdBar.appendChild(bar);
    tr.append(c(r.nama), c(r.qty, "num"), c(rupiah(r.nilai), "num"), tdBar);
    tbody.appendChild(tr);
  });
}

/* =====================================================
   7. HISTORY TRANSAKSI (history.html)
   ===================================================== */
function initHistory(user) {
  const tbody = $("#bodyHistory");
  const mine = ordersOfUser(user).map((o) => ({
    nomorDO: o.nomorDO, tanggal: o.tanggal.slice(0, 10), ringkas: o.items.map((i) => i.qty + "× " + i.nama).join(", "),
    total: rupiah(o.total), status: "Diproses", order: o,
  }));
  // transaksi contoh dari data.js milik pengguna yang sama
  const contoh = Object.values(dataTracking)
    .filter((t) => user.role === "Admin" || t.nama === user.nama)
    .map((t) => ({ nomorDO: t.nomorDO, tanggal: t.tanggalKirim, ringkas: "Paket " + t.paket + " (" + t.ekspedisi + ")", total: t.total, status: langkahAktif(t) === 4 ? "Selesai" : t.status }));
  const rows = [...mine.reverse(), ...contoh];

  tbody.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 6; td.className = "empty"; td.textContent = "Belum ada transaksi.";
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const c = (t, cls) => { const td = document.createElement("td"); td.textContent = t; if (cls) td.className = cls; return td; };
    const tdSt = document.createElement("td");
    const b = document.createElement("span");
    b.className = "badge " + (r.status === "Selesai" ? "ok" : r.status === "Diproses" ? "warn" : "info"); b.textContent = r.status;
    tdSt.appendChild(b);
    const tdA = document.createElement("td");
    const a = document.createElement("a"); a.className = "btn btn-ghost btn-sm"; a.href = "tracking.html?do=" + r.nomorDO; a.textContent = "Lacak";
    tdA.appendChild(a);
    if (r.order) {
      const d = document.createElement("button"); d.type = "button"; d.className = "btn btn-sm"; d.textContent = "Detail"; d.style.marginLeft = ".4rem";
      d.addEventListener("click", () => showDetail(r.order));
      tdA.appendChild(d);
    }
    tr.append(c(r.nomorDO), c(r.tanggal), c(r.ringkas), c(r.total, "num"), tdSt, tdA);
    tbody.appendChild(tr);
  });

  function showDetail(o) {
    const box = $("#detailIsi"); box.replaceChildren();
    const lines = [
      ["No. DO", o.nomorDO], ["Pemesan", o.nama + " — " + o.telepon], ["Alamat", o.alamat],
      ["Ekspedisi", o.ekspedisi], ["Pembayaran", o.pembayaran],
      ...o.items.map((i) => [i.nama, i.qty + " × " + rupiah(i.harga)]), ["Total", rupiah(o.total)],
    ];
    const dl = document.createElement("dl"); dl.className = "detail-list"; dl.style.gridTemplateColumns = "1fr";
    lines.forEach(([k, v]) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      div.append(dt, dd); dl.appendChild(div);
    });
    box.appendChild(dl);
    openModal("dlgDetail");
  }
}

/* =====================================================
   Router halaman
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initModals();
  const page = document.body.dataset.page;
  if (page === "login") return initLogin();

  const user = guardPage();
  if (!user) return;
  ({
    dashboard: () => initDashboard(user),
    stok: () => initStok(user),
    checkout: () => initCheckout(user),
    tracking: () => initTracking(user),
    laporan: () => initLaporan(user),
    history: () => initHistory(user),
  })[page]?.();
});
