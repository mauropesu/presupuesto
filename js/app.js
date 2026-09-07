/* ============================================================
   Presupuesto — lógica de la app (vanilla JS, sin build tools)
   ============================================================ */

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio",
               "Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const DEFAULT_SETTINGS = {
  trmHoy: 4100,
  cuentas: [],
  fuentes: [
    { nombre: "SLB", moneda: "COP" },
    { nombre: "Consultoría", moneda: "USD" },
    { nombre: "Otros", moneda: "COP" },
  ],
  categorias: ["Vivienda","Alimentación","Transporte","Servicios","Salud",
               "Entretenimiento","Educación","Deudas","Ahorro","Otros"],
};

const fmtCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

/* ---------------- Tema (claro / oscuro / sistema) ---------------- */

const TEMA_KEY = "presupuesto-tema";

function aplicarTema(valor) {
  if (valor === "sistema") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", valor);
  }
}

const temaGuardado = localStorage.getItem(TEMA_KEY) || "sistema";
aplicarTema(temaGuardado);

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("tema-select");
  select.value = temaGuardado;
  select.addEventListener("change", () => {
    localStorage.setItem(TEMA_KEY, select.value);
    aplicarTema(select.value);
  });
});

let currentUser = null;
let settings = null;
let incomes = [];
let expenses = [];
let goals = [];
let unsub = [];
let chartGastos, chartIngresos;

/* ---------------- Auth ---------------- */

document.getElementById("btn-google").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => alert("No se pudo iniciar sesión: " + err.message));
});

document.getElementById("btn-signout").addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged((user) => {
  currentUser = user;
  unsub.forEach((fn) => fn());
  unsub = [];

  if (user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("user-name").textContent = user.displayName || user.email || "";
    document.getElementById("user-photo").src = user.photoURL || "";
    bootstrapUser(user.uid);
  } else {
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

async function bootstrapUser(uid) {
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set(DEFAULT_SETTINGS);
  }

  unsub.push(userRef.onSnapshot((doc) => {
    settings = Object.assign({}, DEFAULT_SETTINGS, doc.data());
    populateFuentes();
    populateCategorias();
    renderAjustes();
    renderAll();
  }));

  unsub.push(userRef.collection("incomes").orderBy("fecha", "desc").onSnapshot((qs) => {
    incomes = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderIngresos();
    renderAll();
  }));

  unsub.push(userRef.collection("expenses").orderBy("fecha", "desc").onSnapshot((qs) => {
    expenses = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGastos();
    renderAll();
  }));

  unsub.push(userRef.collection("goals").orderBy("nombre").onSnapshot((qs) => {
    goals = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMetas();
    renderResumenMetas();
  }));
}

/* ---------------- Tabs ---------------- */

function switchTab(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-m").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
}
document.querySelectorAll(".tab, .tab-m").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

/* ---------------- Show/hide forms ---------------- */

document.querySelectorAll(".btn-add").forEach((btn) => {
  btn.addEventListener("click", () => {
    const form = document.getElementById(btn.dataset.form);
    form.classList.toggle("hidden");
  });
});
document.querySelectorAll("[data-cancel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const form = document.getElementById(btn.dataset.cancel);
    form.reset();
    form.classList.add("hidden");
  });
});

/* ---------------- Dropdowns fed by ajustes ---------------- */

function populateFuentes() {
  const select = document.querySelector('#form-ingreso select[name="fuente"]');
  select.innerHTML = settings.fuentes.map((f) => `<option value="${f.nombre}">${f.nombre}</option>`).join("");
}

function populateCategorias() {
  const select = document.querySelector('#form-gasto select[name="categoria"]');
  select.innerHTML = settings.categorias.map((c) => `<option value="${c}">${c}</option>`).join("");
}

// Auto-moneda: al elegir la fuente, se sugiere COP/USD según lo configurado en Ajustes.
document.querySelector('#form-ingreso select[name="fuente"]').addEventListener("change", (e) => {
  const fuente = settings.fuentes.find((f) => f.nombre === e.target.value);
  if (fuente) document.querySelector('#form-ingreso select[name="moneda"]').value = fuente.moneda;
});

/* ---------------- Currency helper ---------------- */

function montoEnCOP(moneda, montoOriginal, trmFila) {
  if (moneda === "USD") return montoOriginal * (trmFila || settings.trmHoy);
  return montoOriginal;
}

/* ---------------- Guardar ingreso / gasto / meta ---------------- */

