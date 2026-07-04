/* ============================================================
   Casa de Lagos — Lógica da aplicação (vanilla JS)
   ============================================================ */

/* ---------------- Supabase ---------------- */
// Criação defensiva: se o SDK (CDN) não carregar, a interface continua a
// aparecer e mostramos um aviso, em vez de a app rebentar por completo.
let supa = null;
if (window.supabase && typeof window.supabase.createClient === "function") {
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("O SDK do Supabase não carregou (verifica a ligação / o CDN).");
}

/* ---------------- Estado ---------------- */
const LS_PROFILE = "casa_lagos_perfil";
let currentProfile = null;
let bookings = [];
let viewYear, viewMonth;      // mês visível no calendário
let pickerYear;               // ano no seletor de mês

/* ---------------- Cores por perfil ---------------- */
// Paleta de pastéis suaves: `band` tinge o calendário, `dot` marca a legenda
// e os avatares. Atribuída de forma determinística pela posição na lista.
const PALETTE = [
  { band: "#dce7d3", dot: "#a7c491" }, // verde-sálvia
  { band: "#d4e1ec", dot: "#9cbad8" }, // azul-céu
  { band: "#f1e6c8", dot: "#ddc98a" }, // areia
  { band: "#efdcdd", dot: "#d69ea1" }, // rosa
  { band: "#e2dcec", dot: "#b0a1d0" }, // lavanda
  { band: "#f1ddce", dot: "#d8a483" }, // terracota
  { band: "#d4e7e3", dot: "#8fc4bd" }, // verde-água
  { band: "#f6e2ce", dot: "#e6b787" }, // pêssego
  { band: "#dce0ea", dot: "#9aa8c2" }, // azul-ardósia
  { band: "#ede7c6", dot: "#cfbe7c" }, // mostarda
];
function paletteFor(name) {
  const idx = FAMILY_MEMBERS.indexOf(name);
  if (idx >= 0) return PALETTE[idx % PALETTE.length];
  // fallback para nomes fora da lista (reservas antigas)
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const bandFor = (n) => paletteFor(n).band;
const dotFor = (n) => paletteFor(n).dot;

const SKIP_WORDS = ["família", "familia", "casa", "fam", "fam."];
function initials(name) {
  const words = name.trim().split(/\s+/)
    .filter((w) => !SKIP_WORDS.includes(w.toLowerCase()));
  const src = words.length ? words : name.trim().split(/\s+/);
  if (src.length >= 2) return (src[0][0] + src[1][0]).toUpperCase();
  return src[0].slice(0, 2).toUpperCase();
}

/* ---------------- Datas (formato PT dd/mm/yyyy) ---------------- */
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtPT(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayISO() { return toISO(new Date()); }

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez"];

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  applyConfigTexts();
  buildProfileGrid();
  wireEvents();

  const saved = localStorage.getItem(LS_PROFILE);
  if (saved) enterApp(saved);
  else showProfileScreen();
});

function applyConfigTexts() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (typeof HOUSE_NAME !== "undefined") { set("ps-title", HOUSE_NAME); set("house-name", HOUSE_NAME); document.title = HOUSE_NAME; }
  if (typeof HOUSE_SUBTITLE !== "undefined") set("house-sub", HOUSE_SUBTITLE);
  if (typeof HOUSE_TAGLINE !== "undefined") set("house-tagline", HOUSE_TAGLINE);
  if (typeof HERO_IMAGE_URL !== "undefined" && HERO_IMAGE_URL) {
    document.getElementById("hero").style.backgroundImage = `url("${HERO_IMAGE_URL}")`;
  }
}

/* ============================================================
   PERFIL
   ============================================================ */
function buildProfileGrid() {
  const grid = document.getElementById("profile-grid");
  grid.innerHTML = "";
  FAMILY_MEMBERS.forEach((name) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "profile-card";
    card.innerHTML = `
      <span class="avatar" style="background:${dotFor(name)}">${initials(name)}</span>
      <span class="name">${escapeHtml(name)}</span>`;
    card.addEventListener("click", () => {
      localStorage.setItem(LS_PROFILE, name);
      enterApp(name);
    });
    grid.appendChild(card);
  });
}

