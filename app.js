// app.js — KPI cards + 3 signal cards (no Chart.js, no "Market Trend" panels)

const params = new URLSearchParams(window.location.search);
const subdivision = (params.get("sub") || "").toUpperCase().trim();

// ---------- formatting helpers ----------
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

// ---------- data loading ----------
async function loadData() {
  const res = await fetch("./data/subdiv_ytd_2026.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data file.");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Data file is not an array of rows.");
  return data;
}

// ---------- UI screens ----------
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
  container.innerHTML = `
    <div class="wrap">
      <p class="muted">No data found for this subdivision.</p>
      <p class="muted">Tip: check that the subdivision name in the URL matches the JSON "Subdivision" value (after uppercasing).</p>
    </div>
  `;
}

function renderError(err) {
  const container = document.getElementById("dashboard");
  container.innerHTML = `
    <div class="wrap">
      <h2>Error</h2>
      <p class="muted">${String(err?.message || err)}</p>
    </div>
  `;
}

// ---------- main dashboard ----------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function renderCards(row) {
  const container = document.getElementById("dashboard");

  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);
  const soldToOrigPct = Number(row.MedianSoldToOrigPct_YTD || 0);

  // If soldToOrigPct is 0/blank, negotiation becomes weird — handle it.
  const negotiationPct = soldToOrigPct > 0 ? (1 - soldToOrigPct) * 100 : 0;

  // --- Scales (tune later) ---
  const activityScaleMax = 80; // typical sold YTD that maps to "100%"
  const priceMin = 200000;
  const priceMax = 500000;

  const activityPct = clamp((sold / activityScaleMax) * 100, 0, 100);
  const pricePosPct = clamp(((price - priceMin) / (priceMax - priceMin)) * 100, 0, 100);

  // Negotiation room: map 0–10% discount into 0–100% bar width
  const negoWidth = clamp((negotiationPct / 10) * 100, 0, 100);

  // --- Explanations ---
  const activityMeaning =
    activityPct >= 70 ? "High sales activity (homes are moving faster)." :
    activityPct >= 40 ? "Moderate activity (steady pace)." :
                        "Lower activity (fewer sales so far).";

  const negoMeaning =
    negotiationPct < 2 ? "Little negotiation (close to original list price)." :
    negotiationPct < 5 ? "Some negotiation (modest discounts)." :
                         "More negotiation (larger discounts).";

  const priceMeaning =
    pricePosPct >= 70 ? "Higher price range for the area." :
    pricePosPct >= 40 ? "Mid-range pricing." :
                        "Lower price range within the typical band.";

  // --- Reusable mini bar (dark emerald fill, light track) ---
  const barTrack = "rgba(15,23,42,.10)";
  const barFill = "#065f46";

  container.innerHTML = `
    <div class="wrap">

      <!-- Row 1: KPI cards -->
      <div class="grid">
        <div class="card">
          <div class="label">Sold (YTD)</div>
          <div class="value">${num(sold)}</div>
          <div class="sub">Homes sold so far this year</div>
        </div>

        <div class="card">
          <div class="label">Median Sold Price</div>
          <div class="value">${money(price)}</div>
          <div class="sub">Typical closed price</div>
        </div>

        <div class="card">
          <div class="label">Median Discount</div>
          <div class="value">${soldToOrigPct ? `${negotiationPct.toFixed(1)}%` : "n/a"}</div>
          <div class="sub">From original list price</div>
        </div>
      </div>

      <!-- Row 2: Signal cards (user-friendly) -->
      <div class="grid" style="margin-top:16px;">

        <div class="card">
          <div class="label">Sales Activity</div>
          <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
          <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
            <div style="width:${activityPct}%; height:100%; background:${barFill};"></div>
          </div>
          <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
        </div>

        <div class="card">
          <div class="label">Negotiation Room</div>
          <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
          <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
            <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
          </div>
          <div class="sub" style="margin-top:8px;">~${soldToOrigPct ? negotiationPct.toFixed(1) : "n/a"}% below original list</div>
        </div>

        <div class="card">
          <div class="label">Median Price Position</div>
          <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
          <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
            <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
          </div>
          <div class="sub" style="margin-top:8px;">Band: ${money(priceMin)}–${money(priceMax)}</div>
        </div>

      </div>

    </div>
  `;
}

// ---------- main ----------
(async function main() {
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
    renderError(e);
  }
})();
