// app.js — full working version (cards + dropdown + Chart.js bar + pressure meter)

const params = new URLSearchParams(window.location.search);
const subdivision = (params.get("sub") || "").toUpperCase().trim();

// -------------------- formatting helpers --------------------
function money(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function num(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function normalizeKey(s) {
  return String(s || "").toUpperCase().trim();
}

// -------------------- data loading --------------------
async function loadData() {
  const res = await fetch("./data/subdiv_ytd_2026.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data file.");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Data file is not an array of rows.");
  return data;
}

// -------------------- UI: no sub selected --------------------
function renderNoSubSelected(allSubs) {
  const container = document.getElementById("dashboard");

  const options = allSubs
    .map((s) => `<option value="${encodeURIComponent(s)}">${s}</option>`)
    .join("");

  container.innerHTML = `
    <div class="wrap">
      <h2>Select a subdivision</h2>
      <p class="muted">Pick one to load the dashboard.</p>
      <select id="subSelect">
        <option value="">-- choose --</option>
        ${options}
      </select>
    </div>
  `;

  const sel = document.getElementById("subSelect");
  sel.addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    window.location.href = `?sub=${v}`;
  });
}

// -------------------- UI: no row found --------------------
function renderNoRowFound() {
  const container = document.getElementById("dashboard");
  container.innerHTML = `
    <div class="wrap">
      <p class="muted">No data found for this subdivision.</p>
      <p class="muted">Tip: check that the subdivision name in the URL matches the JSON "Subdivision" value (after uppercasing).</p>
    </div>
  `;
}

// -------------------- UI: cards + chart containers --------------------
function renderCards(row) {
  const container = document.getElementById("dashboard");

  container.innerHTML = `
    <div class="wrap">
      <div class="grid">
        <div class="card">
          <div class="label">Sold (YTD)</div>
          <div class="value">${num(row.Sold_YTD)}</div>
          <div class="sub">Homes sold so far this year</div>
        </div>

        <div class="card">
          <div class="label">Median Sold Price (YTD)</div>
          <div class="value">${money(row.MedianSoldPrice_YTD)}</div>
          <div class="sub">Typical closed price</div>
        </div>

        <div class="card">
          <div class="label">Median Discount (Orig → Sold)</div>
          <div class="value">${pct(row.MedianSoldToOrigPct_YTD)}</div>
          <div class="sub">${money(row.MedianSoldToOrigDollar_YTD)} vs original list</div>
        </div>
      </div>

      <div class="panel">
        <div class="panelTitle">Market Trend</div>
        <div class="canvasWrap">
          <canvas id="heroChart"></canvas>
        </div>
      </div>

      <div class="panel">
        <div class="panelTitle">Market Pressure</div>
        <div class="canvasWrap">
          <canvas id="pressureMeter"></canvas>
        </div>
        <div id="pressureText" class="muted" style="margin-top:10px;"></div>
      </div>
    </div>
  `;
}

// -------------------- chart state --------------------
let heroChartInstance = null;
let pressureChartInstance = null;

// -------------------- chart helpers --------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computePressureScore(row) {
  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);
  const soldToOrigPct = Number(row.MedianSoldToOrigPct_YTD || 0); // e.g. 0.97 = -3%

  const soldPart = clamp((sold / 80) * 25, 0, 25);
  const pricePart = clamp((price / 500000) * 20, 0, 20);

  // Baseline at 0.98; range +/- 0.04.
  const discountPart = clamp(((soldToOrigPct - 0.98) / 0.04) * 35, -35, 35);

  const raw = 50 + soldPart + pricePart + discountPart;
  return clamp(raw, 0, 100);
}

function pressureLabel(score) {
  if (score >= 75) return "Seller-leaning (hotter)";
  if (score >= 60) return "Slight seller edge";
  if (score >= 45) return "Balanced";
  if (score >= 30) return "Slight buyer edge";
  return "Buyer-leaning (cooler)";
}

function ensureChartJsLoaded() {
  if (typeof Chart === "undefined") {
    throw new Error(
      "Chart.js is not loaded. Add <script src='https://cdn.jsdelivr.net/npm/chart.js'></script> before app.js"
    );
  }
}

function renderHeroChart(row) {
  ensureChartJsLoaded();

  const canvas = document.getElementById("heroChart");
  if (!canvas) return;

  if (heroChartInstance) heroChartInstance.destroy();

  const labels = ["Sold (YTD)", "Median Price (YTD)", "Discount %"];
  const values = [
    Number(row.Sold_YTD || 0),
    Number(row.MedianSoldPrice_YTD || 0),
    Number(row.MedianSoldToOrigPct_YTD || 0) * 100,
  ];

  heroChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderWidth: 0,
          borderRadius: 10,
          barThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const v = ctx.parsed.y;
              if (i === 0) return ` ${num(v)} homes`;
              if (i === 1) return ` ${money(v)}`;
              return ` ${v.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } },
        y: { grid: { color: "rgba(0,0,0,0.08)" } },
      },
    },
  });
}

function renderPressureMeter(row) {
  ensureChartJsLoaded();

  const canvas = document.getElementById("pressureMeter");
  const txt = document.getElementById("pressureText");
  if (!canvas || !txt) return;

  if (pressureChartInstance) pressureChartInstance.destroy();

  const score = computePressureScore(row);
  txt.textContent = `${Math.round(score)}/100 — ${pressureLabel(score)}`;

  pressureChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: [""],
      datasets: [
        { data: [score], borderWidth: 0, borderRadius: 999, barThickness: 22, stack: "meter" },
        { data: [100 - score], borderWidth: 0, borderRadius: 999, barThickness: 22, stack: "meter" },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { min: 0, max: 100, grid: { display: false }, ticks: { display: false }, border: { display: false }, stacked: true },
        y: { grid: { display: false }, ticks: { display: false }, border: { display: false }, stacked: true },
      },
    },
  });
}

// -------------------- main --------------------
(async function main() {
  const container = document.getElementById("dashboard");

  try {
    const data = await loadData();

    const allSubs = data
      .map((r) => normalizeKey(r.Subdivision))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (!subdivision) {
      renderNoSubSelected(allSubs);
      return;
    }

    const row = data.find((r) => normalizeKey(r.Subdivision) === subdivision);

    if (!row) {
      renderNoRowFound();
      return;
    }

    renderCards(row);
    renderHeroChart(row);
    renderPressureMeter(row);
  } catch (e) {
    container.innerHTML = `
      <div class="wrap">
        <h2>Error</h2>
        <p class="muted">${String(e.message || e)}</p>
      </div>
    `;
  }
})();