function showProfileScreen() {
  document.getElementById("profile-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function enterApp(name) {
  currentProfile = name;
  document.getElementById("profile-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.getElementById("menu-avatar").textContent = initials(name);
  document.getElementById("menu-avatar").style.background = dotFor(name);
  document.getElementById("menu-name").textContent = name;

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  loadBookings();
  renderCalendar();
}

function switchProfile() {
  localStorage.removeItem(LS_PROFILE);
  currentProfile = null;
  document.getElementById("menu-panel").classList.add("hidden");
  showProfileScreen();
}

/* ============================================================
   EVENTOS GLOBAIS
   ============================================================ */
function wireEvents() {
  // Menu
  const menuPanel = document.getElementById("menu-panel");
  document.getElementById("menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle("hidden");
  });
  document.getElementById("switch-profile").addEventListener("click", switchProfile);

  // Navegação de mês
  document.getElementById("prev-month").addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month").addEventListener("click", () => changeMonth(1));

  // Seletor de mês
  const picker = document.getElementById("month-picker");
  document.getElementById("month-label-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMonthPicker();
  });
  document.querySelectorAll(".mp-year-btn").forEach((b) =>
    b.addEventListener("click", () => { pickerYear += parseInt(b.dataset.yr, 10); renderMonthPicker(); }));

  // Fechar popovers ao clicar fora
  document.addEventListener("click", () => {
    menuPanel.classList.add("hidden");
    picker.classList.add("hidden");
  });
  picker.addEventListener("click", (e) => e.stopPropagation());
  menuPanel.addEventListener("click", (e) => e.stopPropagation());

  // Swipe no calendário (mobile)
  wireSwipe(document.getElementById("calendar"));

  // Nova reserva
  document.getElementById("new-booking-btn").addEventListener("click", () => openBookingModal());

  // Formulário
  document.getElementById("booking-form").addEventListener("submit", saveBooking);
  document.getElementById("delete-booking").addEventListener("click", deleteBooking);
  document.getElementById("booking-start").addEventListener("change", checkConflicts);
  document.getElementById("booking-end").addEventListener("change", checkConflicts);

  // Fechar modais
  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (modal) modal.classList.add("hidden");
    });
  });
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) m.classList.add("hidden"); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
      menuPanel.classList.add("hidden");
      picker.classList.add("hidden");
    }
  });
}

/* ============================================================
   SELETOR DE MÊS
   ============================================================ */
function toggleMonthPicker() {
  const picker = document.getElementById("month-picker");
  document.getElementById("menu-panel").classList.add("hidden");
  if (picker.classList.contains("hidden")) {
    pickerYear = viewYear;
    renderMonthPicker();
    picker.classList.remove("hidden");
  } else {
    picker.classList.add("hidden");
  }
}
function renderMonthPicker() {
  document.getElementById("mp-year-label").textContent = pickerYear;
  const box = document.getElementById("mp-months");
  box.innerHTML = "";
  MONTHS_SHORT.forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mp-month" + (i === viewMonth && pickerYear === viewYear ? " is-current" : "");
    b.textContent = m;
    b.addEventListener("click", () => {
      viewMonth = i; viewYear = pickerYear;
      document.getElementById("month-picker").classList.add("hidden");
      renderCalendar();
    });
    box.appendChild(b);
  });
}

/* ============================================================
   CALENDÁRIO
   ============================================================ */
function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
}

async function loadBookings() {
  if (!supa) { toast("Sem ligação ao Supabase — verifica o config.js."); return; }
  const { data, error } = await supa
    .from("bookings")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) {
    console.error(error);
    toast("Erro ao carregar reservas.");
    return;
  }
  bookings = data || [];
  renderCalendar();
}

function bookingsOn(iso) {
  return bookings.filter((b) => iso >= b.start_date && iso <= b.end_date);
}

