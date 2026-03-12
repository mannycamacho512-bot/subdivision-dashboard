// app.js — KPI cards + 3 signal cards + desktop/mobile layouts (no Chart.js)

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

function num(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "n/a";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function normalizeKey(s) {
  return String(s || "").toUpperCase().trim();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
      <h2>No YTD sales yet</h2>
      <p class="muted">This subdivision doesn’t have enough closed sales in 2026 to calculate stats.</p>
      <p class="muted">Most likely: <strong>0 homes sold YTD</strong> (so far).</p>
      <p class="muted">Tip: try a different subdivision or check back after the next closing.</p>
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

// ---------- band helpers (Kyle-wide typical range) ----------
function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function computeBand(data) {
  const prices = data
    .map((r) => Number(r.MedianSoldPrice_YTD))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  return {
    min: percentile(prices, 0.10),
    max: percentile(prices, 0.90),
  };
}

// ---------- main dashboard ----------
function renderCards(row, band) {
  const container = document.getElementById("dashboard");

  const sold = Number(row.Sold_YTD || 0);
  const price = Number(row.MedianSoldPrice_YTD || 0);

  // CLOSED discount from original list (negative means below original list)
  const closedDiff = Number(row.MedianSoldToOrigPct_YTD ?? NaN); // ex: -0.0416 = -4.16%
  const hasClosedDiff = Number.isFinite(closedDiff);

  const closedPct = hasClosedDiff ? Math.abs(closedDiff) * 100 : NaN;
  const closedDirection = hasClosedDiff
    ? (closedDiff < 0 ? "below" : closedDiff > 0 ? "above" : "at")
    : "";

  // --- Scales ---
  const activityScaleMax = 12; // tune anytime
  const priceMin = band?.min;
  const priceMax = band?.max;

  const activityPct = clamp((sold / activityScaleMax) * 100, 0, 100);

  const pricePosPct =
    Number.isFinite(priceMin) && Number.isFinite(priceMax) && priceMax > priceMin
      ? clamp(((price - priceMin) / (priceMax - priceMin)) * 100, 0, 100)
      : 50;

  // Negotiation bar width (SOLD-based only): map 0–10% discount -> 0–100%
  const negoWidth = Number.isFinite(closedPct)
    ? clamp((closedPct / 10) * 100, 0, 100)
    : 0;

  // --- Explanations ---
  const activityMeaning =
    activityPct >= 75
      ? "High activity (more homes selling so far this year)."
      : activityPct >= 45
      ? "Moderate activity (steady pace)."
      : "Lower activity (fewer sales so far).";

  let negoMeaning = "Not enough closed sales yet to estimate negotiation.";
  if (Number.isFinite(closedPct)) {
    if (closedPct >= 10) negoMeaning = "Large discounts are showing up in closed sales (strong negotiation).";
    else if (closedPct >= 6) negoMeaning = "Discounts are meaningful in closed sales (negotiation is common).";
    else if (closedPct >= 3) negoMeaning = "Some discounting in closed sales (moderate negotiation).";
    else if (closedPct >= 1) negoMeaning = "Small discounts in closed sales (limited negotiation).";
    else negoMeaning = "Closed sales are near original list price (little negotiation).";
  }

  const priceMeaning =
    pricePosPct >= 70
      ? "Higher price range for the area."
      : pricePosPct >= 40
      ? "Mid-range pricing."
      : "Lower price range within the typical band.";

  const barTrack = "rgba(15,23,42,.10)";
  const barFill = "#065f46"; // dark emerald

  const rangeLabel =
    Number.isFinite(priceMin) && Number.isFinite(priceMax)
      ? `Kyle-wide typical range: ${money(priceMin)}–${money(priceMax)}`
      : "Kyle-wide typical range: n/a";

  const closedDiscountValue = hasClosedDiff
    ? (closedDiff < 0 ? `-${closedPct.toFixed(1)}%` : closedDiff > 0 ? `+${closedPct.toFixed(1)}%` : "0.0%")
    : "n/a";

  const closedDiscountSub = hasClosedDiff
    ? `Typical sale closed ${closedDirection} original list`
    : "Not enough closed data";

  const negotiationBottomLine = Number.isFinite(closedPct)
    ? `Typical sale closed ${closedDirection} original list by ~${closedPct.toFixed(1)}%`
    : "Closed discount data not available";

  container.innerHTML = `
    <div class="wrap">

      <!-- ================= DESKTOP LAYOUT ================= -->
      <div class="desktopOnly">

        <!-- KPI row -->
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
            <div class="label">Closed Discount (Orig → Sold)</div>
            <div class="value">${closedDiscountValue}</div>
            <div class="sub">${closedDiscountSub}</div>
          </div>
        </div>

        <!-- Signals row -->
        <div class="grid" style="margin-top:16px;">

          <!-- under Sold -->
          <div class="card">
            <div class="label">Sales Activity</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${activityPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
          </div>

          <!-- under Median Sold Price -->
          <div class="card">
            <div class="label">Median Price Position</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${rangeLabel}</div>
          </div>

          <!-- under Closed Discount -->
          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${negotiationBottomLine}</div>
          </div>

        </div>
      </div>

      <!-- ================= MOBILE LAYOUT ================= -->
      <div class="mobileOnly">
        <div class="grid">

          <!-- Sold → Activity -->
          <div class="card">
            <div class="label">Sold (YTD)</div>
            <div class="value">${num(sold)}</div>
            <div class="sub">Homes sold so far this year</div>
          </div>

          <div class="card">
            <div class="label">Sales Activity</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${activityMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${activityPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${num(sold)} sales YTD</div>
          </div>

          <!-- Price → Position -->
          <div class="card">
            <div class="label">Median Sold Price</div>
            <div class="value">${money(price)}</div>
            <div class="sub">Typical closed price</div>
          </div>

          <div class="card">
            <div class="label">Median Price Position</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${priceMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${pricePosPct}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${rangeLabel}</div>
          </div>

          <!-- Discount → Negotiation -->
          <div class="card">
            <div class="label">Closed Discount (Orig → Sold)</div>
            <div class="value">${closedDiscountValue}</div>
            <div class="sub">${closedDiscountSub}</div>
          </div>

          <div class="card">
            <div class="label">Negotiation Room</div>
            <div class="sub" style="margin-bottom:10px;">This means: ${negoMeaning}</div>
            <div style="height:10px; background:${barTrack}; border-radius:8px; overflow:hidden;">
              <div style="width:${negoWidth}%; height:100%; background:${barFill};"></div>
            </div>
            <div class="sub" style="margin-top:8px;">${negotiationBottomLine}</div>
          </div>

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

    const band = computeBand(data);
    renderCards(row, band);
  } catch (e) {
    renderError(e);
  }
})();
