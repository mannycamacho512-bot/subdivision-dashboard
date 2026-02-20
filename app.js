const params = new URLSearchParams(window.location.search);
const subdivision = (params.get("sub") || "").toUpperCase().trim();

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

async function loadData() {
  // If you later rename to subdiv_ytd_current.json, change it here once.
  const res = await fetch("./data/subdiv_ytd_2026.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data file.");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Data file is not an array of rows.");
  return data;
}

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

function renderNoRowFound() {
  const container = document.getElementById("dashboard");
  // Note: no subdivision name shown here on purpose
  container.innerHTML = `
    <div class="wrap">
      <p class="muted">No data found for this subdivision.</p>
      <p class="muted">Tip: check that the subdivision name in the URL matches the JSON "Subdivision" value (after uppercasing).</p>
    </div>
  `;
}

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
    </div>
  `;
}

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
  } catch (e) {
    container.innerHTML = `
      <div class="wrap">
        <h2>Error</h2>
        <p class="muted">${String(e.message || e)}</p>
      </div>
    `;
  }
})();