document.getElementById("form-ingreso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const moneda = f.moneda.value;
  const monto = parseFloat(f.monto.value);
  const trm = f.trm.value ? parseFloat(f.trm.value) : null;
  await db.collection("users").doc(currentUser.uid).collection("incomes").add({
    fecha: f.fecha.value,
    fuente: f.fuente.value,
    descripcion: f.descripcion.value.trim(),
    moneda,
    montoOriginal: monto,
    trmUsado: moneda === "USD" ? (trm || settings.trmHoy) : null,
    montoCOP: montoEnCOP(moneda, monto, trm),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  f.reset();
  f.classList.add("hidden");
});

document.getElementById("form-gasto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const moneda = f.moneda.value;
  const monto = parseFloat(f.monto.value);
  const trm = f.trm.value ? parseFloat(f.trm.value) : null;
  await db.collection("users").doc(currentUser.uid).collection("expenses").add({
    fecha: f.fecha.value,
    categoria: f.categoria.value,
    descripcion: f.descripcion.value.trim(),
    moneda,
    montoOriginal: monto,
    trmUsado: moneda === "USD" ? (trm || settings.trmHoy) : null,
    montoCOP: montoEnCOP(moneda, monto, trm),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  f.reset();
  f.classList.add("hidden");
});

document.getElementById("form-meta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await db.collection("users").doc(currentUser.uid).collection("goals").add({
    nombre: f.nombre.value.trim(),
    montoObjetivo: parseFloat(f.objetivo.value),
    montoActual: parseFloat(f.actual.value || 0),
    fechaLimite: f.limite.value || null,
  });
  f.reset();
  f.classList.add("hidden");
});

/* ---------------- Borrar filas ---------------- */

function attachDelete(container, coleccion) {
  container.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("¿Borrar este registro?")) return;
      db.collection("users").doc(currentUser.uid).collection(coleccion).doc(btn.dataset.del).delete();
    });
  });
}

/* ---------------- Render: Ingresos ---------------- */

function renderIngresos() {
  const cont = document.getElementById("lista-ingresos");
  if (incomes.length === 0) {
    cont.innerHTML = '<p class="ledger-empty" id="ingresos-empty">Aún no has registrado ingresos.</p>';
    return;
  }
  cont.innerHTML = incomes.map((i) => `
    <div class="ledger-row">
      <span class="ledger-date">${fmtFecha(i.fecha)}</span>
      <span class="ledger-main">
        <span class="ledger-tag">${i.fuente}</span>
        ${i.descripcion ? `<span class="ledger-desc">${escapeHtml(i.descripcion)}</span>` : ""}
      </span>
      <span class="ledger-amount">
        ${fmtCOP.format(i.montoCOP)}
        ${i.moneda === "USD" ? `<span class="fx-note">${i.montoOriginal} USD</span>` : ""}
      </span>
      <button class="ledger-del" data-del="${i.id}" aria-label="Borrar">×</button>
    </div>
  `).join("");
  attachDelete(cont, "incomes");
}

/* ---------------- Render: Gastos ---------------- */

function renderGastos() {
  const cont = document.getElementById("lista-gastos");
  if (expenses.length === 0) {
    cont.innerHTML = '<p class="ledger-empty" id="gastos-empty">Aún no has registrado gastos.</p>';
    return;
  }
  cont.innerHTML = expenses.map((g) => `
    <div class="ledger-row">
      <span class="ledger-date">${fmtFecha(g.fecha)}</span>
      <span class="ledger-main">
        <span class="ledger-tag">${g.categoria}</span>
        ${g.descripcion ? `<span class="ledger-desc">${escapeHtml(g.descripcion)}</span>` : ""}
      </span>
      <span class="ledger-amount">
        ${fmtCOP.format(g.montoCOP)}
        ${g.moneda === "USD" ? `<span class="fx-note">${g.montoOriginal} USD</span>` : ""}
      </span>
      <button class="ledger-del" data-del="${g.id}" aria-label="Borrar">×</button>
    </div>
  `).join("");
  attachDelete(cont, "expenses");
}

/* ---------------- Render: Metas ---------------- */

function goalRow(g) {
  const pct = g.montoObjetivo > 0 ? Math.min(g.montoActual / g.montoObjetivo, 1) : 0;
  const falta = Math.max(g.montoObjetivo - g.montoActual, 0);
  return `
    <div class="goal">
      <div class="goal-top">
        <span class="goal-name">${escapeHtml(g.nombre)}</span>
        <span class="goal-pct">${fmtPct(pct)}</span>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct * 100}%"></div></div>
      <div class="goal-foot">
        <span>${fmtCOP.format(g.montoActual)} de ${fmtCOP.format(g.montoObjetivo)}</span>
        <span>Falta ${fmtCOP.format(falta)}</span>
      </div>
    </div>
  `;
}

