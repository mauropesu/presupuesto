// Mi Presupuesto - lógica de la app (localStorage, sin backend)

const STORAGE_KEYS = {
  transactions: "presupuesto_transactions",
  budgets: "presupuesto_budgets",
  categories: "presupuesto_categories",
};

const DEFAULT_CATEGORIES = [
  "Comida",
  "Transporte",
  "Vivienda",
  "Servicios",
  "Entretenimiento",
  "Salud",
  "Ahorro",
  "Otros",
];

const state = {
  transactions: [],
  budgets: {},
  categories: [],
};

let categoryChart = null;
let trendChart = null;

// ---------- Persistencia ----------

function loadState() {
  state.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || "[]");
  state.budgets = JSON.parse(localStorage.getItem(STORAGE_KEYS.budgets) || "{}");
  state.categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || "null") || [...DEFAULT_CATEGORIES];
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
}

function saveBudgets() {
  localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(state.budgets));
}

function saveCategories() {
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
}

// ---------- Utilidades ----------

function formatMoney(n) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(n || 0);
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOfDate(dateStr) {
  return dateStr.slice(0, 7);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function transactionsForMonth(month) {
  return state.transactions.filter((t) => monthOfDate(t.date) === month);
}

// ---------- Render: formulario y categorías ----------

function populateCategorySelect() {
  const select = document.getElementById("tx-category");
  select.innerHTML = state.categories
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

// ---------- Render: tabla de movimientos ----------

function renderTransactions() {
  const month = document.getElementById("filter-month").value;
  const rows = transactionsForMonth(month).sort((a, b) => b.date.localeCompare(a.date));
  const tbody = document.getElementById("transactions-body");
  const emptyState = document.getElementById("empty-state");

  tbody.innerHTML = rows
    .map(
      (t) => `
    <tr data-id="${t.id}">
      <td>${t.date}</td>
      <td class="type-${t.type}">${t.type === "income" ? "Ingreso" : "Gasto"}</td>
      <td>${t.category}</td>
      <td>${t.description || ""}</td>
      <td class="num">${formatMoney(t.amount)}</td>
      <td><button class="row-delete" data-id="${t.id}" title="Eliminar">✕</button></td>
    </tr>`
    )
    .join("");

  emptyState.hidden = rows.length !== 0;
}

// ---------- Render: resumen ----------

function renderSummary() {
  const month = document.getElementById("filter-month").value;
  const rows = transactionsForMonth(month);
  const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  document.getElementById("summary-income").textContent = formatMoney(income);
  document.getElementById("summary-expense").textContent = formatMoney(expense);
  document.getElementById("summary-balance").textContent = formatMoney(income - expense);
}

// ---------- Render: presupuesto por categoría ----------

function renderBudgets() {
  const month = document.getElementById("filter-month").value;
  const rows = transactionsForMonth(month).filter((t) => t.type === "expense");
  const spentByCategory = {};
  rows.forEach((t) => {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
  });

  const list = document.getElementById("budget-list");
  list.innerHTML = state.categories
    .map((cat) => {
      const limit = state.budgets[cat] || 0;
      const spent = spentByCategory[cat] || 0;
      const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
      let fillClass = "";
      if (limit > 0) {
        if (spent > limit) fillClass = "over";
        else if (spent / limit > 0.8) fillClass = "warn";
      }
      return `
      <div class="budget-item" data-category="${cat}">
        <div class="budget-item-header">
          <strong>${cat}</strong>
          <span class="amounts">${formatMoney(spent)} /
            <input type="number" class="budget-limit-input" data-category="${cat}" min="0" step="1" value="${limit || ""}" placeholder="sin límite" />
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width: ${pct}%"></div>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".budget-limit-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const cat = e.target.dataset.category;
      const val = parseFloat(e.target.value);
      if (!val || val <= 0) {
        delete state.budgets[cat];
      } else {
        state.budgets[cat] = val;
      }
      saveBudgets();
      renderBudgets();
    });
  });
}

// ---------- Render: gráficos ----------

function renderCharts() {
  const month = document.getElementById("filter-month").value;
  const monthRows = transactionsForMonth(month).filter((t) => t.type === "expense");
  const byCategory = {};
  monthRows.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const catCtx = document.getElementById("chart-category");
  const catLabels = Object.keys(byCategory);
  const catData = Object.values(byCategory);
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(catCtx, {
    type: "doughnut",
    data: {
      labels: catLabels.length ? catLabels : ["Sin gastos"],
      datasets: [
        {
          data: catData.length ? catData : [1],
          backgroundColor: [
            "#6c8cff", "#3ddc97", "#ff6b6b", "#ffb84d", "#c792ea",
            "#4dd0e1", "#f06292", "#a1887f", "#90a4ae", "#dce775",
          ],
        },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#e7e9ee" } } },
    },
  });

  // Tendencia: últimos 6 meses (incluyendo el mes filtrado como referencia)
  const months = [];
  const base = month ? new Date(month + "-01T00:00:00") : new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const incomeSeries = months.map((m) =>
    transactionsForMonth(m).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
  );
  const expenseSeries = months.map((m) =>
    transactionsForMonth(m).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  );

  const trendCtx = document.getElementById("chart-trend");
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label: "Ingresos", data: incomeSeries, backgroundColor: "#3ddc97" },
        { label: "Gastos", data: expenseSeries, backgroundColor: "#ff6b6b" },
      ],
    },
    options: {
      scales: {
        x: { ticks: { color: "#e7e9ee" }, grid: { color: "#262b38" } },
        y: { ticks: { color: "#e7e9ee" }, grid: { color: "#262b38" } },
      },
      plugins: { legend: { labels: { color: "#e7e9ee" } } },
    },
  });
}

// ---------- Render general ----------

function renderAll() {
  renderTransactions();
  renderSummary();
  renderBudgets();
  renderCharts();
}

// ---------- Eventos: tabs ----------

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// ---------- Eventos: formulario de movimiento ----------

function setupTransactionForm() {
  const form = document.getElementById("transaction-form");
  document.getElementById("tx-date").value = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.getElementById("tx-type").value;
    const amount = parseFloat(document.getElementById("tx-amount").value);
    const date = document.getElementById("tx-date").value;
    const category = document.getElementById("tx-category").value;
    const description = document.getElementById("tx-description").value.trim();

    if (!amount || amount <= 0 || !date || !category) return;

    state.transactions.push({ id: uid(), type, amount, date, category, description });
    saveTransactions();

    form.reset();
    document.getElementById("tx-date").value = date;
    populateCategorySelect();

    const filterMonth = document.getElementById("filter-month");
    filterMonth.value = monthOfDate(date);
    renderAll();
  });

  document.getElementById("transactions-body").addEventListener("click", (e) => {
    const btn = e.target.closest(".row-delete");
    if (!btn) return;
    state.transactions = state.transactions.filter((t) => t.id !== btn.dataset.id);
    saveTransactions();
    renderAll();
  });
}

// ---------- Eventos: filtro de mes ----------

function setupMonthFilter() {
  const filter = document.getElementById("filter-month");
  filter.value = currentMonthValue();
  filter.addEventListener("change", renderAll);
}

// ---------- Eventos: categorías ----------

function setupCategoryForm() {
  document.getElementById("category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("new-category-name");
    const name = input.value.trim();
    if (!name || state.categories.includes(name)) return;
    state.categories.push(name);
    saveCategories();
    input.value = "";
    populateCategorySelect();
    renderBudgets();
  });
}

// ---------- Eventos: exportar / importar ----------

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setupDataActions() {
  document.getElementById("export-json").addEventListener("click", () => {
    const payload = {
      transactions: state.transactions,
      budgets: state.budgets,
      categories: state.categories,
      exportedAt: new Date().toISOString(),
    };
    downloadFile("presupuesto.json", JSON.stringify(payload, null, 2), "application/json");
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    const header = "fecha,tipo,categoria,descripcion,monto\n";
    const rows = state.transactions
      .map((t) => [t.date, t.type, t.category, (t.description || "").replace(/,/g, ";"), t.amount].join(","))
      .join("\n");
    downloadFile("presupuesto.csv", header + rows, "text/csv");
  });

  document.getElementById("import-json").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.transactions)) state.transactions = data.transactions;
        if (data.budgets && typeof data.budgets === "object") state.budgets = data.budgets;
        if (Array.isArray(data.categories) && data.categories.length) state.categories = data.categories;
        saveTransactions();
        saveBudgets();
        saveCategories();
        populateCategorySelect();
        renderAll();
        document.getElementById("import-status").textContent = "Importado correctamente.";
      } catch (err) {
        document.getElementById("import-status").textContent = "Error al importar: archivo inválido.";
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    if (!confirm("¿Seguro que quieres borrar todos los datos? Esta acción no se puede deshacer.")) return;
    state.transactions = [];
    state.budgets = {};
    state.categories = [...DEFAULT_CATEGORIES];
    saveTransactions();
    saveBudgets();
    saveCategories();
    populateCategorySelect();
    renderAll();
  });
}

// ---------- Inicialización ----------

function init() {
  loadState();
  populateCategorySelect();
  setupTabs();
  setupMonthFilter();
  setupTransactionForm();
  setupCategoryForm();
  setupDataActions();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