function renderCalendar() {
  document.getElementById("month-label").textContent = `${MONTHS_PT[viewMonth]} ${viewYear}`;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  // Primeiro dia da grelha: segunda-feira da semana que contém o dia 1.
  const first = new Date(viewYear, viewMonth, 1);
  const offset = (first.getDay() + 6) % 7;  // 0=Seg ... 6=Dom
  const start = new Date(viewYear, viewMonth, 1 - offset);
  const today = todayISO();
  const visibleNames = new Set();

  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(date);
    const inMonth = date.getMonth() === viewMonth;
    const weekday = i % 7;   // 0=Seg ... 6=Dom

    const cell = document.createElement("div");
    cell.className = "day" + (inMonth ? "" : " other-month") + (iso === today ? " today" : "");

    const covering = bookingsOn(iso);
    if (covering.length) {
      const primary = covering[0];
      if (inMonth) covering.forEach((b) => visibleNames.add(b.person_name));

      // Banda pastel com cantos arredondados no início/fim da corrida.
      const band = document.createElement("div");
      band.className = "band";
      band.style.background = bandFor(primary.person_name);
      const runStart = iso === primary.start_date || weekday === 0;
      const runEnd = iso === primary.end_date || weekday === 6;
      const L = runStart ? "21px" : "0";
      const R = runEnd ? "21px" : "0";
      band.style.borderRadius = `${L} ${R} ${R} ${L}`;
      cell.appendChild(band);
    }

    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = date.getDate();
    cell.appendChild(num);

    // Marcas para reservas adicionais no mesmo dia (sobreposição).
    if (covering.length > 1) {
      const extra = document.createElement("div");
      extra.className = "day-extra";
      covering.slice(1, 4).forEach((b) => {
        const dot = document.createElement("i");
        dot.style.background = dotFor(b.person_name);
        extra.appendChild(dot);
      });
      cell.appendChild(extra);
    }

    if (inMonth || covering.length) {
      cell.addEventListener("click", () => openDay(iso));
    }
    grid.appendChild(cell);
  }

  renderLegend(visibleNames);
}

function renderLegend(names) {
  const box = document.getElementById("legend");
  box.innerHTML = "";
  [...names].forEach((name) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${dotFor(name)}"></span>${escapeHtml(name)}`;
    box.appendChild(item);
  });
  const avail = document.createElement("span");
  avail.className = "legend-item";
  avail.innerHTML = `<span class="legend-dot empty"></span>Disponível`;
  box.appendChild(avail);
}

/* ---------------- Swipe ---------------- */
function wireSwipe(el) {
  let x0 = null, y0 = null;
  el.addEventListener("touchstart", (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changeMonth(dx < 0 ? 1 : -1);
    x0 = y0 = null;
  }, { passive: true });
}

/* ============================================================
   ABRIR DIA (novo / detalhes / lista)
   ============================================================ */
function openDay(iso) {
  const covering = bookingsOn(iso);
  if (!covering.length) return openBookingModal(null, iso);
  if (covering.length === 1) return showDetails(covering[0]);
  showDayList(iso, covering);
}

/* ============================================================
   RESERVAS — criar / editar / apagar
   ============================================================ */
function openBookingModal(booking = null, presetDate = null) {
  const form = document.getElementById("booking-form");
  form.reset();
  document.getElementById("conflict-warning").classList.add("hidden");

  const delBtn = document.getElementById("delete-booking");
  const title = document.getElementById("booking-modal-title");

  if (booking) {
    title.textContent = "Editar reserva";
    document.getElementById("booking-id").value = booking.id;
    document.getElementById("booking-person").value = booking.person_name;
    document.getElementById("booking-start").value = booking.start_date;
    document.getElementById("booking-end").value = booking.end_date;
    document.getElementById("booking-guests").value = booking.guests;
    delBtn.classList.remove("hidden");
  } else {
    title.textContent = "Nova reserva";
    document.getElementById("booking-id").value = "";
    document.getElementById("booking-person").value = currentProfile;
    const d = presetDate || todayISO();
    document.getElementById("booking-start").value = d;
    document.getElementById("booking-end").value = d;
    document.getElementById("booking-guests").value = 1;
    delBtn.classList.add("hidden");
  }

  document.getElementById("details-modal").classList.add("hidden");
  document.getElementById("booking-modal").classList.remove("hidden");
  checkConflicts();
}

function getFormDates() {
  return {
    start: document.getElementById("booking-start").value,
    end: document.getElementById("booking-end").value,
    id: document.getElementById("booking-id").value,
  };
}