function renderMetas() {
  const cont = document.getElementById("lista-metas");
  if (goals.length === 0) {
    cont.innerHTML = '<p class="ledger-empty" id="metas-empty">Aún no tienes metas registradas.</p>';
    return;
  }
  cont.innerHTML = goals.map((g) => `
    <div style="position:relative">
      ${goalRow(g)}
      <button class="ledger-del" data-del="${g.id}" aria-label="Borrar"
        style="position:absolute; top:14px; right:16px;">×</button>
    </div>
  `).join("");
  attachDelete(cont, "goals");
}

function renderResumenMetas() {
  const cont = document.getElementById("resumen-metas");
  cont.innerHTML = goals.length === 0
    ? '<p class="ledger-empty">Aún no tienes metas registradas.</p>'
    : goals.map(goalRow).join("");
}

/* ---------------- Filtro de mes ---------------- */

const selMes = document.getElementById("filtro-mes");
MESES.forEach((m, idx) => {
  const opt = document.createElement("option");
  opt.value = String(idx);
  opt.textContent = m;
  selMes.appendChild(opt);
});
selMes.addEventListener("change", renderResumen);

function mesDe(fechaStr) {
  return new Date(fechaStr + "T00:00:00").getMonth();
}

/* ---------------- Resumen (totales + gráficas) ---------------- */

function renderAll() {
  renderResumen();
}

function renderResumen() {
  if (!settings) return;
  const filtro = selMes.value;

  const incFiltrados = filtro === "todos" ? incomes : incomes.filter((i) => String(mesDe(i.fecha)) === filtro);
  const gasFiltrados = filtro === "todos" ? expenses : expenses.filter((g) => String(mesDe(g.fecha)) === filtro);

  const totalIngresos = incFiltrados.reduce((s, i) => s + i.montoCOP, 0);
  const totalGastos = gasFiltrados.reduce((s, g) => s + g.montoCOP, 0);

  document.getElementById("total-ingresos").textContent = fmtCOP.format(totalIngresos);
  document.getElementById("total-gastos").textContent = fmtCOP.format(totalGastos);
  document.getElementById("balance-periodo").textContent = fmtCOP.format(totalIngresos - totalGastos);

  // Balance acumulado: saldo de todas las cuentas + TODOS los ingresos y gastos, sin importar el filtro.
  const totalIngresosAll = incomes.reduce((s, i) => s + i.montoCOP, 0);
  const totalGastosAll = expenses.reduce((s, g) => s + g.montoCOP, 0);
  const totalCuentas = (settings.cuentas || []).reduce((s, c) => s + (c.saldo || 0), 0);
  const balanceAcumulado = totalCuentas + totalIngresosAll - totalGastosAll;
  document.getElementById("balance-acumulado").textContent = fmtCOP.format(balanceAcumulado);

  renderResumenCuentas();
  renderChartGastos(gasFiltrados);
  renderChartIngresos(incFiltrados);
}

function renderResumenCuentas() {
  const cont = document.getElementById("resumen-cuentas");
  const cuentas = settings.cuentas || [];
  cont.innerHTML = cuentas.length === 0
    ? '<p class="ledger-empty">Aún no agregas cuentas bancarias (ve a Ajustes).</p>'
    : cuentas.map((c) => `
        <div class="account-row-static">
          <span>${escapeHtml(c.nombre)}</span>
          <span class="account-balance-display">${fmtCOP.format(c.saldo || 0)}</span>
        </div>
      `).join("");
}

function renderChartGastos(lista) {
  const porCategoria = {};
  lista.forEach((g) => { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.montoCOP; });
  const labels = Object.keys(porCategoria);
  const data = Object.values(porCategoria);

  document.getElementById("chart-gastos-empty").classList.toggle("hidden", labels.length > 0);
  const canvas = document.getElementById("chart-gastos");
  canvas.classList.toggle("hidden", labels.length === 0);
  if (labels.length === 0) return;

  if (chartGastos) chartGastos.destroy();
  chartGastos = new Chart(canvas, {
    type: "pie",
    data: { labels, datasets: [{ data, backgroundColor: palette(labels.length) }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } },
  });
}

function renderChartIngresos(lista) {
  const porFuente = {};
  lista.forEach((i) => { porFuente[i.fuente] = (porFuente[i.fuente] || 0) + i.montoCOP; });
  const labels = Object.keys(porFuente);
  const data = Object.values(porFuente);

  document.getElementById("chart-ingresos-empty").classList.toggle("hidden", labels.length > 0);
  const canvas = document.getElementById("chart-ingresos");
  canvas.classList.toggle("hidden", labels.length === 0);
  if (labels.length === 0) return;

  if (chartIngresos) chartIngresos.destroy();
  chartIngresos = new Chart(canvas, {
    type: "pie",
    data: { labels, datasets: [{ data, backgroundColor: palette(labels.length) }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } },
  });
}

function palette(n) {
  const base = ["#2F6F4E","#A87C1D","#A23B3B","#5B6B70","#1E2A33","#7A9B6E","#C9A227","#7A4B4B","#8FA6AB","#3D5A4C"];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

/* ---------------- Ajustes ---------------- */

function renderAjustes() {
  document.getElementById("ajuste-trm").value = settings.trmHoy;

  const cuentasList = document.getElementById("lista-cuentas");
  cuentasList.innerHTML = (settings.cuentas || []).map((c, idx) => `
    <div class="account-row">
      <span class="account-name">${escapeHtml(c.nombre)}</span>
      <input type="number" class="account-balance" step="1" value="${c.saldo || 0}" data-cuenta-saldo="${idx}" />
      <button data-del-cuenta="${idx}" aria-label="Quitar">×</button>
    </div>
  `).join("");

  cuentasList.querySelectorAll("[data-cuenta-saldo]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.cuentaSaldo);
      const nuevas = settings.cuentas.map((c, i) => i === idx ? { ...c, saldo: parseFloat(input.value || 0) } : c);
      saveSettings({ cuentas: nuevas });
    });
  });
  cuentasList.querySelectorAll("[data-del-cuenta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.delCuenta);
      saveSettings({ cuentas: settings.cuentas.filter((_, i) => i !== idx) });
    });
  });

  const fuentesList = document.getElementById("lista-fuentes");
  fuentesList.innerHTML = settings.fuentes.map((f, idx) => `
    <li>
      ${escapeHtml(f.nombre)}
      <span class="tag-usd" data-toggle-fuente="${idx}" style="cursor:pointer">${f.moneda}</span>
      <button data-del-fuente="${idx}" aria-label="Quitar">×</button>
    </li>
  `).join("");

  const categoriasList = document.getElementById("lista-categorias");
  categoriasList.innerHTML = settings.categorias.map((c, idx) => `
    <li>${escapeHtml(c)}<button data-del-categoria="${idx}" aria-label="Quitar">×</button></li>
  `).join("");

  fuentesList.querySelectorAll("[data-toggle-fuente]").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.toggleFuente);
      const nuevas = settings.fuentes.map((f, i) => i === idx ? { ...f, moneda: f.moneda === "USD" ? "COP" : "USD" } : f);
      saveSettings({ fuentes: nuevas });
    });
  });
  fuentesList.querySelectorAll("[data-del-fuente]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.delFuente);
      saveSettings({ fuentes: settings.fuentes.filter((_, i) => i !== idx) });
    });
  });
  categoriasList.querySelectorAll("[data-del-categoria]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.delCategoria);
      saveSettings({ categorias: settings.categorias.filter((_, i) => i !== idx) });
    });
  });
}

function saveSettings(partial) {
  return db.collection("users").doc(currentUser.uid).set(partial, { merge: true });
}

document.getElementById("btn-guardar-ajustes").addEventListener("click", () => {
  saveSettings({
    trmHoy: parseFloat(document.getElementById("ajuste-trm").value || 0),
  });
});

document.getElementById("btn-add-cuenta").addEventListener("click", () => {
  const nombreInput = document.getElementById("nueva-cuenta-nombre");
  const saldoInput = document.getElementById("nueva-cuenta-saldo");
  const nombre = nombreInput.value.trim();
  if (!nombre) return;
  const saldo = parseFloat(saldoInput.value || 0);
  saveSettings({ cuentas: [...(settings.cuentas || []), { nombre, saldo }] });
  nombreInput.value = "";
  saldoInput.value = "";
});

document.getElementById("btn-add-fuente").addEventListener("click", () => {
  const input = document.getElementById("nueva-fuente");
  const nombre = input.value.trim();
  if (!nombre) return;
  saveSettings({ fuentes: [...settings.fuentes, { nombre, moneda: "COP" }] });
  input.value = "";
});

document.getElementById("btn-add-categoria").addEventListener("click", () => {
  const input = document.getElementById("nueva-categoria");
  const nombre = input.value.trim();
  if (!nombre) return;
  saveSettings({ categorias: [...settings.categorias, nombre] });
  input.value = "";
});

/* ---------------- Utilidades ---------------- */

function fmtFecha(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