function checkConflicts() {
  const { start, end, id } = getFormDates();
  const warn = document.getElementById("conflict-warning");
  if (!start || !end) { warn.classList.add("hidden"); return []; }

  const conflicts = bookings.filter((b) =>
    b.id !== id && start <= b.end_date && end >= b.start_date);

  if (conflicts.length) {
    warn.innerHTML = `<strong>⚠️ Sobreposição com outras reservas:</strong>
      <ul>${conflicts.map((c) =>
        `<li>${escapeHtml(c.person_name)} — ${fmtPT(c.start_date)} a ${fmtPT(c.end_date)}</li>`
      ).join("")}</ul>
      Podes guardar na mesma.`;
    warn.classList.remove("hidden");
  } else {
    warn.classList.add("hidden");
  }
  return conflicts;
}

async function saveBooking(e) {
  e.preventDefault();
  if (!supa) { toast("Sem ligação ao Supabase — verifica o config.js."); return; }
  const { start, end, id } = getFormDates();
  const guests = parseInt(document.getElementById("booking-guests").value, 10) || 1;

  if (end < start) { toast("A data de saída não pode ser anterior à chegada."); return; }

  const btn = document.getElementById("save-booking");
  btn.disabled = true;

  const payload = {
    person_name: id ? document.getElementById("booking-person").value : currentProfile,
    start_date: start,
    end_date: end,
    guests,
  };

  let error;
  if (id) ({ error } = await supa.from("bookings").update(payload).eq("id", id));
  else ({ error } = await supa.from("bookings").insert(payload));

  btn.disabled = false;
  if (error) { console.error(error); toast("Erro ao guardar a reserva."); return; }

  document.getElementById("booking-modal").classList.add("hidden");
  toast(id ? "Reserva atualizada." : "Reserva criada!");
  await loadBookings();
}

async function deleteBooking() {
  const id = document.getElementById("booking-id").value;
  if (!id) return;
  if (!supa) { toast("Sem ligação ao Supabase — verifica o config.js."); return; }
  if (!confirm("Tens a certeza que queres cancelar esta reserva?")) return;

  const { error } = await supa.from("bookings").delete().eq("id", id);
  if (error) { console.error(error); toast("Erro ao cancelar a reserva."); return; }

  document.getElementById("booking-modal").classList.add("hidden");
  toast("Reserva cancelada.");
  await loadBookings();
}

/* ---------------- Detalhes ---------------- */
function showDetails(b) {
  const nights = Math.round((parseISO(b.end_date) - parseISO(b.start_date)) / 86400000);
  document.getElementById("details-title").textContent = "Detalhes da reserva";
  document.getElementById("details-body").innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Perfil</span>
      <span class="detail-value detail-person">
        <span class="avatar" style="background:${dotFor(b.person_name)}">${initials(b.person_name)}</span>
        ${escapeHtml(b.person_name)}
      </span>
    </div>
    <div class="detail-row"><span class="detail-label">Chegada</span><span class="detail-value">${fmtPT(b.start_date)}</span></div>
    <div class="detail-row"><span class="detail-label">Saída</span><span class="detail-value">${fmtPT(b.end_date)}</span></div>
    <div class="detail-row"><span class="detail-label">Noites</span><span class="detail-value">${nights}</span></div>
    <div class="detail-row"><span class="detail-label">Hóspedes</span><span class="detail-value">${b.guests}</span></div>`;

  const editBtn = document.getElementById("edit-from-details");
  editBtn.classList.remove("hidden");
  editBtn.onclick = () => openBookingModal(b);
  document.getElementById("details-modal").classList.remove("hidden");
}

function showDayList(iso, list) {
  document.getElementById("details-title").textContent = "Reservas do dia";
  const rows = list.map((b) => `
    <button type="button" class="day-list-item" data-id="${b.id}">
      <span class="day-list-swatch" style="background:${dotFor(b.person_name)}"></span>
      <span class="day-list-info">
        <span class="day-list-name">${escapeHtml(b.person_name)}</span>
        <span class="day-list-dates">${fmtPT(b.start_date)} — ${fmtPT(b.end_date)} · ${b.guests} hósp.</span>
      </span>
      <span class="day-list-chev">›</span>
    </button>`).join("");
  document.getElementById("details-body").innerHTML =
    `<p class="day-list-title">${fmtPT(iso)}</p>${rows}`;

  document.querySelectorAll("#details-body .day-list-item").forEach((el) => {
    el.addEventListener("click", () => {
      const b = list.find((x) => x.id === el.dataset.id);
      if (b) showDetails(b);
    });
  });

  document.getElementById("edit-from-details").classList.add("hidden");
  document.getElementById("details-modal").classList.remove("hidden");
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
